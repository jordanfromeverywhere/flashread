// Pure reading-engine helpers: tokenization, ORP pivot, syllable estimation and
// adaptive dwell timing. Ported from the prototype where the timing model was
// tuned against premium RSVP readers (syllable-weighted, punctuation-aware,
// short-word speed-up, ease-in ramp).

import { PAUSE_SCALE } from './theme'

export function tokenize(text: string): string[] {
  return String(text || '')
    .replace(/\s+/g, ' ')
    .trim()
    .split(' ')
    .filter(Boolean)
}

export interface Doc {
  words: string[]
  breaks: boolean[]
}

// Splits into words while recording, per word, whether it ends a paragraph.
export function tokenizeDoc(text: string): Doc {
  const paras = String(text || '')
    .replace(/\r/g, '')
    .split(/\n{2,}/)
    .map((p) => p.replace(/\n/g, ' ').trim())
    .filter(Boolean)
  const words: string[] = []
  const breaks: boolean[] = []
  paras.forEach((p) => {
    const ws = p.split(/\s+/).filter(Boolean)
    ws.forEach((wd, j) => {
      words.push(wd)
      breaks.push(j === ws.length - 1)
    })
  })
  return { words, breaks }
}

// Optimal recognition point — index of the pivot letter. Scales with length.
export function orp(word: string): number {
  const n = word.replace(/[^A-Za-z0-9]/g, '').length || word.length
  if (n <= 1) return 0
  if (n <= 5) return 1
  if (n <= 9) return 2
  if (n <= 13) return 3
  return 4
}

export interface Pivot {
  pre: string
  pivot: string
  post: string
}

export function splitPivot(str: string): Pivot {
  const p = orp(str)
  const i = Math.min(p, Math.max(0, str.length - 1))
  return { pre: str.slice(0, i), pivot: str.slice(i, i + 1), post: str.slice(i + 1) }
}

export function syllables(word: string): number {
  let w = (word || '').toLowerCase().replace(/[^a-z]/g, '')
  if (w.length <= 3) return w.length ? 1 : 0
  w = w.replace(/(?:[^laeiouy]es|ed|[^laeiouy]e)$/, '').replace(/^y/, '')
  const m = w.match(/[aeiouy]{1,2}/g)
  return m ? m.length : 1
}

export interface DwellParams {
  words: string[]
  breaks: boolean[]
  wpm: number
  chunk: number
  adaptive: boolean
  easeIn: boolean
  pauseScale: string
  // Index of the word playback started at, for the ease-in ramp. null = no ramp.
  playIdx: number | null
}

// Milliseconds to hold word `i` on screen.
export function dwell(i: number, p: DwellParams): number {
  const w = p.words
  if (!w[i]) return 0
  const chunk = p.chunk
  const toks = w.slice(i, i + chunk)
  let d = (60000 / p.wpm) * chunk
  if (p.adaptive) {
    const last = toks[toks.length - 1] || ''
    const joined = toks.join(' ')
    const alpha = joined.replace(/[^A-Za-z0-9]/g, '').length
    let syl = 1
    toks.forEach((tk) => {
      const c = syllables(tk)
      if (c > syl) syl = c
    })
    let f = 1
    if (syl >= 5) f *= 1.6
    else if (syl >= 3) f *= 1.3
    if (alpha <= 2) f *= 0.9
    if (/\d/.test(joined)) f *= 1.4
    const scale = PAUSE_SCALE[p.pauseScale] ?? 1
    if (p.breaks[i + chunk - 1]) f *= 1 + 1.4 * scale
    else if (/[.!?…]["')\]]?$/.test(last)) f *= 1 + 1.0 * scale
    else if (/[,;:—-]$/.test(last)) f *= 1 + 0.5 * scale
    d *= f
  }
  if (p.easeIn && p.playIdx != null) {
    const k = (i - p.playIdx) / chunk
    if (k >= 0 && k < 10) d *= 1.8 - 0.8 * (k / 10)
  }
  return Math.min(3000, Math.max(55, d))
}

// Rough estimate of remaining time from `idx` to the end, in milliseconds.
// The 1.18 stands in for the average slow-down adaptive pacing applies across a
// document; it is a headline estimate, not a sum of real dwells.
export function estRemaining(
  words: string[],
  idx: number,
  wpm: number,
  chunk: number,
  adaptive: boolean,
): number {
  // Closed form. This was a loop over every remaining word accumulating a term
  // that never depended on the index — O(n) for a constant, re-run by derive()
  // on every render, so several times a second while playing on a book-length
  // document.
  const steps = Math.max(0, Math.ceil((words.length - idx) / chunk))
  return steps * (60000 / wpm) * chunk * (adaptive ? 1.18 : 1)
}

const SENTENCE_END = /[.!?…]["')\]]?$/

// Index of the start of the previous sentence relative to `idx`.
export function prevSentenceStart(words: string[], idx: number): number {
  let s = 0
  for (let k = idx - 1; k >= 1; k--) {
    if (SENTENCE_END.test(words[k - 1])) {
      s = k
      break
    }
  }
  if (s >= idx - 1) {
    let s2 = 0
    for (let k = s - 1; k >= 1; k--) {
      if (SENTENCE_END.test(words[k - 1])) {
        s2 = k
        break
      }
    }
    s = s2
  }
  return s
}

export function uid(): string {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 7)
}
