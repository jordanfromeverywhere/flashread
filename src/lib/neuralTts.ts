// On-device neural text-to-speech (Kokoro-82M) via kokoro-js + transformers.js.
// Everything here is lazy-loaded: the ~MBs of ONNX runtime and the model itself
// only download when the user turns the neural voice on, and the model is cached
// by the browser after the first run. Nothing is uploaded — generation is local.

import type { KokoroTTS } from 'kokoro-js'
import { load, save } from './storage'

const MODEL_ID = 'onnx-community/Kokoro-82M-v1.0-ONNX'

// The configuration that actually worked here, so a device that has already
// proved it cannot run one is not made to rediscover that on every launch.
const CONFIG_KEY = 'sr_neural_config'

export type NeuralDevice = 'webgpu' | 'wasm'
export type NeuralDtype = 'q8' | 'q4'
export interface NeuralConfig {
  device: NeuralDevice
  dtype: NeuralDtype
}

// How long a load may go without any sign of life before it is declared wedged.
// Progress events reset the clock, so a slow download never trips this: the
// window that matters is after the bytes land, while the ONNX session is being
// built. WebGPU is where sessions hang outright; WASM is merely slow, and on an
// older phone building an 82M-parameter graph genuinely does take a while.
const STALL_MS: Record<NeuralDevice, number> = { webgpu: 45_000, wasm: 240_000 }

// Ordered fallbacks. q4 is half the weights of q8 — a little rougher, but it
// both downloads and builds in noticeably less, which is what an older phone
// with a capped WASM heap needs.
const LADDER: NeuralConfig[] = [
  { device: 'wasm', dtype: 'q8' },
  { device: 'wasm', dtype: 'q4' },
]

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

function rememberedConfig(): NeuralConfig | null {
  const v = load<Partial<NeuralConfig>>(CONFIG_KEY, {})
  const okDevice = v?.device === 'webgpu' || v?.device === 'wasm'
  const okDtype = v?.dtype === 'q8' || v?.dtype === 'q4'
  return okDevice && okDtype ? { device: v.device!, dtype: v.dtype! } : null
}

const sameConfig = (a: NeuralConfig, b: NeuralConfig) =>
  a.device === b.device && a.dtype === b.dtype

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
 * Configures onnxruntime-web before any session is built.
 *
 *  - wasmPaths: the copy of the runtime we ship (see the ort-runtime plugin in
 *    vite.config.ts) rather than transformers.js's jsDelivr default. Same-origin
 *    means the service worker caches it, so it is paid for once instead of on
 *    every cold start, and the voice really does work offline. It also lets the
 *    proxy worker below be created directly, with no cross-origin blob shim.
 *
 *  - proxy: run the runtime in a Web Worker. Transformers.js defaults this off
 *    because it doesn't matter on a GPU, but on the WASM path *everything* —
 *    building the graph, then every sentence generated — runs wherever this
 *    says. On the main thread that means an iPhone freezes solid for as long as
 *    an 82M-parameter graph takes to build: no repaint, no status update, no
 *    watchdog, nothing but a stuck message. In a worker the app stays alive and
 *    the audio arrives when it arrives.
 *
 *  - numThreads: pinned to 1. Session creation is documented to hang outright
 *    with multi-threading (onnxruntime#26858), and without cross-origin
 *    isolation there is no SharedArrayBuffer to thread with anyway.
 */
async function configureRuntime() {
  try {
    const { env } = await import('@huggingface/transformers')
    const wasm = env.backends?.onnx?.wasm
    if (!wasm) return
    wasm.wasmPaths = new URL('ort/', document.baseURI).href
    wasm.numThreads = 1
    wasm.proxy = true
  } catch {
    /* fall back to the bundled defaults rather than failing the load */
  }
}

async function build(cfg: NeuralConfig): Promise<KokoroTTS> {
  await configureRuntime()
  const { KokoroTTS } = await import('kokoro-js')
  const beat = { at: Date.now() }
  // Building the session after the bytes land is the slow, silent part — several
  // files report progress, so "starting" is only shown once the largest of them
  // has actually finished. It is deliberately not latched: a later file starting
  // its own download puts the percentage back on screen.
  const starting =
    cfg.device === 'wasm' ? 'Starting the voice (a moment on phones)…' : 'Starting the voice…'
  let peak = 0
  const session = KokoroTTS.from_pretrained(MODEL_ID, {
    dtype: cfg.dtype,
    device: cfg.device,
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
  return withStallGuard(session, STALL_MS[cfg.device], beat)
}

/**
 * Works down the ladder until something loads, remembering what did. Anything
 * already known to work here is tried first; the rest stay as fallbacks, since
 * a configuration can stop working (a browser update, a device under memory
 * pressure) and a remembered choice must not become a permanent dead end.
 */
async function loadOnce(): Promise<KokoroTTS> {
  const remembered = rememberedConfig()
  const preferred = await pickDevice()
  const plan: NeuralConfig[] = []
  if (remembered) plan.push(remembered)
  if (preferred === 'webgpu') plan.push({ device: 'webgpu', dtype: 'q8' })
  for (const cfg of LADDER) plan.push(cfg)

  let lastError: unknown = new Error('no configuration available')
  const tried: NeuralConfig[] = []
  for (const cfg of plan) {
    if (tried.some((c) => sameConfig(c, cfg))) continue
    emit(tried.length === 0 ? 'Loading voice…' : 'Trying a lighter voice…')
    tried.push(cfg)
    try {
      const tts = await build(cfg)
      save(CONFIG_KEY, cfg)
      return tts
    } catch (e) {
      lastError = e
    }
  }
  throw lastError
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
