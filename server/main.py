"""Flashread narration service — Kokoro TTS over HTTP.

Synthesises one chunk at a time rather than whole documents. The reader already
prefetches the next chunk while the current one plays, so staying ahead of the
listener only needs a real-time factor under 1.0, which a CPU box manages
comfortably. Generating a whole book up front would instead mean tens of minutes
of compute and a ~120MB download before a single word is spoken.

Audio comes back as MP3: Safari decodes it reliably, and at 48kbps a ten-second
chunk is ~60KB, which matters on cellular.
"""

from __future__ import annotations

import hashlib
import io
import logging
import os
import threading
from collections import OrderedDict
from contextlib import asynccontextmanager

import numpy as np
import soundfile as sf
from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

# uvicorn only configures its own loggers, so without this the messages below
# reach no handler and the thread count never appears in the deploy log, which
# is exactly the thing worth being able to check from Railway.
logging.basicConfig(level=logging.INFO, format="%(levelname)s: %(message)s")
log = logging.getLogger("flashread")

MODEL_PATH = os.environ.get("KOKORO_MODEL", "kokoro-v1.0.onnx")
VOICES_PATH = os.environ.get("KOKORO_VOICES", "voices-v1.0.bin")

# Comma-separated origins allowed to call this. Defaults to the GitHub Pages
# site; set ALLOWED_ORIGINS="*" to open it up while testing.
ALLOWED_ORIGINS = [
    o.strip()
    for o in os.environ.get(
        "ALLOWED_ORIGINS", "https://jordanfromeverywhere.github.io"
    ).split(",")
    if o.strip()
]

# Optional shared secret. If set, callers must send it as X-Flashread-Key.
# Without one the endpoint is open to anyone who finds the URL, and every
# request costs you CPU time.
API_KEY = os.environ.get("FLASHREAD_KEY", "")

# Chunks repeat constantly — re-reads, scrubbing back, the prefetch racing the
# player to the same index. Keeping recent clips costs little and turns those
# into instant responses.
CACHE_MAX = int(os.environ.get("CACHE_ENTRIES", "512"))

MAX_CHARS = 800


def cpu_quota() -> int:
    """CPUs this container may actually use, not the ones it can see.

    os.cpu_count() reports the host's cores, so on a 16-core host holding a
    2-CPU quota it is off by 8x, and onnxruntime sizes its thread pool from it.
    """
    try:
        with open("/sys/fs/cgroup/cpu.max") as f:  # cgroup v2
            quota, period = f.read().split()
        if quota != "max":
            return max(1, round(float(quota) / float(period)))
    except (OSError, ValueError):
        pass
    try:  # cgroup v1
        with open("/sys/fs/cgroup/cpu/cpu.cfs_quota_us") as f:
            q = int(f.read())
        with open("/sys/fs/cgroup/cpu/cpu.cfs_period_us") as f:
            p = int(f.read())
        if q > 0:
            return max(1, q // p)
    except (OSError, ValueError):
        pass
    return os.cpu_count() or 1


# Threads onnxruntime may use for a single generation.
#
# Left to itself it takes os.cpu_count(), which inside a container is the host's
# core count rather than the quota, and the oversubscription is not a small tax:
# measured on a 16-core host limited to 2 CPUs, the default 16 threads gave a
# real-time factor of 3.9 (narration falling four times behind the reader), and
# pinning it to 2 gave 0.76. The same model.
#
# Past four threads it gets worse again even with cores to spare (RTF 0.51 at
# four, 0.58 at eight on an 8-CPU quota): this graph stops parallelising and the
# synchronisation starts costing more than it saves. So: match the quota, cap at
# four. TTS_THREADS overrides it if a particular box disagrees.
THREADS = int(os.environ.get("TTS_THREADS") or min(4, cpu_quota()))


@asynccontextmanager
async def lifespan(_: FastAPI):
    """Build the session and run one synthesis before the first real request.

    Loading is otherwise lazy, so whoever presses play first waits about three
    and a half seconds for a session build and graph warmup that has nothing to
    do with their sentence. Railway's health check allows 300s for startup,
    which is ample cover for it.

    Best-effort: a box that cannot warm up should still come up and return a
    legible error per request rather than crash-loop with the reason buried in a
    boot log.
    """
    try:
        get_kokoro().create("Ready.", voice="af_heart", speed=1.0, lang="en-us")
        log.info("warmup complete")
    except Exception:
        log.exception("warmup failed; continuing and will retry per request")
    yield


app = FastAPI(title="Flashread narration", lifespan=lifespan)
app.add_middleware(
    CORSMiddleware,
    allow_origins=ALLOWED_ORIGINS,
    allow_methods=["POST", "GET", "OPTIONS"],
    allow_headers=["Content-Type", "X-Flashread-Key"],
)

_cache: "OrderedDict[str, bytes]" = OrderedDict()
_cache_lock = threading.Lock()

# Kokoro is not thread-safe and one box has a fixed amount of CPU. Serialising
# generation keeps latency predictable instead of letting four concurrent
# requests each take four times as long.
_generate_lock = threading.Lock()
_kokoro = None


def get_kokoro():
    global _kokoro
    if _kokoro is None:
        import onnxruntime as rt
        from kokoro_onnx import Kokoro

        # Kokoro's own constructor builds the session with default options, which
        # is the oversubscription described at THREADS. from_session is the seam
        # that lets the thread count be set before the pool is created.
        opts = rt.SessionOptions()
        opts.intra_op_num_threads = THREADS
        opts.inter_op_num_threads = 1
        session = rt.InferenceSession(
            MODEL_PATH, sess_options=opts, providers=["CPUExecutionProvider"]
        )
        _kokoro = Kokoro.from_session(session, VOICES_PATH)
        log.info("kokoro ready: %d intra-op threads (quota %d)", THREADS, cpu_quota())
    return _kokoro


class SynthRequest(BaseModel):
    text: str = Field(min_length=1, max_length=MAX_CHARS)
    voice: str = "af_heart"
    speed: float = Field(default=1.0, ge=0.5, le=2.0)


def cache_key(req: SynthRequest) -> str:
    raw = f"{req.voice}|{req.speed:.3f}|{req.text}".encode("utf-8")
    return hashlib.sha256(raw).hexdigest()


def to_mp3(samples: np.ndarray, rate: int) -> bytes:
    buf = io.BytesIO()
    # libsndfile writes MP3 from float input directly; clipping guards against
    # the odd sample just over 1.0, which would wrap to full-scale noise.
    sf.write(
        buf,
        np.clip(samples, -1.0, 1.0).astype(np.float32),
        rate,
        format="MP3",
        bitrate_mode="CONSTANT",
        compression_level=0.7,
    )
    return buf.getvalue()


@app.get("/health")
def health():
    return {"ok": True, "model": os.path.basename(MODEL_PATH)}


@app.get("/voices")
def voices():
    try:
        return {"voices": sorted(get_kokoro().get_voices())}
    except Exception as e:  # the model may not have loaded yet
        raise HTTPException(status_code=503, detail=str(e))


@app.post("/tts")
def tts(req: SynthRequest, x_flashread_key: str = Header(default="")):
    if API_KEY and x_flashread_key != API_KEY:
        raise HTTPException(status_code=401, detail="bad key")

    key = cache_key(req)
    with _cache_lock:
        hit = _cache.get(key)
        if hit is not None:
            _cache.move_to_end(key)
    if hit is not None:
        return Response(
            content=hit,
            media_type="audio/mpeg",
            headers={"X-Cache": "hit", "Cache-Control": "public, max-age=604800"},
        )

    try:
        with _generate_lock:
            samples, rate = get_kokoro().create(
                req.text, voice=req.voice, speed=req.speed, lang="en-us"
            )
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"synthesis failed: {e}")

    audio = to_mp3(np.asarray(samples, dtype=np.float32), rate)

    with _cache_lock:
        _cache[key] = audio
        _cache.move_to_end(key)
        while len(_cache) > CACHE_MAX:
            _cache.popitem(last=False)

    return Response(
        content=audio,
        media_type="audio/mpeg",
        headers={"X-Cache": "miss", "Cache-Control": "public, max-age=604800"},
    )
