// On-device neural text-to-speech (Kokoro-82M) via kokoro-js + transformers.js.
// Everything here is lazy-loaded: the ~MBs of ONNX runtime and the model itself
// only download when the user turns the neural voice on, and the model is cached
// by the browser after the first run. Nothing is uploaded — generation is local.

import type { KokoroTTS } from 'kokoro-js'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

// A small curated set of the higher-graded English voices.
export const KOKORO_VOICES: { id: string; label: string }[] = [
  { id: 'af_heart', label: 'Heart · US' },
  { id: 'af_bella', label: 'Bella · US' },
  { id: 'af_nicole', label: 'Nicole · US' },
  { id: 'am_michael', label: 'Michael · US' },
  { id: 'am_fenrir', label: 'Fenrir · US' },
  { id: 'bf_emma', label: 'Emma · UK' },
  { id: 'bm_george', label: 'George · UK' },
]

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

let ttsPromise: Promise<KokoroTTS> | null = null

// Loads (and caches) the model. onProgress reports download progress 0..100.
export function loadKokoro(onProgress?: (pct: number) => void): Promise<KokoroTTS> {
  if (!ttsPromise) {
    ttsPromise = (async () => {
      const { KokoroTTS } = await import('kokoro-js')
      const device = hasWebGPU() ? 'webgpu' : 'wasm'
      return KokoroTTS.from_pretrained(MODEL_ID, {
        dtype: 'q8',
        device,
        progress_callback: (p: { status?: string; progress?: number }) => {
          if (p?.status === 'progress' && typeof p.progress === 'number') onProgress?.(Math.round(p.progress))
        },
      })
    })().catch((e) => {
      ttsPromise = null
      throw e
    })
  }
  return ttsPromise
}

export interface NeuralClip {
  audio: Float32Array
  rate: number
}

export async function neuralSynth(text: string, voice: string, speed: number): Promise<NeuralClip> {
  const tts = await loadKokoro()
  const out = await tts.generate(text, { voice: voice as never, speed })
  return { audio: out.audio, rate: out.sampling_rate }
}

// Kokoro's own speed control. Gentle + capped so the voice stays natural; the
// visual highlight is synced to the produced audio regardless.
export function neuralSpeed(wpm: number): number {
  return Math.max(0.7, Math.min(1.45, wpm / 210))
}
