// Thin localStorage helpers plus the app's persisted types. All reading data
// (library, settings, stats) lives locally — nothing is uploaded.

import type { FontKey, ThemeKey } from './theme'

export function load<T>(key: string, fallback: T): T {
  try {
    const v = JSON.parse(localStorage.getItem(key) || 'null')
    return v == null ? fallback : (v as T)
  } catch {
    return fallback
  }
}

export function save<T>(key: string, value: T): void {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    /* quota / private mode — non-fatal */
  }
}

export interface LibraryItem {
  id: string
  title: string
  text: string
  count: number
  idx: number
  addedAt: number
  lastAt?: number
}

export interface HistoryEntry {
  wpm: number
  at: number
}

export interface Stats {
  wordsRead: number
  timeMs: number
  sessions: number
  history: HistoryEntry[]
  streak: number
  lastDay: string | null
}

export interface Settings {
  theme: ThemeKey
  font: FontKey
  size: number
  weight: number
  chunk: number
  adaptive: boolean
  wpm: number
  easeIn: boolean
  focusMode: boolean
  pauseScale: string
  audioOn: boolean
  readMode: 'flash' | 'flow'
  voiceURI: string
}

export const STORAGE_KEYS = {
  settings: 'sr_settings',
  library: 'sr_library',
  stats: 'sr_stats',
} as const

// De-duplicate the persisted library by text, keeping the entry with the most
// progress. Mirrors the prototype's migration so old saves don't pile up.
export function dedupeLibrary(raw: LibraryItem[]): LibraryItem[] {
  const seen: Record<string, number> = {}
  const out: LibraryItem[] = []
  raw.forEach((x) => {
    if (!x || !x.text) return
    const k = x.text
    if (seen[k] != null) {
      const e = out[seen[k]]
      if ((x.idx || 0) > (e.idx || 0)) out[seen[k]] = x
    } else {
      seen[k] = out.length
      out.push(x)
    }
  })
  return out
}
