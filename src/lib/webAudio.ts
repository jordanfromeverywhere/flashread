// Shared AudioContext plus the iOS workarounds the neural voice needs.
//
// Three Safari behaviours break on-device narration in ways that look, from the
// reader's side, exactly like "the voice never loaded":
//
//  1. Web Audio defaults to the *ambient* audio session, which the ringer switch
//     mutes. speechSynthesis uses a different path and keeps working, so device
//     voices play and the neural voice is silent. navigator.audioSession fixes
//     it, but only if it is set before the context is created.
//  2. Safari has a non-standard 'interrupted' state (screen lock, a call, an app
//     switch) that nothing clears for us. A context in it accepts start()
//     without ever making a sound or firing onended — so the chunk chain stalls
//     forever on the word it was on.
//  3. A context that has produced no sound gets suspended out from under us. The
//     neural path is the only one that goes minutes between the tap that
//     unlocked the context and the first clip, so it is the only one that hits
//     this — hence the silent keep-alive below.

interface AudioSessionNavigator extends Navigator {
  audioSession?: { type: string }
}

let ctx: AudioContext | null = null
let keepAlive: AudioBufferSourceNode | null = null

/**
 * Asks Safari for a media-playback audio session so the ringer switch stops
 * muting generated audio. No-op everywhere else.
 */
export function primeAudioSession(): void {
  try {
    const s = (navigator as AudioSessionNavigator).audioSession
    if (s && s.type !== 'playback') s.type = 'playback'
  } catch {
    /* not implemented here — the ringer switch stays in charge */
  }
}

/**
 * The app's single AudioContext. Must first be called from a user gesture:
 * iOS only lets a context start running when one is being handled.
 */
export function getAudioContext(): AudioContext | null {
  if (ctx) return ctx
  const AC =
    window.AudioContext ||
    (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
  if (!AC) return null
  primeAudioSession()
  ctx = new AC()
  // Safari does not resume after an interruption on its own. Try as soon as the
  // page is in front again; while it is hidden the resume would just reject.
  const revive = () => {
    if (ctx && ctx.state !== 'running' && document.visibilityState === 'visible') {
      void resumeContext(ctx)
    }
  }
  ctx.addEventListener?.('statechange', revive)
  document.addEventListener('visibilitychange', revive)
  return ctx
}

/** Resumes the context if it is suspended or interrupted. True if it is running after. */
export async function resumeContext(c: AudioContext): Promise<boolean> {
  if (running(c)) return true
  try {
    await c.resume()
  } catch {
    /* needs a fresh user gesture — the caller reports it */
  }
  return running(c)
}

/** `state` is re-read rather than narrowed: resume() is what changes it. */
export function running(c: AudioContext): boolean {
  return (c.state as string) === 'running'
}

/**
 * Holds a looping silent buffer on the context so iOS keeps it running while the
 * model downloads. Without it the context is routinely suspended by the time the
 * first clip is ready, and that clip plays into the void.
 */
export function holdContextAwake(c: AudioContext): void {
  if (keepAlive) return
  try {
    const frames = Math.max(1, Math.round(c.sampleRate / 10))
    const src = c.createBufferSource()
    src.buffer = c.createBuffer(1, frames, c.sampleRate)
    src.loop = true
    src.connect(c.destination)
    src.start()
    keepAlive = src
  } catch {
    /* the context will just have to fend for itself */
  }
}

export function releaseContextAwake(): void {
  try {
    keepAlive?.stop()
  } catch {
    /* already stopped */
  }
  keepAlive = null
}
