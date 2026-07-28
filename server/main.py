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
import os
import threading
from collections import OrderedDict

import numpy as np
import soundfile as sf
from fastapi import FastAPI, Header, HTTPException, Response
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

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

app = FastAPI(title="Flashread narration")
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
        from kokoro_onnx import Kokoro

        _kokoro = Kokoro(MODEL_PATH, VOICES_PATH)
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
