import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { dwell, prevSentenceStart, splitPivot, tokenize, tokenizeDoc, uid } from './lib/engine'
import {
  dedupeLibrary,
  load,
  save,
  STORAGE_KEYS,
  type LibraryItem,
  type Settings,
  type Stats,
} from './lib/storage'
import type { FontKey, ThemeKey } from './lib/theme'
import { THEME_ORDER } from './lib/theme'
import { deriveTitle, fetchArticle } from './lib/intake'
import { CAL_PASSAGE, SAMPLE, STARTERS } from './lib/content'
import { audioRate, pickVoice } from './lib/voices'
import { hasWebGPU, loadKokoro, neuralSpeed, neuralSynth } from './lib/neuralTts'

export type PanelKey = 'intake' | 'library' | 'settings' | 'stats' | 'calibrate' | 'more' | null
export type IntakeTab = 'paste' | 'pdf' | 'url'
export type CalState = 'idle' | 'running' | 'done'

export interface Toast {
  title: string
  sub: string
}

export interface ReaderState extends Settings {
  words: string[]
  breaks: boolean[]
  idx: number
  playing: boolean
  currentId: string | null
  title: string
  chromeHidden: boolean
  renameId: string | null
  renameText: string
  panel: PanelKey
  settingsScroll: string | null
  intakeTab: IntakeTab
  pasteText: string
  urlText: string
  draftTitle: string
  pdfStatus: string
  urlStatus: string
  voiceOn: boolean
  voiceHint: string
  library: LibraryItem[]
  stats: Stats
  cal: CalState
  calWpm: number
  calPre: string
  calPivot: string
  calPost: string
  voices: SpeechSynthesisVoice[]
  toast: Toast | null
  swStatus: string
  neuralStatus: string
}

const DEFAULT_STATS: Stats = {
  wordsRead: 0,
  timeMs: 0,
  sessions: 0,
  history: [],
  streak: 0,
  lastDay: null,
}

function initialState(): ReaderState {
  const s = load<Partial<Settings>>(STORAGE_KEYS.settings, {})
  return {
    theme: s.theme || 'dark',
    font: s.font || 'serif',
    size: s.size || 44,
    weight: s.weight || 500,
    chunk: s.chunk || 1,
    adaptive: s.adaptive !== false,
    wpm: s.wpm || 300,
    easeIn: s.easeIn !== false,
    focusMode: s.focusMode !== false,
    pauseScale: s.pauseScale || 'natural',
    audioOn: !!s.audioOn,
    readMode: s.readMode || 'flash',
    voiceURI: s.voiceURI || '',
    neuralOn: !!s.neuralOn,
    neuralVoice: s.neuralVoice || 'af_heart',
    neuralStatus: '',
    words: [],
    breaks: [],
    idx: 0,
    playing: false,
    currentId: null,
    title: '',
    chromeHidden: false,
    renameId: null,
    renameText: '',
    panel: null,
    settingsScroll: null,
    intakeTab: 'paste',
    pasteText: '',
    urlText: '',
    draftTitle: '',
    pdfStatus: '',
    urlStatus: '',
    voiceOn: false,
    voiceHint: 'Tap to dictate (Chrome). Speak and it appends below.',
    library: dedupeLibrary(load<LibraryItem[]>(STORAGE_KEYS.library, [])),
    stats: load<Stats>(STORAGE_KEYS.stats, DEFAULT_STATS),
    cal: 'idle',
    calWpm: 300,
    calPre: '',
    calPivot: '',
    calPost: '',
    voices: [],
    toast: null,
    swStatus: 'checking…',
  }
}

interface AudioChunk {
  text: string
  start: number
  offsets: number[]
  count: number
}

// The imperative bits of the engine that must not trigger re-renders.
interface Refs {
  timer?: ReturnType<typeof setTimeout>
  hideT?: ReturnType<typeof setTimeout>
  toastT?: ReturnType<typeof setTimeout>
  calTimer?: ReturnType<typeof setTimeout>
  holding: boolean
  spaceHold: boolean
  sessionStart: number | null
  startIdx: number
  playIdx: number | null
  baseWords: number
  lastKm: number | null
  inner: HTMLElement | null
  audioActive: boolean
  chunks: AudioChunk[]
  ci: number
  rate: number
  rec: SpeechRecognition | null
  neuralActive: boolean
  audioCtx: AudioContext | null
  srcNode: AudioBufferSourceNode | null
  rafId: number
  prefetch: Map<number, Promise<{ audio: Float32Array; rate: number }>>
}

export function useSpeedReader() {
  const [state, setStateRaw] = useState<ReaderState>(initialState)
  const stateRef = useRef(state)
  stateRef.current = state

  const r = useRef<Refs>({
    holding: false,
    spaceHold: false,
    sessionStart: null,
    startIdx: 0,
    playIdx: null,
    baseWords: 0,
    lastKm: null,
    inner: null,
    audioActive: false,
    chunks: [],
    ci: 0,
    rate: 1,
    rec: null,
    neuralActive: false,
    audioCtx: null,
    srcNode: null,
    rafId: 0,
    prefetch: new Map(),
  }).current

  // setState with a post-commit callback (mirrors the prototype's this.setState(patch, cb)).
  const setState = useCallback(
    (
      patch: Partial<ReaderState> | ((prev: ReaderState) => Partial<ReaderState>),
      cb?: () => void,
    ) => {
      setStateRaw((prev) => {
        const p = typeof patch === 'function' ? patch(prev) : patch
        const next = { ...prev, ...p }
        stateRef.current = next
        return next
      })
      if (cb) queueMicrotask(cb)
    },
    [],
  )

  const persistSettings = useCallback((extra?: Partial<Settings>) => {
    const s = { ...stateRef.current, ...extra }
    const out: Settings = {
      theme: s.theme,
      font: s.font,
      size: s.size,
      weight: s.weight,
      chunk: s.chunk,
      adaptive: s.adaptive,
      wpm: s.wpm,
      easeIn: s.easeIn,
      focusMode: s.focusMode,
      pauseScale: s.pauseScale,
      audioOn: s.audioOn,
      readMode: s.readMode,
      voiceURI: s.voiceURI,
      neuralOn: s.neuralOn,
      neuralVoice: s.neuralVoice,
    }
    save(STORAGE_KEYS.settings, out)
  }, [])

  // A settings-changing setState that also persists.
  const set = useCallback(
    (patch: Partial<ReaderState>) => setState(patch, () => persistSettings()),
    [persistSettings, setState],
  )

  // ---- timing / playback -------------------------------------------------
  const dwellAt = useCallback((i: number) => {
    const s = stateRef.current
    return dwell(i, {
      words: s.words,
      breaks: s.breaks,
      wpm: s.wpm,
      chunk: s.chunk,
      adaptive: s.adaptive,
      easeIn: s.easeIn,
      pauseScale: s.pauseScale,
      playIdx: r.playIdx,
    })
  }, [r])

  const showToast = useCallback(
    (title: string, sub: string) => {
      clearTimeout(r.toastT)
      setState({ toast: { title, sub } })
      r.toastT = setTimeout(() => setState({ toast: null }), 2800)
    },
    [r, setState],
  )

  const dismissToast = useCallback(() => {
    clearTimeout(r.toastT)
    setState({ toast: null })
  }, [r, setState])

  // Lifetime word-count milestone toasts ("1,000 words read").
  const maybeToast = useCallback(
    (idxArg?: number) => {
      const idx = idxArg == null ? stateRef.current.idx : idxArg
      const total = (r.baseWords || 0) + Math.max(0, idx - (r.startIdx || idx))
      if (r.lastKm == null) r.lastKm = Math.floor((r.baseWords || 0) / 1000)
      const m = Math.floor(total / 1000)
      if (m > r.lastKm && m > 0) {
        r.lastKm = m
        showToast(`${(m * 1000).toLocaleString()} words read`, 'Lifetime milestone — keep going')
      }
    },
    [r, showToast],
  )

  const persistProgress = useCallback(() => {
    const s = stateRef.current
    if (!s.currentId) return
    const lib = s.library.map((x) =>
      x.id === s.currentId
        ? { ...x, idx: s.idx, count: s.words.length, lastAt: Date.now() }
        : x,
    )
    setState({ library: lib })
    save(STORAGE_KEYS.library, lib)
  }, [setState])

  const scheduleHide = useCallback(() => {
    clearTimeout(r.hideT)
    if (!stateRef.current.focusMode) return
    r.hideT = setTimeout(() => {
      if (stateRef.current.playing) setState({ chromeHidden: true })
    }, 1800)
  }, [r, setState])

  // ---- audio (TTS) -------------------------------------------------------
  const chosenVoice = useCallback((): SpeechSynthesisVoice | null => {
    try {
      const s = stateRef.current
      const vs = s.voices.length ? s.voices : window.speechSynthesis.getVoices() || []
      if (!vs.length) return null
      return pickVoice(vs, s.voiceURI)
    } catch {
      return null
    }
  }, [])

  const cancelAudio = useCallback(() => {
    r.audioActive = false
    r.neuralActive = false
    try {
      r.srcNode?.stop()
    } catch {
      /* no-op */
    }
    r.srcNode = null
    if (r.rafId) {
      cancelAnimationFrame(r.rafId)
      r.rafId = 0
    }
    try {
      window.speechSynthesis?.cancel()
    } catch {
      /* no-op */
    }
  }, [r])

  const commitSession = useRef<(finished?: boolean) => void>(() => {})
  const finish = useRef<() => void>(() => {})
  const tick = useRef<() => void>(() => {})
  const speakChunk = useRef<() => void>(() => {})
  const playAudio = useRef<() => void>(() => {})
  const playNeural = useRef<() => void>(() => {})
  const neuralChunk = useRef<() => void>(() => {})

  commitSession.current = (finished?: boolean) => {
    if (!r.sessionStart) return
    const s = stateRef.current
    const dt = Date.now() - r.sessionStart
    const wr = Math.max(0, s.idx - (r.startIdx || 0))
    const st: Stats = { ...s.stats }
    st.wordsRead += wr
    st.timeMs += dt
    st.sessions += 1
    const today = new Date().toDateString()
    let newDay = false
    if (st.lastDay !== today) {
      const y = new Date(Date.now() - 864e5).toDateString()
      st.streak = (st.lastDay === y ? st.streak : 0) + 1
      st.lastDay = today
      newDay = true
    }
    if (finished || wr > 30) {
      st.history = [...(st.history || []), { wpm: s.wpm, at: Date.now() }].slice(-24)
    }
    setState({ stats: st })
    save(STORAGE_KEYS.stats, st)
    r.sessionStart = null
    if (finished && wr > 5) showToast('Finished', 'You reached the end · nice work')
    else if (newDay && st.streak >= 2) showToast(`${st.streak}-day streak`, 'Kept the habit alive')
  }

  finish.current = () => {
    clearTimeout(r.timer)
    cancelAudio()
    commitSession.current(true)
    setState({ playing: false, chromeHidden: false })
    persistProgress()
  }

  tick.current = () => {
    const { idx, words } = stateRef.current
    if (idx >= words.length) {
      finish.current()
      return
    }
    r.timer = setTimeout(() => {
      const cur = stateRef.current.idx
      const next = cur + stateRef.current.chunk
      if (next >= stateRef.current.words.length) {
        setState({ idx: stateRef.current.words.length }, () => finish.current())
      } else {
        setState({ idx: next }, () => {
          maybeToast()
          tick.current()
        })
      }
    }, dwellAt(idx))
  }

  speakChunk.current = () => {
    if (!r.audioActive) return
    const synth = window.speechSynthesis
    if (r.ci >= r.chunks.length) {
      finish.current()
      return
    }
    const c = r.chunks[r.ci]
    const u = new SpeechSynthesisUtterance(c.text)
    u.rate = r.rate
    u.lang = 'en-US'
    const vv = chosenVoice()
    if (vv) u.voice = vv
    u.onboundary = (e) => {
      if (!r.audioActive) return
      if (e.name && e.name !== 'word') return
      let wi = 0
      for (let k = 0; k < c.offsets.length; k++) {
        if (c.offsets[k] <= e.charIndex) wi = k
        else break
      }
      setState({ idx: c.start + wi })
      maybeToast(c.start + wi)
    }
    u.onend = () => {
      if (!r.audioActive) return
      r.ci++
      setState({ idx: Math.min(c.start + c.count, stateRef.current.words.length) })
      speakChunk.current()
    }
    u.onerror = () => {
      if (r.audioActive) {
        r.ci++
        speakChunk.current()
      }
    }
    synth.speak(u)
  }

  playAudio.current = () => {
    const synth = window.speechSynthesis
    if (!synth) {
      tick.current()
      return
    }
    synth.cancel()
    const w = stateRef.current.words
    const chunks: AudioChunk[] = []
    let i = stateRef.current.idx
    while (i < w.length) {
      let j = i
      let cnt = 0
      const offsets: number[] = []
      const parts: string[] = []
      let pos = 0
      while (j < w.length) {
        const tk = w[j]
        offsets.push(pos)
        parts.push(tk)
        pos += tk.length + 1
        cnt++
        j++
        if (/[.!?…]["')\]]?$/.test(tk) && cnt >= 3) break
        if (cnt >= 28) break
      }
      chunks.push({ text: parts.join(' '), start: i, offsets, count: cnt })
      i = j
    }
    r.chunks = chunks
    r.ci = 0
    r.audioActive = true
    r.rate = audioRate(stateRef.current.wpm)
    speakChunk.current()
  }

  // ---- neural audio (on-device Kokoro TTS) -------------------------------
  // Generates each sentence-chunk locally, plays it through Web Audio, and syncs
  // the word highlight to the produced clip's duration. Falls back to the system
  // voice if the model can't load. Nothing is uploaded.
  playNeural.current = () => {
    const AC =
      window.AudioContext ||
      (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext
    if (!AC) {
      playAudio.current()
      return
    }
    if (!r.audioCtx) r.audioCtx = new AC()
    r.audioCtx.resume?.().catch(() => {})

    const w = stateRef.current.words
    const chunks: AudioChunk[] = []
    let i = stateRef.current.idx
    while (i < w.length) {
      let j = i
      let cnt = 0
      const parts: string[] = []
      while (j < w.length) {
        const tk = w[j]
        parts.push(tk)
        cnt++
        j++
        if (/[.!?…]["')\]]?$/.test(tk) && cnt >= 3) break
        if (cnt >= 24) break
      }
      chunks.push({ text: parts.join(' '), start: i, offsets: [], count: cnt })
      i = j
    }
    r.chunks = chunks
    r.ci = 0
    r.neuralActive = true
    r.prefetch = new Map()
    setState({
      neuralStatus: hasWebGPU() ? 'Loading voice…' : 'Loading voice (no GPU — may be slow)…',
    })
    loadKokoro((pct) => {
      if (r.neuralActive) setState({ neuralStatus: `Downloading voice… ${pct}%` })
    })
      .then(() => {
        if (!r.neuralActive) return
        setState({ neuralStatus: '' })
        neuralChunk.current()
      })
      .catch(() => {
        r.neuralActive = false
        setState({ neuralStatus: 'On-device voice failed — using the device voice.' })
        if (stateRef.current.playing && window.speechSynthesis) playAudio.current()
      })
  }

  neuralChunk.current = () => {
    if (!r.neuralActive || !r.audioCtx) return
    const ctx = r.audioCtx
    if (r.ci >= r.chunks.length) {
      finish.current()
      return
    }
    const c = r.chunks[r.ci]
    const voice = stateRef.current.neuralVoice
    const speed = neuralSpeed(stateRef.current.wpm)
    const clipP = r.prefetch.get(r.ci) || neuralSynth(c.text, voice, speed)
    clipP
      .then((clip) => {
        if (!r.neuralActive) return
        const ni = r.ci + 1
        if (ni < r.chunks.length && !r.prefetch.has(ni)) {
          r.prefetch.set(
            ni,
            neuralSynth(r.chunks[ni].text, voice, speed).catch(() => ({
              audio: new Float32Array(0),
              rate: clip.rate,
            })),
          )
        }
        if (!clip.audio.length) {
          r.ci++
          neuralChunk.current()
          return
        }
        const buf = ctx.createBuffer(1, clip.audio.length, clip.rate)
        buf.getChannelData(0).set(clip.audio)
        const src = ctx.createBufferSource()
        src.buffer = buf
        src.connect(ctx.destination)
        r.srcNode = src
        const toks = stateRef.current.words.slice(c.start, c.start + c.count)
        const weights = toks.map((t) => Math.max(1, t.length))
        const totalW = weights.reduce((a, b) => a + b, 0) || 1
        const bounds: number[] = []
        let acc = 0
        for (const wt of weights) {
          acc += (wt / totalW) * buf.duration
          bounds.push(acc)
        }
        const startAt = ctx.currentTime
        const step = () => {
          if (!r.neuralActive) return
          const el = ctx.currentTime - startAt
          let wi = 0
          while (wi < bounds.length && bounds[wi] <= el) wi++
          const idx = Math.min(c.start + wi, stateRef.current.words.length)
          if (idx !== stateRef.current.idx) {
            setState({ idx })
            maybeToast(idx)
          }
          r.rafId = requestAnimationFrame(step)
        }
        src.onended = () => {
          if (!r.neuralActive) return
          if (r.rafId) {
            cancelAnimationFrame(r.rafId)
            r.rafId = 0
          }
          setState({ idx: Math.min(c.start + c.count, stateRef.current.words.length) })
          r.ci++
          neuralChunk.current()
        }
        src.start()
        r.rafId = requestAnimationFrame(step)
      })
      .catch(() => {
        if (!r.neuralActive) return
        r.ci++
        neuralChunk.current()
      })
  }

  const play = useCallback(() => {
    const s = stateRef.current
    if (!s.words.length) return
    let idx = s.idx
    if (idx >= s.words.length) idx = 0
    r.sessionStart = Date.now()
    r.startIdx = idx
    r.playIdx = idx
    r.baseWords = s.stats.wordsRead || 0
    r.lastKm = Math.floor(r.baseWords / 1000)
    setState({ idx, playing: true, chromeHidden: false }, () => {
      scheduleHide()
      if (stateRef.current.audioOn && stateRef.current.neuralOn) playNeural.current()
      else if (stateRef.current.audioOn && window.speechSynthesis) playAudio.current()
      else tick.current()
    })
  }, [r, scheduleHide, setState])

  const pause = useCallback(() => {
    clearTimeout(r.timer)
    cancelAudio()
    clearTimeout(r.hideT)
    commitSession.current()
    setState({ playing: false, chromeHidden: false })
    persistProgress()
  }, [cancelAudio, persistProgress, r, setState])

  const toggle = useCallback(() => {
    if (stateRef.current.playing) pause()
    else play()
  }, [pause, play])

  const jump = useCallback(
    (i: number) => {
      clearTimeout(r.timer)
      cancelAudio()
      setState({
        idx: Math.max(0, Math.min(i, stateRef.current.words.length)),
        playing: false,
        chromeHidden: false,
      })
      persistProgress()
    },
    [cancelAudio, persistProgress, r, setState],
  )

  const stepFwd = useCallback(() => {
    clearTimeout(r.timer)
    cancelAudio()
    setState((s) => ({ idx: Math.min(s.idx + s.chunk, s.words.length), playing: false, chromeHidden: false }))
  }, [cancelAudio, r, setState])

  const stepBack = useCallback(() => {
    clearTimeout(r.timer)
    cancelAudio()
    setState((s) => ({ idx: Math.max(0, s.idx - s.chunk), playing: false, chromeHidden: false }))
  }, [cancelAudio, r, setState])

  const restart = useCallback(() => jump(0), [jump])

  const rewindSentence = useCallback(() => {
    clearTimeout(r.timer)
    cancelAudio()
    const s = stateRef.current
    jump(prevSentenceStart(s.words, s.idx))
  }, [cancelAudio, jump, r])

  // ---- speed -------------------------------------------------------------
  const setWpm = useCallback(
    (v: number) => {
      setState({ wpm: v }, () => {
        persistSettings()
        // System audio restarts to apply the new rate; neural doesn't (it would
        // regenerate on every drag — the new speed applies to the next play).
        if (
          stateRef.current.playing &&
          stateRef.current.audioOn &&
          !stateRef.current.neuralOn &&
          window.speechSynthesis
        ) {
          cancelAudio()
          playAudio.current()
        }
      })
    },
    [cancelAudio, persistSettings, setState],
  )

  const onWpm = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    setWpm(parseInt(e.currentTarget.value, 10))
  }, [setWpm])
  const onWpmNum = useCallback((e: React.FormEvent<HTMLInputElement>) => {
    const v = parseInt(e.currentTarget.value, 10)
    if (!isNaN(v)) setState({ wpm: v })
  }, [setState])
  const onWpmBlur = useCallback((e: React.FocusEvent<HTMLInputElement>) => {
    let v = parseInt(e.currentTarget.value, 10)
    if (isNaN(v)) v = 300
    v = Math.max(100, Math.min(1000, v))
    setWpm(v)
  }, [setWpm])

  const onScrub = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      const rect = e.currentTarget.getBoundingClientRect()
      const p = Math.max(0, Math.min(1, (e.clientX - rect.left) / rect.width))
      jump(Math.round(p * stateRef.current.words.length))
    },
    [jump],
  )

  // ---- hold-to-read + focus chrome --------------------------------------
  const bumpHide = useCallback(() => {
    if (stateRef.current.chromeHidden) setState({ chromeHidden: false })
    scheduleHide()
  }, [scheduleHide, setState])

  const holdStart = useCallback(() => {
    const s = stateRef.current
    if (!s.words.length || s.panel) return
    r.holding = true
    if (!s.playing) play()
    setState({ chromeHidden: true })
  }, [play, r, setState])

  const holdEnd = useCallback(() => {
    if (r.holding) {
      r.holding = false
      if (stateRef.current.playing) pause()
    }
  }, [pause, r])

  // ---- library / loading -------------------------------------------------
  const loadWords = useCallback(
    (text: string, title?: string, id?: string | null, startIdx?: number) => {
      const { words, breaks } = tokenizeDoc(text)
      clearTimeout(r.timer)
      cancelAudio()
      r.startIdx = startIdx || 0
      r.playIdx = null
      setState({
        words,
        breaks,
        title: title || 'Untitled',
        currentId: id || null,
        idx: Math.min(startIdx || 0, words.length),
        playing: false,
        chromeHidden: false,
        panel: null,
      })
    },
    [cancelAudio, r, setState],
  )

  const startNew = useCallback(
    (text: string, title?: string) => {
      const { words } = tokenizeDoc(text)
      if (!words.length) return
      const s = stateRef.current
      const existing = s.library.find((x) => x.text === text)
      if (existing) {
        const lib = [existing, ...s.library.filter((x) => x.id !== existing.id)]
        setState({ library: lib })
        save(STORAGE_KEYS.library, lib)
        loadWords(existing.text, existing.title, existing.id, Math.min(existing.idx || 0, words.length))
        return
      }
      const id = uid()
      const entry: LibraryItem = {
        id,
        title: title || 'Untitled',
        text,
        count: words.length,
        idx: 0,
        addedAt: Date.now(),
      }
      const lib = [entry, ...s.library.filter((x) => x.id !== id)].slice(0, 60)
      setState({ library: lib })
      save(STORAGE_KEYS.library, lib)
      loadWords(text, entry.title, id, 0)
    },
    [loadWords, setState],
  )

  const loadSample = useCallback(() => {
    startNew(SAMPLE, 'Sample — how RSVP works')
  }, [startNew])

  const loadStarter = useCallback(
    (i: number) => {
      const x = STARTERS[i]
      if (x) startNew(x.text, x.title)
    },
    [startNew],
  )

  const openLibraryItem = useCallback(
    (it: LibraryItem) => {
      loadWords(it.text, it.title, it.id, Math.min(it.idx || 0, tokenizeDoc(it.text).words.length))
    },
    [loadWords],
  )

  const removeLibraryItem = useCallback(
    (id: string) => {
      const s = stateRef.current
      const lib = s.library.filter((x) => x.id !== id)
      setState({ library: lib, currentId: s.currentId === id ? null : s.currentId })
      save(STORAGE_KEYS.library, lib)
    },
    [setState],
  )

  const renameStart = useCallback(
    (id: string, title: string) => setState({ renameId: id, renameText: title }),
    [setState],
  )
  const renameChange = useCallback(
    (e: React.FormEvent<HTMLInputElement>) => setState({ renameText: e.currentTarget.value }),
    [setState],
  )
  const renameSave = useCallback(() => {
    const s = stateRef.current
    const id = s.renameId
    if (!id) return
    const nt = (s.renameText || '').trim()
    const lib = s.library.map((x) => (x.id === id ? { ...x, title: nt || x.title } : x))
    setState({
      library: lib,
      renameId: null,
      renameText: '',
      title: s.currentId === id && nt ? nt : s.title,
    })
    save(STORAGE_KEYS.library, lib)
  }, [setState])

  // ---- intake ------------------------------------------------------------
  const startReading = useCallback(() => {
    const s = stateRef.current
    const text = s.pasteText
    if (!tokenize(text).length) {
      setState({ pdfStatus: 'Nothing to read yet — add some text first.' })
      return
    }
    const title =
      s.draftTitle.trim() ||
      (s.intakeTab === 'url' && s.urlText
        ? s.urlText.replace(/^https?:\/\//, '').slice(0, 50)
        : deriveTitle(text))
    startNew(text, title)
    setState({ pasteText: '', draftTitle: '', urlText: '', pdfStatus: '', urlStatus: '' })
    if (s.voiceOn && r.rec) r.rec.stop()
  }, [r, setState, startNew])

  const onPdf = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files && e.target.files[0]
      if (!file) return
      setState({ pdfStatus: `Extracting “${file.name}”…` })
      try {
        const { extractPdf } = await import('./lib/pdf')
        const text = await extractPdf(file, (m) => setState({ pdfStatus: m }))
        setState({
          pasteText: text,
          draftTitle: stateRef.current.draftTitle || file.name.replace(/\.pdf$/i, ''),
          pdfStatus: `${tokenize(text).length} words extracted. Press “Read”.`,
        })
      } catch (err) {
        setState({ pdfStatus: `Could not read that PDF (${(err as Error).message || err}).` })
      }
    },
    [setState],
  )

  const fetchUrl = useCallback(async () => {
    const url = stateRef.current.urlText.trim()
    if (!url) {
      setState({ urlStatus: 'Enter a URL first.' })
      return
    }
    setState({ urlStatus: 'Fetching…' })
    try {
      const { text, words } = await fetchArticle(url)
      setState({
        pasteText: text,
        draftTitle: stateRef.current.draftTitle || url.replace(/^https?:\/\//, '').slice(0, 50),
        urlStatus: `${words} words extracted. Press “Read”.`,
      })
    } catch {
      setState({ urlStatus: 'Direct fetch failed (often CORS). Use the bookmarklet below, then paste.' })
    }
  }, [setState])

  const toggleVoice = useCallback(() => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition
    if (!SR) {
      setState({ voiceHint: 'Voice input needs Chrome/Edge — not available in this browser.' })
      return
    }
    if (stateRef.current.voiceOn) {
      if (r.rec) r.rec.stop()
      setState({ voiceOn: false, voiceHint: 'Stopped.' })
      return
    }
    const rec: SpeechRecognition = new SR()
    r.rec = rec
    rec.continuous = true
    rec.interimResults = false
    rec.lang = 'en-US'
    rec.onresult = (ev) => {
      let add = ''
      for (let i = ev.resultIndex; i < ev.results.length; i++) {
        if (ev.results[i].isFinal) add += ev.results[i][0].transcript
      }
      if (add) setState((s) => ({ pasteText: (s.pasteText ? s.pasteText + ' ' : '') + add.trim() }))
    }
    rec.onerror = (ev) => setState({ voiceHint: 'Voice error: ' + ev.error, voiceOn: false })
    rec.onend = () => {
      if (stateRef.current.voiceOn) {
        try {
          rec.start()
        } catch {
          /* already started */
        }
      }
    }
    try {
      rec.start()
      setState({ voiceOn: true, voiceHint: 'Listening… speak now. Tap again to stop.', intakeTab: 'paste' })
    } catch {
      setState({ voiceHint: 'Could not start microphone.' })
    }
  }, [r, setState])

  // ---- calibration -------------------------------------------------------
  const runCalibration = useCallback(() => {
    const words = tokenize(CAL_PASSAGE)
    setState({ cal: 'running' })
    let i = 0
    const step = () => {
      if (i >= words.length) {
        setState({ cal: 'done' })
        return
      }
      const sp = splitPivot(words[i])
      setState({ calPre: sp.pre, calPivot: sp.pivot, calPost: sp.post })
      const last = words[i]
      let d = 60000 / stateRef.current.calWpm
      if (/[.!?,;:]$/.test(last)) d *= 1.6
      if (last.length > 7) d *= 1.2
      i++
      r.calTimer = setTimeout(step, d)
    }
    step()
  }, [r, setState])

  const acceptCal = useCallback(() => {
    setWpm(stateRef.current.calWpm)
    setState({ panel: null, cal: 'idle' })
  }, [setState, setWpm])

  const resetCal = useCallback(() => setState({ cal: 'idle' }), [setState])

  // ---- voice picker ------------------------------------------------------
  const loadVoices = useCallback(() => {
    try {
      const vs = window.speechSynthesis.getVoices() || []
      if (vs.length) setState({ voices: vs })
    } catch {
      /* no-op */
    }
  }, [setState])

  const setVoice = useCallback(
    (uri: string) => {
      set({ voiceURI: uri })
      if (stateRef.current.playing && stateRef.current.audioOn && window.speechSynthesis) {
        cancelAudio()
        setTimeout(() => {
          r.audioActive = true
          playAudio.current()
        }, 40)
      }
    },
    [cancelAudio, r, set],
  )

  const previewVoice = useCallback(() => {
    const synth = window.speechSynthesis
    if (!synth) return
    synth.cancel()
    const u = new SpeechSynthesisUtterance('The quick brown fox jumps over the lazy dog.')
    const v = chosenVoice()
    if (v) u.voice = v
    u.rate = audioRate(stateRef.current.wpm)
    synth.speak(u)
  }, [chosenVoice])

  const toggleAudio = useCallback(() => {
    const on = !stateRef.current.audioOn
    set({ audioOn: on })
    if (stateRef.current.playing) {
      clearTimeout(r.timer)
      cancelAudio()
      if (on && stateRef.current.neuralOn) playNeural.current()
      else if (on && window.speechSynthesis) {
        r.audioActive = true
        playAudio.current()
      } else tick.current()
    } else if (!on) cancelAudio()
  }, [cancelAudio, r, set])

  const toggleNeural = useCallback(() => {
    const on = !stateRef.current.neuralOn
    set({ neuralOn: on })
    if (stateRef.current.playing && stateRef.current.audioOn) {
      clearTimeout(r.timer)
      cancelAudio()
      if (on) playNeural.current()
      else if (window.speechSynthesis) {
        r.audioActive = true
        playAudio.current()
      } else tick.current()
    }
  }, [cancelAudio, r, set])

  const setNeuralVoice = useCallback(
    (v: string) => {
      set({ neuralVoice: v })
      if (stateRef.current.playing && stateRef.current.audioOn && stateRef.current.neuralOn) {
        cancelAudio()
        playNeural.current()
      }
    },
    [cancelAudio, set],
  )

  // ---- panels + settings toggles ----------------------------------------
  const openIntake = useCallback(() => setState({ panel: 'intake' }), [setState])
  const openLibrary = useCallback(() => setState({ panel: 'library' }), [setState])
  const openSettings = useCallback(() => setState({ panel: 'settings' }), [setState])
  const openStats = useCallback(() => setState({ panel: 'stats' }), [setState])
  const openCalibrate = useCallback(
    () => setState({ panel: 'calibrate', cal: 'idle', calWpm: stateRef.current.wpm }),
    [setState],
  )
  const openReadTab = useCallback(() => setState({ panel: null }), [setState])
  const openMore = useCallback(() => setState({ panel: 'more' }), [setState])
  const openVoiceSettings = useCallback(
    () => setState({ panel: 'settings', settingsScroll: 'voice' }),
    [setState],
  )
  const closePanel = useCallback(() => {
    if (stateRef.current.cal === 'running') clearTimeout(r.calTimer)
    setState({ panel: null, cal: 'idle' })
  }, [r, setState])

  const quickTheme = useCallback(() => {
    const i = THEME_ORDER.indexOf(stateRef.current.theme)
    set({ theme: THEME_ORDER[(i + 1) % THEME_ORDER.length] })
  }, [set])

  const toggleFocus = useCallback(() => {
    const on = !stateRef.current.focusMode
    set({ focusMode: on })
    if (!on) setState({ chromeHidden: false })
  }, [set, setState])

  // simple field setters
  const setField = useMemo(
    () => ({
      setTheme: (t: ThemeKey) => set({ theme: t }),
      setFont: (f: FontKey) => set({ font: f }),
      setChunk: (c: number) => set({ chunk: c }),
      setPause: (p: string) => set({ pauseScale: p }),
      setMode: (m: 'flash' | 'flow') => set({ readMode: m }),
      onSize: (e: React.FormEvent<HTMLInputElement>) => set({ size: parseInt(e.currentTarget.value, 10) }),
      onWeight: (e: React.FormEvent<HTMLInputElement>) => set({ weight: parseInt(e.currentTarget.value, 10) }),
      togglePacing: () => set({ adaptive: !stateRef.current.adaptive }),
      toggleEase: () => set({ easeIn: !stateRef.current.easeIn }),
      setTab: (t: IntakeTab) => setState({ intakeTab: t }),
      onPaste: (e: React.FormEvent<HTMLTextAreaElement>) => setState({ pasteText: e.currentTarget.value }),
      onUrl: (e: React.FormEvent<HTMLInputElement>) => setState({ urlText: e.currentTarget.value }),
      onDraftTitle: (e: React.FormEvent<HTMLInputElement>) => setState({ draftTitle: e.currentTarget.value }),
      onCalWpm: (e: React.FormEvent<HTMLInputElement>) => setState({ calWpm: parseInt(e.currentTarget.value, 10) }),
    }),
    [set, setState],
  )

  // ---- global listeners + mount ------------------------------------------
  const onKey = useRef<(e: KeyboardEvent) => void>(() => {})
  const onKeyUp = useRef<(e: KeyboardEvent) => void>(() => {})
  const onPoke = useRef<() => void>(() => {})

  onKey.current = (e) => {
    const s = stateRef.current
    if (s.panel) return
    const tag = (e.target as HTMLElement)?.tagName?.toLowerCase() || ''
    if (tag === 'input' || tag === 'textarea') return
    if (e.code === 'Space') {
      e.preventDefault()
      if (e.repeat) return
      if (!s.playing) {
        r.spaceHold = true
        play()
      }
    } else if (e.code === 'ArrowRight') {
      e.preventDefault()
      stepFwd()
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault()
      stepBack()
    } else if (e.code === 'ArrowUp') {
      e.preventDefault()
      setWpm(Math.min(1000, s.wpm + 25))
    } else if (e.code === 'ArrowDown') {
      e.preventDefault()
      setWpm(Math.max(100, s.wpm - 25))
    }
  }
  onKeyUp.current = (e) => {
    if (e.code === 'Space' && r.spaceHold) {
      r.spaceHold = false
      if (stateRef.current.playing) pause()
    }
  }
  onPoke.current = () => {
    if (r.holding) return
    const s = stateRef.current
    if (s.playing && s.focusMode && s.chromeHidden) bumpHide()
  }

  useEffect(() => {
    const key = (e: KeyboardEvent) => onKey.current(e)
    const keyUp = (e: KeyboardEvent) => onKeyUp.current(e)
    const poke = () => onPoke.current()
    window.addEventListener('keydown', key)
    window.addEventListener('keyup', keyUp)
    window.addEventListener('pointerdown', poke)

    if (window.speechSynthesis) {
      loadVoices()
      try {
        window.speechSynthesis.onvoiceschanged = loadVoices
      } catch {
        /* no-op */
      }
    }

    // Ask the browser not to evict our library/progress under storage pressure
    // (helps installed PWAs, notably on iOS, keep saved texts across launches).
    try {
      navigator.storage?.persist?.()
    } catch {
      /* not supported — non-fatal */
    }

    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register(`${import.meta.env.BASE_URL}sw.js`)
        .then(() => setState({ swStatus: 'on — cached for offline use' }))
        .catch(() => setState({ swStatus: 'unavailable here' }))
    } else {
      setState({ swStatus: 'unavailable' })
    }

    const refs = r
    return () => {
      clearTimeout(refs.timer)
      clearTimeout(refs.hideT)
      cancelAudio()
      window.removeEventListener('keydown', key)
      window.removeEventListener('keyup', keyUp)
      window.removeEventListener('pointerdown', poke)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Keep the current word centered as it advances (teleprompter scroll).
  const setInnerRef = useCallback((n: HTMLElement | null) => {
    r.inner = n
    if (n) requestAnimationFrame(() => syncScroll())
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const syncScroll = useCallback(() => {
    const inner = r.inner
    if (!inner || !inner.parentElement) return
    const vp = inner.parentElement
    const vpH = vp.clientHeight || 220
    const cur = inner.querySelector<HTMLElement>('[data-cur="1"]')
    const ty = cur ? vpH / 2 - (cur.offsetTop + cur.offsetHeight / 2) : 0
    inner.style.transition = 'transform .22s cubic-bezier(.4,0,.2,1)'
    inner.style.transform = `translateY(${ty}px)`
  }, [r])

  useEffect(() => {
    syncScroll()
  }, [state.idx, state.words, state.readMode, state.size, state.panel, syncScroll])

  return {
    state,
    actions: {
      setState,
      toggle,
      play,
      pause,
      stepFwd,
      stepBack,
      restart,
      rewindSentence,
      onWpm,
      onWpmNum,
      onWpmBlur,
      onScrub,
      holdStart,
      holdEnd,
      loadSample,
      loadStarter,
      openLibraryItem,
      removeLibraryItem,
      renameStart,
      renameChange,
      renameSave,
      startReading,
      onPdf,
      fetchUrl,
      toggleVoice,
      runCalibration,
      acceptCal,
      resetCal,
      setVoice,
      previewVoice,
      toggleAudio,
      toggleNeural,
      setNeuralVoice,
      dismissToast,
      openIntake,
      openLibrary,
      openSettings,
      openStats,
      openCalibrate,
      openReadTab,
      openMore,
      openVoiceSettings,
      closePanel,
      quickTheme,
      toggleFocus,
      setInnerRef,
      ...setField,
    },
  }
}

export type ReaderActions = ReturnType<typeof useSpeedReader>['actions']
