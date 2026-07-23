import type { Derived } from '../../derive'
import type { ReaderActions, ReaderState } from '../../useSpeedReader'

export function CalibratePanel({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  const { t } = d
  return (
    <div style={{ textAlign: 'center', paddingTop: 10 }}>
      {s.cal === 'idle' && (
        <div>
          <p style={{ font: '400 14px/1.6 sans-serif', color: t.sub, margin: '0 auto 22px', maxWidth: 300 }}>
            A fixed passage plays at a chosen pace. Keep up with comprehension? Bump it up. Land on the speed you can
            sustain.
          </p>
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 12,
              marginBottom: 24,
              color: t.accent,
            }}
          >
            <input
              type="range"
              min={150}
              max={800}
              step={25}
              value={s.calWpm}
              onInput={a.onCalWpm}
              onChange={a.onCalWpm}
              style={{ width: 180, color: t.accent }}
            />
            <span style={{ font: '700 16px/1 ui-monospace,Menlo,monospace', color: t.accent, width: 56, textAlign: 'left' }}>
              {s.calWpm}
            </span>
          </div>
          <button
            onClick={a.runCalibration}
            style={{
              font: '600 14px/1 sans-serif',
              color: t.bg,
              background: t.accent,
              border: 'none',
              borderRadius: 12,
              padding: '15px 30px',
              cursor: 'pointer',
            }}
          >
            Run test
          </button>
        </div>
      )}

      {s.cal === 'running' && (
        <div style={{ padding: '30px 0' }}>
          <div
            style={{
              display: 'grid',
              gridTemplateColumns: '1fr auto 1fr',
              alignItems: 'baseline',
              fontFamily: d.fontFamily,
              fontSize: 46,
              fontWeight: s.weight,
              lineHeight: 1,
            }}
          >
            <span style={{ textAlign: 'right', whiteSpace: 'pre' }}>{s.calPre}</span>
            <span style={{ color: t.accent }}>{s.calPivot}</span>
            <span style={{ textAlign: 'left', whiteSpace: 'pre' }}>{s.calPost}</span>
          </div>
          <div style={{ marginTop: 34, font: '500 12px/1 ui-monospace,Menlo,monospace', color: t.sub }}>
            {s.calWpm} WPM
          </div>
        </div>
      )}

      {s.cal === 'done' && (
        <div style={{ paddingTop: 16 }}>
          <p style={{ font: '400 15px/1.6 sans-serif', margin: '0 0 6px' }}>You read that at</p>
          <div style={{ font: '700 50px/1 ui-monospace,Menlo,monospace', color: t.accent, marginBottom: 8 }}>
            {s.calWpm}
          </div>
          <p style={{ font: '400 13px/1.5 sans-serif', color: t.sub, margin: '0 auto 24px', maxWidth: 260 }}>
            Comfortable? Set it. Felt rushed? Run again slower.
          </p>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
            <button
              onClick={a.acceptCal}
              style={{
                font: '600 13px/1 sans-serif',
                color: t.bg,
                background: t.accent,
                border: 'none',
                borderRadius: 11,
                padding: '14px 20px',
                cursor: 'pointer',
              }}
            >
              Use {s.calWpm} WPM
            </button>
            <button
              onClick={a.resetCal}
              style={{
                font: '600 13px/1 sans-serif',
                color: t.text,
                background: 'transparent',
                border: `1px solid ${t.border}`,
                borderRadius: 11,
                padding: '14px 20px',
                cursor: 'pointer',
              }}
            >
              Again
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
