# Flashread narration server

Kokoro TTS over HTTP, so narration is generated on a box with a real CPU instead
of on a phone. Same voices as the on-device engine — the difference is only where
the work happens.

## Why this exists

On-device Kokoro runs through WebAssembly, and on an iPhone that is slow enough
to be unusable: an ~80MB model download, then a graph build, then generation at
roughly real time. This moves all of that to a server the phone talks to.

It synthesises **one chunk at a time**, not whole documents. The reader already
prefetches the next chunk while the current one plays, so staying ahead of a
listener only needs a real-time factor under 1.0 — which any CPU box manages.
Generating a book up front would instead mean tens of minutes of compute and a
~120MB download before the first word, which is worse than what it replaces.

## Deploy to Railway

1. **New Project → Deploy from GitHub repo**, pick this repo.
2. **Settings → Root Directory**: `server`. Railway will find the `Dockerfile`.
3. **Variables**:

   | Variable | Value | Notes |
   |---|---|---|
   | `ALLOWED_ORIGINS` | `https://jordanfromeverywhere.github.io` | Comma-separated. `*` while testing. |
   | `FLASHREAD_KEY` | any long random string | Optional but recommended — see below. |

4. **Settings → Networking → Generate Domain**. That URL is what goes in the app.

The first build takes a while: it bakes the ~320MB model into the image so cold
starts don't have to fetch it. Expect ~2GB RAM and 2 vCPU to be comfortable.

### Set a key

The generated domain is public. Without `FLASHREAD_KEY` anyone who finds it can
spend your CPU budget. With it set, requests need a matching `X-Flashread-Key`
header, which the app sends from the field in Settings.

This is a shared secret in a browser, so it is not a real access-control system —
it is a speed bump against drive-by use. For anything more, put Railway behind
Cloudflare Access.

## Point the app at it

In Flashread: **More → Settings → Narration voice → Neural**, then **My server**.
Paste the Railway URL and the key. Tap **Preview** to check it.

The app keeps working without any of this — the setting is per-device and off by
default, so the public site is unchanged for everyone else.

## What gets sent

The text of what you are reading, one chunk at a time, to the URL you configure
and nowhere else. On-device narration remains available and still uploads
nothing. Worth knowing before pointing this at anything sensitive.

## Run it locally

```sh
cd server
docker build -t flashread-tts .
docker run --rm -p 8000:8000 -e ALLOWED_ORIGINS='*' flashread-tts
curl -s localhost:8000/health
curl -s -X POST localhost:8000/tts \
  -H 'Content-Type: application/json' \
  -d '{"text":"The quick brown fox jumps over the lazy dog.","voice":"af_heart"}' \
  -o sample.mp3
```

## API

| Route | |
|---|---|
| `GET /health` | liveness; returns the model filename |
| `GET /voices` | voice ids the model has |
| `POST /tts` | `{text, voice, speed}` → `audio/mpeg` |

`POST /tts` caps text at 800 characters (a chunk is far below that), serialises
generation behind a lock so concurrent requests don't thrash a shared CPU, and
keeps the last 512 clips in memory — re-reads and scrubbing backwards then cost
nothing.
