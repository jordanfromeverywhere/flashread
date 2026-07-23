import type { CSSProperties } from 'react'
import { useLayoutEffect, useRef, useState } from 'react'
import type { Derived } from '../derive'
import type { ReaderActions, ReaderState } from '../useSpeedReader'

const MASK =
  'linear-gradient(to bottom,transparent 0,#000 17%,#000 83%,transparent 100%)'

function FlowParagraph({ d, a }: { d: Derived; a: ReaderActions }) {
  return (
    <div
      ref={a.setInnerRef}
      style={{
        position: 'absolute',
        left: 0,
        right: 0,
        top: 0,
        fontFamily: d.fontFamily,
        fontSize: d.flowSize,
        lineHeight: 1.7,
        textAlign: 'left',
        willChange: 'transform',
      }}
    >
      {d.flowWords.map((w, i) => (
        <span key={i} data-cur={w.mark} style={w.style}>
          {w.text}
        </span>
      ))}
    </div>
  )
}

export function ReadingCanvas({
  s,
  d,
  a,
}: {
  s: ReaderState
  d: Derived
  a: ReaderActions
}) {
  const { t } = d
  const flashWrapRef = useRef<HTMLDivElement>(null)
  const [flying, setFlying] = useState(false)

  // On play (Flash mode), fly a full-size clone of the pivoted word from the
  // resting word's spot up to the centered big-word slot — the word travels
  // into place instead of jump-cutting. useLayoutEffect measures before paint.
  useLayoutEffect(() => {
    if (!s.playing || !d.flashMode) return
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches) return
    const wrap = flashWrapRef.current
    if (!wrap) return
    const small = wrap.querySelector('[data-cur="1"]') as HTMLElement | null
    const big = wrap.querySelector('[data-bigword]') as HTMLElement | null
    if (!small || !big) return
    const r0 = small.getBoundingClientRect()
    const r1 = big.getBoundingClientRect()
    if (!r0.width || !r0.height || !r1.width || !r1.height) return

    const clone = big.cloneNode(true) as HTMLElement
    clone.removeAttribute('data-bigword')
    clone.style.width = `${r1.width}px`
    const fly = document.createElement('div')
    Object.assign(fly.style, {
      position: 'fixed',
      left: `${r1.left + r1.width / 2}px`,
      top: `${r1.top + r1.height / 2}px`,
      width: `${r1.width}px`,
      transformOrigin: '50% 50%',
      pointerEvents: 'none',
      zIndex: '40',
    })
    fly.appendChild(clone)
    document.body.appendChild(fly)

    const dx = r0.left + r0.width / 2 - (r1.left + r1.width / 2)
    const dy = r0.top + r0.height / 2 - (r1.top + r1.height / 2)
    const s0 = r0.height / r1.height

    setFlying(true)
    const anim = fly.animate(
      [
        { transform: `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px)) scale(${s0})` },
        { transform: 'translate(-50%, -50%) scale(1)' },
      ],
      { duration: 340, easing: 'cubic-bezier(.32,.72,0,1)', fill: 'both' },
    )
    let settled = false
    const settle = () => {
      if (settled) return
      settled = true
      fly.remove()
      setFlying(false)
    }
    anim.onfinish = settle
    return () => {
      try {
        anim.cancel()
      } catch {
        /* no-op */
      }
      settle()
    }
  }, [s.playing, d.flashMode])

  return (
    <div
      onPointerDown={a.holdStart}
      onPointerUp={a.holdEnd}
      onPointerLeave={a.holdEnd}
      onPointerCancel={a.holdEnd}
      style={{
        flex: 1,
        position: 'relative',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        minHeight: 0,
        padding: '10px 18px',
        overflow: 'hidden',
        cursor: 'pointer',
        userSelect: 'none',
        WebkitUserSelect: 'none',
        touchAction: 'none',
      }}
    >
      {d.has ? (
        <div
          style={{
            flex: 1,
            alignSelf: 'stretch',
            width: '100%',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: 0,
          }}
        >
          <div
            style={{
              flex: 'none',
              font: '600 10px/1 ui-monospace,Menlo,monospace',
              letterSpacing: '.2em',
              textTransform: 'uppercase',
              color: t.sub,
              marginBottom: 12,
              transition: 'opacity .3s ease',
              opacity: d.chromeOp,
            }}
          >
            {d.modeLabel}
          </div>

          {d.flashMode && (
            <div
              ref={flashWrapRef}
              style={{
                position: 'relative',
                flex: 1,
                width: '100%',
                minHeight: 0,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              <div
                style={{
                  position: 'relative',
                  width: '100%',
                  maxWidth: 312,
                  height: '100%',
                  overflow: 'hidden',
                  transition: 'opacity .16s ease',
                  opacity: d.paraOpacity,
                  WebkitMaskImage: MASK,
                  maskImage: MASK,
                }}
              >
                <FlowParagraph d={d} a={a} />
              </div>
              <div
                style={{
                  position: 'absolute',
                  inset: 0,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  background: t.bg,
                  transition: 'opacity .16s ease',
                  opacity: flying ? 0 : d.wordOverlayOpacity,
                  pointerEvents: 'none',
                }}
              >
                <SingleWord s={s} d={d} />
              </div>
            </div>
          )}

          {d.flowMode && (
            <div
              style={{
                position: 'relative',
                flex: 1,
                width: '100%',
                maxWidth: 312,
                minHeight: 0,
                overflow: 'hidden',
                WebkitMaskImage: MASK,
                maskImage: MASK,
              }}
            >
              <FlowParagraph d={d} a={a} />
            </div>
          )}

          {d.showHoldHint && (
            <div
              style={{
                flex: 'none',
                marginTop: 14,
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                font: '600 12px/1 sans-serif',
                color: t.sub,
                animation: 'srfade .4s ease',
              }}
            >
              <span style={{ width: 9, height: 9, borderRadius: '50%', background: t.accent }} />
              Press &amp; hold to read · or hold Space
            </div>
          )}
        </div>
      ) : (
        <EmptyState d={d} a={a} />
      )}
    </div>
  )
}

function SingleWord({ s, d }: { s: ReaderState; d: Derived }) {
  const { t } = d
  const line: CSSProperties = { position: 'absolute', left: '50%', transform: 'translateX(-50%)', width: 2, height: 16, background: t.accent, opacity: 0.8 }
  const rule: CSSProperties = { position: 'absolute', left: 0, right: 0, height: 1, background: t.border, opacity: 0.5 }
  return (
    <div
      style={{
        position: 'relative',
        width: '100%',
        height: d.bandH,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        overflow: 'hidden',
      }}
    >
      <div style={{ ...line, top: 0 }} />
      <div style={{ ...line, bottom: 0 }} />
      <div style={{ ...rule, top: 16 }} />
      <div style={{ ...rule, bottom: 16 }} />
      <div
        data-bigword
        style={{
          display: 'grid',
          gridTemplateColumns: '1fr auto 1fr',
          width: '100%',
          alignItems: 'baseline',
          fontFamily: d.fontFamily,
          fontSize: s.size,
          fontWeight: s.weight,
          lineHeight: 1,
          letterSpacing: '-.01em',
        }}
      >
        <span style={{ textAlign: 'right', whiteSpace: 'pre' }}>{d.pre}</span>
        <span style={{ color: t.accent }}>{d.pivotCh}</span>
        <span style={{ textAlign: 'left', whiteSpace: 'pre' }}>{d.post}</span>
      </div>
    </div>
  )
}

function EmptyState({ d, a }: { d: Derived; a: ReaderActions }) {
  const { t } = d
  const outlineBtn: CSSProperties = {
    font: '600 14px/1 sans-serif',
    background: 'transparent',
    border: `1px solid ${t.border}`,
    borderRadius: 12,
    padding: '14px 26px',
    cursor: 'pointer',
    minWidth: 210,
    color: t.text,
  }
  return (
    <div style={{ textAlign: 'center', animation: 'srrise .4s ease' }}>
      <div style={{ font: '400 33px/1.15 Georgia,serif', letterSpacing: '-.02em', marginBottom: 12 }}>
        Read at the <span style={{ color: t.accent }}>speed</span> of thought.
      </div>
      <p style={{ font: '400 14px/1.6 sans-serif', color: t.sub, margin: '0 auto 24px', maxWidth: 280 }}>
        One word at a time, pinned to the spot your eye already looks. Load something and press play.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, alignItems: 'center' }}>
        {d.resume && (
          <button
            onClick={() => a.openLibraryItem(d.resume!)}
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: 2,
              alignItems: 'flex-start',
              textAlign: 'left',
              minWidth: 210,
              color: t.bg,
              background: t.accent,
              border: 'none',
              borderRadius: 12,
              padding: '12px 18px',
              cursor: 'pointer',
            }}
          >
            <span style={{ font: '600 10px/1 ui-monospace,Menlo,monospace', letterSpacing: '.1em', opacity: 0.85 }}>
              CONTINUE · {d.resumePct}%
            </span>
            <span
              style={{
                font: '700 14px/1.25 sans-serif',
                maxWidth: 186,
                whiteSpace: 'nowrap',
                overflow: 'hidden',
                textOverflow: 'ellipsis',
              }}
            >
              {d.resume.title}
            </span>
          </button>
        )}
        <button onClick={a.openIntake} style={outlineBtn}>
          Add something to read
        </button>
        <button onClick={a.loadSample} style={outlineBtn}>
          Try a sample
        </button>
        <button
          onClick={a.openCalibrate}
          style={{
            font: '600 13px/1 sans-serif',
            color: t.sub,
            background: 'transparent',
            border: 'none',
            padding: 8,
            cursor: 'pointer',
          }}
        >
          Calibrate my speed →
        </button>
      </div>
    </div>
  )
}
