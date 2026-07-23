import type { CSSProperties } from 'react'
import type { Derived } from '../../derive'
import type { ReaderActions } from '../../useSpeedReader'

// Catch-all sheet for the low-frequency destinations, reached from the bottom
// bar's "More" tab. Each row just re-points s.panel via an existing action, so
// selecting a destination swaps this list out for that panel.
export function MorePanel({ d, a }: { d: Derived; a: ReaderActions }) {
  const { t } = d
  const rows: { label: string; sub: string; onClick: () => void }[] = [
    { label: 'Stats', sub: 'Words, time, streak & recent speed', onClick: a.openStats },
    { label: 'Calibrate speed', sub: 'Find the WPM you can sustain', onClick: a.openCalibrate },
    { label: 'Settings', sub: 'Theme, typeface, reading mode & more', onClick: a.openSettings },
  ]
  const row: CSSProperties = {
    display: 'flex',
    alignItems: 'center',
    gap: 12,
    width: '100%',
    textAlign: 'left',
    padding: '15px 2px',
    borderBottom: `1px solid ${t.border}`,
    background: 'transparent',
    border: 'none',
    borderBottomStyle: 'solid',
    cursor: 'pointer',
    color: t.text,
  }
  return (
    <div>
      {rows.map((r) => (
        <button key={r.label} onClick={r.onClick} style={row}>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ font: '600 15px/1.3 sans-serif' }}>{r.label}</div>
            <div style={{ font: '400 12px/1.4 sans-serif', color: t.sub, marginTop: 3 }}>{r.sub}</div>
          </div>
          <div style={{ font: '400 18px/1 sans-serif', color: t.sub, flex: 'none' }}>›</div>
        </button>
      ))}
    </div>
  )
}
