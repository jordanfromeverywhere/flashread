// Narration from your own Kokoro server (see server/) instead of the phone's
// CPU. Same voices, same chunking, same highlight sync — the only difference is
// where the audio is generated.
//
// This is opt-in and unconfigured by default: the endpoint is yours, so the
// public app keeps its "nothing is uploaded" behaviour unless you point it at a
// server yourself. When it is on, the text of what you are reading goes to that
// server, and nowhere else.

import { load, save } from './storage'

export interface CloudSettings {
  url: string
  key: string
}

const CLOUD_KEY = 'sr_cloud_tts'

export function loadCloud(): CloudSettings {
  const v = load<Partial<CloudSettings>>(CLOUD_KEY, {})
  return { url: (v?.url || '').trim(), key: (v?.key || '').trim() }
}

export function saveCloud(next: CloudSettings): void {
  save(CLOUD_KEY, { url: next.url.trim(), key: next.key.trim() })
}

export function cloudReady(): boolean {
  return /^https?:\/\//i.test(loadCloud().url)
}

function endpoint(path: string): string {
  const { url } = loadCloud()
  return url.replace(/\/+$/, '') + path
}

export async function cloudHealth(): Promise<string> {
  const res = await fetch(endpoint('/health'), { method: 'GET' })
  if (!res.ok) throw new Error(`server said ${res.status}`)
  const body = (await res.json()) as { model?: string }
  return body?.model || 'ok'
}

/**
 * Fetches one chunk and decodes it to raw samples, matching what the on-device
 * path returns so the player, prefetch and word-highlight code stay identical.
 *
 * Decoding needs a real AudioContext — the app's shared one is passed in rather
 * than made here, since on iOS a context created outside a user gesture starts
 * out unable to play anything.
 */
export async function cloudSynth(
  text: string,
  voice: string,
  speed: number,
  ctx: AudioContext,
  signal?: AbortSignal,
): Promise<{ audio: Float32Array; rate: number }> {
  const { key } = loadCloud()
  const res = await fetch(endpoint('/tts'), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(key ? { 'X-Flashread-Key': key } : {}),
    },
    body: JSON.stringify({ text, voice, speed }),
    signal,
  })
  if (!res.ok) {
    throw new Error(res.status === 401 ? 'Server rejected the key.' : `Server error ${res.status}.`)
  }
  const bytes = await res.arrayBuffer()
  // decodeAudioData detaches the buffer it is given, so nothing else may hold a
  // reference to it afterwards.
  const buf = await ctx.decodeAudioData(bytes)
  return { audio: buf.getChannelData(0).slice(), rate: buf.sampleRate }
}
