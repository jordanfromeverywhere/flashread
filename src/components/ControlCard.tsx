import type { CSSProperties } from 'react'
import { useState } from 'react'
import type { Derived } from '../derive'
import type { ReaderActions, ReaderState } from '../useSpeedReader'

const WORDS_PER_PAGE = 250

export function ControlCard({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  const { t } = d

  // Bottom-left figure cycles through three views on tap.
  const [posMode, setPosMode] = useState(0)
  const total = s.words.length
  const idx = Math.min(s.idx, total)
  const pctDone = total ? Math.round((idx / total) * 100) : 0
  const pagesTotal = Math.max(1, Math.ceil(total / WORDS_PER_PAGE))
  const pagesRead = total ? Math.min(pagesTotal, Math.floor(idx / WORDS_PER_PAGE) + 1) : 0
  const posText =
    posMode === 1
      ? `${100 - pctDone}% left`
      : posMode === 2
        ? `pg ${pagesRead}/${pagesTotal}`
        : `${pctDone}% done`

  const iconBtn: CSSProperties = {
    width: 48,
    height: 48,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    color: t.text,
    background: 'transparent',
    border: `1px solid ${t.border}`,
    borderRadius: 14,
    cursor: 'pointer',
  }
  return (
    <div
      aria-hidden={d.chromeHidden}
      style={{
        flex: 'none',
        overflow: 'hidden',
        maxHeight: d.chromeHidden ? 0 : 260,
        padding: d.chromeHidden ? '0 20px' : '6px 20px 8px',
        transition: 'max-height .3s ease, padding .3s ease, opacity .3s ease',
        opacity: d.chromeOp,
        pointerEvents: d.chromePe,
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
        <button
          onClick={() => setPosMode((m) => (m + 1) % 3)}
          title="Tap to switch: % done · % left · pages"
          aria-label={`Progress: ${posText}. Tap to change.`}
          style={{
            font: '500 10.5px/1 ui-monospace,Menlo,monospace',
            color: t.sub,
            width: 74,
            textAlign: 'left',
            whiteSpace: 'nowrap',
            background: 'transparent',
            border: 'none',
            padding: 0,
            cursor: 'pointer',
            textDecoration: 'underline dotted',
            textUnderlineOffset: 3,
            textDecorationColor: t.border,
          }}
        >
          {posText}
        </button>
        <div
          onClick={a.onScrub}
          style={{ flex: 1, height: 6, borderRadius: 4, background: t.border, position: 'relative', cursor: 'pointer' }}
        >
          <div
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              bottom: 0,
              width: d.pctW,
              background: t.accent,
              borderRadius: 4,
            }}
          />
        </div>
        <div style={{ font: '500 10.5px/1 ui-monospace,Menlo,monospace', color: t.sub, width: 52 }}>
          {d.remainLabel}
        </div>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, marginBottom: 14 }}>
        <button onClick={a.rewindSentence} title="Rewind one sentence" style={{ ...iconBtn, fontSize: 18 }}>
          ⤺
        </button>
        <button onClick={a.stepBack} title="Back one word" style={{ ...iconBtn, fontSize: 16 }}>
          ◄
        </button>
        <button
          onClick={a.toggle}
          title="Play / pause"
          style={{
            width: 70,
            height: 62,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: t.bg,
            background: t.accent,
            border: 'none',
            borderRadius: 18,
            cursor: 'pointer',
            fontSize: 22,
          }}
        >
          {d.playGlyph}
        </button>
        <button onClick={a.stepFwd} title="Forward one word" style={{ ...iconBtn, fontSize: 16 }}>
          ►
        </button>
        <button onClick={a.restart} title="Restart" style={{ ...iconBtn, fontSize: 16 }}>
          ↻
        </button>
      </div>

      <div style={{ display: 'flex', alignItems: 'center', gap: 14, color: t.accent }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 3, width: 70 }}>
          <input
            type="number"
            min={100}
            max={1000}
            step={10}
            value={s.wpm}
            onInput={a.onWpmNum}
            onChange={a.onWpmNum}
            onBlur={a.onWpmBlur}
            style={{
              width: 46,
              background: 'transparent',
              border: 'none',
              borderBottom: `1px solid ${t.border}`,
              color: t.accent,
              font: '700 17px/1.4 ui-monospace,Menlo,monospace',
              textAlign: 'right',
              outline: 'none',
              MozAppearance: 'textfield',
              padding: 0,
            }}
          />
          <span style={{ font: '500 9px/1 sans-serif', color: t.sub }}>wpm</span>
        </div>
        <input
          type="range"
          min={100}
          max={1000}
          step={10}
          value={s.wpm}
          onInput={a.onWpm}
          onChange={a.onWpm}
          style={{ flex: 1, color: t.accent }}
        />
        <button
          onClick={a.toggleAudio}
          title="Read aloud in sync"
          style={{
            font: '600 11px/1 sans-serif',
            padding: '9px 11px',
            borderRadius: 10,
            cursor: 'pointer',
            border: `1px solid ${s.audioOn ? t.accent : t.border}`,
            background: s.audioOn ? t.accent : 'transparent',
            color: s.audioOn ? t.bg : t.sub,
            whiteSpace: 'nowrap',
            flex: 'none',
          }}
        >
          {s.audioOn ? 'Audio ●' : 'Audio'}
        </button>
      </div>
    </div>
  )
}
