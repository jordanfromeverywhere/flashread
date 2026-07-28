# Kokoro narration service. onnxruntime rather than torch keeps the image near
# 500MB instead of several GB, which is the difference between a cold start you
# notice and one you don't.
FROM python:3.12-slim

# espeak-ng does the phonemisation Kokoro expects; libsndfile writes the MP3.
RUN apt-get update \
 && apt-get install -y --no-install-recommends espeak-ng libsndfile1 curl ca-certificates \
 && rm -rf /var/lib/apt/lists/*

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Baked into the image, not fetched at boot: a cold start that has to pull
# ~320MB before serving its first request is a cold start that times out.
ARG MODEL_BASE=https://github.com/thewh1teagle/kokoro-onnx/releases/download/model-files-v1.0
RUN curl -fsSL -o kokoro-v1.0.onnx "${MODEL_BASE}/kokoro-v1.0.onnx" \
 && curl -fsSL -o voices-v1.0.bin  "${MODEL_BASE}/voices-v1.0.bin"

COPY main.py .

ENV PORT=8000
# One worker: generation is CPU-bound and serialised anyway, so extra workers
# would only multiply memory for the same throughput.
CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT} --workers 1"]
