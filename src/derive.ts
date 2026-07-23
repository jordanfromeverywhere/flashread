// Computes presentational values for the reading surfaces from raw state —
// the equivalent of the prototype's renderVals(), minus the quiz.
import type { CSSProperties } from 'react'
import { estRemaining, splitPivot } from './lib/engine'
import { FONTS, isDarkTheme, THEMES, type Theme } from './lib/theme'
import type { LibraryItem } from './lib/storage'
import type { ReaderState } from './useSpeedReader'

export interface FlowWord {
  text: string
  style: CSSProperties
  mark: string
}

export interface Derived {
  t: Theme
  isDark: boolean
  fontFamily: string
  has: boolean
  // pivot
  pre: string
  pivotCh: string
  post: string
  bandH: number
  // flow / rest paragraph
  flowWords: FlowWord[]
  flowSize: number
  paraOpacity: string
  wordOverlayOpacity: string
  // labels
  modeLabel: string
  headerTitle: string
  themeGlyph: string
  playGlyph: string
  posLabel: string
  remainLabel: string
  pctW: string
  // chrome
  chromeOp: string
  chromePe: 'none' | 'auto'
  showHoldHint: boolean
  flashMode: boolean
  flowMode: boolean
  // resume card
  resume: LibraryItem | undefined
  resumePct: number
}

export function derive(s: ReaderState): Derived {
  const t = THEMES[s.theme] || THEMES.dark
  const ff = (FONTS[s.font] || FONTS.serif).family
  const isDark = isDarkTheme(s.theme)
  const has = s.words.length > 0
  const cur = has
    ? splitPivot(s.words.slice(s.idx, s.idx + s.chunk).join(' '))
    : { pre: '', pivot: '', post: '' }
  const total = s.words.length
  const pct = total ? Math.min(100, (s.idx / total) * 100) : 0
  const remMs = has ? estRemaining(s.words, s.idx, s.wpm, s.chunk, s.adaptive) : 0
  const remMin = Math.floor(remMs / 60000)
  const remSec = Math.round((remMs % 60000) / 1000)

  const flowWords: FlowWord[] = []
  let flowSize = 19
  if (has) {
    const sw2 = Math.max(0, s.idx - 55)
    const ew2 = Math.min(total, s.idx + 55)
    for (let k = sw2; k < ew2; k++) {
      const isCur = k >= s.idx && k < s.idx + s.chunk
      const rd = k < s.idx
      const style: CSSProperties = isCur
        ? {
            background: t.focusSoft,
            color: t.text,
            fontWeight: 700,
            borderRadius: 4,
            padding: '1px 3px',
          }
        : rd
          ? { color: t.sub, opacity: 0.45 }
          : { color: t.text, opacity: 0.92 }
      flowWords.push({ text: s.words[k] + ' ', style, mark: isCur ? '1' : '' })
    }
    flowSize = Math.max(15, Math.min(21, Math.round(s.size * 0.42)))
  }

  const inprog = s.library
    .filter((x) => x.count && (x.idx || 0) > 0 && (x.idx || 0) < x.count)
    .sort((a, b) => (b.lastAt || b.addedAt || 0) - (a.lastAt || a.addedAt || 0))
  const resume = inprog[0]

  return {
    t,
    isDark,
    fontFamily: ff,
    has,
    pre: cur.pre,
    pivotCh: cur.pivot,
    post: cur.post,
    bandH: Math.round(s.size * 2.0),
    flowWords,
    flowSize,
    paraOpacity: s.readMode === 'flow' ? '1' : s.playing ? '0' : '1',
    wordOverlayOpacity: s.readMode !== 'flow' && s.playing ? '1' : '0',
    modeLabel: s.readMode === 'flow' ? 'Flow' : s.audioOn ? 'Listen' : 'Focus',
    headerTitle: s.title || 'Nothing loaded',
    themeGlyph: isDark ? '☀' : '☾',
    playGlyph: s.playing ? '❚❚' : '▶',
    posLabel: has ? `${Math.min(s.idx + 1, total)}/${total}` : '–',
    remainLabel: has ? `${remMin > 0 ? remMin + 'm' : ''}${remSec}s` : '',
    pctW: pct + '%',
    chromeOp: s.chromeHidden ? '0' : '1',
    chromePe: s.chromeHidden ? 'none' : 'auto',
    showHoldHint: has && !s.playing && !s.panel && !s.chromeHidden,
    flashMode: s.readMode !== 'flow',
    flowMode: s.readMode === 'flow',
    resume,
    resumePct: resume ? Math.round((resume.idx / resume.count) * 100) : 0,
  }
}
