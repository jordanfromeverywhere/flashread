// On-device neural text-to-speech (Kokoro-82M) via kokoro-js + transformers.js.
// Everything here is lazy-loaded: the ~MBs of ONNX runtime and the model itself
// only download when the user turns the neural voice on, and the model is cached
// by the browser after the first run. Nothing is uploaded — generation is local.

import type { KokoroTTS } from 'kokoro-js'
import { load, save } from './storage'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

// Which execution provider actually worked here, so a device that has already
// proved it cannot run the model isn't retried on every launch.
const DEVICE_KEY = 'sr_neural_device'

export type NeuralDevice = 'webgpu' | 'wasm'

// How long a load may go without any sign of life before it is declared wedged.
// Progress events reset the clock, so a slow download never trips this: the
// window that matters is after the bytes land, while the ONNX session is being
// built. WebGPU is where sessions hang outright; WASM is merely slow, and on an
// older phone building an 82M-parameter graph genuinely does take a while.
const STALL_MS: Record<NeuralDevice, number> = { webgpu: 45_000, wasm: 240_000 }

// requestAdapter() itself can never settle on a half-implemented WebGPU.
const ADAPTER_MS = 4_000

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

// WebGPU is not in the DOM lib we build against, and we only need the one call.
interface GPUNavigator extends Navigator {
  gpu?: { requestAdapter(): Promise<unknown> }
}

export function hasWebGPU(): boolean {
  return typeof navigator !== 'undefined' && 'gpu' in navigator
}

/**
 * iPhone/iPad, including iPadOS claiming to be a Mac. Every browser there is
 * WebKit underneath, so this is about the engine, not the vendor.
 */
export function isIOS(): boolean {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/.test(ua)) return true
  return /Macintosh/.test(ua) && (navigator.maxTouchPoints || 0) > 1
}

function rememberedDevice(): NeuralDevice | null {
  const v = load<string>(DEVICE_KEY, '')
  return v === 'webgpu' || v === 'wasm' ? v : null
}

/**
 * Picks an execution provider we have reason to believe can actually run.
 *
 * iOS advertises navigator.gpu, but onnxruntime's WebGPU backend wedges building
 * Kokoro's graph there: from_pretrained() neither resolves nor rejects, so the
 * download finishes, the progress readout sits at 100%, and the voice never
 * arrives. WASM on the same device is slower and it works — so on iOS we don't
 * ask. Elsewhere, presence of the API is not enough either; an adapter has to be
 * obtainable (a browser can expose WebGPU with no usable GPU behind it).
 */
async function pickDevice(): Promise<NeuralDevice> {
  const remembered = rememberedDevice()
  if (remembered) return remembered
  if (isIOS() || !hasWebGPU()) return 'wasm'
  const gpu = (navigator as GPUNavigator).gpu
  if (!gpu) return 'wasm'
  try {
    const adapter = await withTimeout(gpu.requestAdapter(), ADAPTER_MS, 'adapter request timed out')
    return adapter ? 'webgpu' : 'wasm'
  } catch {
    return 'wasm'
  }
}

function withTimeout<T>(p: Promise<T>, ms: number, message: string): Promise<T> {
  return new Promise((resolve, reject) => {
    const t = setTimeout(() => reject(new Error(message)), ms)
    p.then(
      (v) => {
        clearTimeout(t)
        resolve(v)
      },
      (e) => {
        clearTimeout(t)
        reject(e)
      },
    )
  })
}

/**
 * Rejects if `p` neither settles nor reports progress for `ms`. The underlying
 * work is not cancellable — a hung session stays hung — but this hands control
 * back so the caller can fall back or tell the user, instead of a spinner that
 * spins until the app is closed.
 */
function withStallGuard<T>(p: Promise<T>, ms: number, beat: { at: number }): Promise<T> {
  return new Promise((resolve, reject) => {
    let settled = false
    const iv = setInterval(() => {
      if (settled) return
      // Time spent in the background doesn't count. iOS suspends both the timers
      // and the transfer, so on return the clock would otherwise show a long
      // "stall" that was really just the user checking a message.
      if (typeof document !== 'undefined' && document.visibilityState !== 'visible') {
        beat.at = Date.now()
        return
      }
      if (Date.now() - beat.at < ms) return
      settled = true
      clearInterval(iv)
      reject(new Error('stalled'))
    }, 1000)
    p.then(
      (v) => {
        if (settled) return
        settled = true
        clearInterval(iv)
        resolve(v)
      },
      (e) => {
        if (settled) return
        settled = true
        clearInterval(iv)
        reject(e)
      },
    )
  })
}

export type LoadStatus = (message: string) => void

// Every in-flight caller hears about progress, not just whichever one happened
// to start the load (Settings' Preview and pressing play race for it).
const listeners = new Set<LoadStatus>()

function emit(message: string) {
  listeners.forEach((fn) => {
    try {
      fn(message)
    } catch {
      /* a broken listener must not take the load down */
    }
  })
}

let ttsPromise: Promise<KokoroTTS> | null = null

/**
 * Points onnxruntime-web at the copy of its WASM runtime we ship (see the
 * ort-runtime plugin in vite.config.ts) instead of transformers.js's jsDelivr
 * default. Same-origin means the service worker caches it, so it is paid for
 * once rather than on every cold start, and the voice really does work offline.
 */
async function useLocalRuntime() {
  try {
    const { env } = await import('@huggingface/transformers')
    const wasm = env.backends?.onnx?.wasm
    if (wasm) wasm.wasmPaths = new URL('ort/', document.baseURI).href
  } catch {
    /* fall back to the bundled default rather than failing the load */
  }
}

async function build(device: NeuralDevice): Promise<KokoroTTS> {
  await useLocalRuntime()
  const { KokoroTTS } = await import('kokoro-js')
  const beat = { at: Date.now() }
  // Building the session after the bytes land is the slow, silent part — several
  // files report progress, so "starting" is only shown once the largest of them
  // has actually finished. It is deliberately not latched: a later file starting
  // its own download puts the percentage back on screen.
  const starting =
    device === 'wasm' ? 'Starting the voice (no GPU — may take a moment)…' : 'Starting the voice…'
  let peak = 0
  const session = KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: 'q8',
    device,
    progress_callback: (p: { status?: string; progress?: number }) => {
      beat.at = Date.now()
      if (p?.status === 'progress' && typeof p.progress === 'number') {
        const pct = Math.round(p.progress)
        if (pct > peak) peak = pct
        if (pct < 100) {
          emit(`Downloading voice… ${pct}%`)
          return
        }
      }
      if (peak >= 99) emit(starting)
    },
  })
  return withStallGuard(session, STALL_MS[device], beat)
}

async function loadOnce(): Promise<KokoroTTS> {
  const device = await pickDevice()
  emit('Loading voice…')
  try {
    const tts = await build(device)
    save(DEVICE_KEY, device)
    return tts
  } catch (e) {
    if (device === 'wasm') throw e
    // The GPU path is wedged or refused here. Remember that before retrying, so
    // the next launch goes straight to the provider that works.
    save(DEVICE_KEY, 'wasm')
    emit('Voice needs the slower path — retrying…')
    const tts = await build('wasm')
    return tts
  }
}

/**
 * Loads (and caches) the model. `onStatus` receives human-readable progress; the
 * same message stream reaches every caller waiting on the shared load.
 */
export function loadKokoro(onStatus?: LoadStatus): Promise<KokoroTTS> {
  if (onStatus) listeners.add(onStatus)
  if (!ttsPromise) {
    ttsPromise = loadOnce().catch((e) => {
      ttsPromise = null
      throw e
    })
  }
  const p = ttsPromise
  const drop = () => {
    if (onStatus) listeners.delete(onStatus)
  }
  return p.then(
    (v) => {
      drop()
      return v
    },
    (e) => {
      drop()
      throw e
    },
  )
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
