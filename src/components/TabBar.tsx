import type { Derived } from '../derive'
import type { ReaderActions, ReaderState } from '../useSpeedReader'

export function TabBar({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  const { t } = d
  const tabc = (active: boolean) => (active ? t.accent : t.sub)
  const label = { font: '600 10px/1 sans-serif' } as const
  const btn = {
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: 3,
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    padding: '2px 6px',
  } as const

  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'space-around',
        padding: '9px 12px calc(env(safe-area-inset-bottom) + 12px)',
        borderTop: `1px solid ${t.border}`,
        background: t.panel,
        transition: 'opacity .3s ease',
        opacity: d.chromeOp,
        pointerEvents: d.chromePe,
      }}
    >
      <button onClick={a.openReadTab} style={{ ...btn, color: tabc(!s.panel) }}>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <rect x="4" y="3.5" width="14" height="15" rx="1.6" fill="none" stroke="currentColor" strokeWidth="1.7" />
          <line x1="11" y1="3.5" x2="11" y2="18.5" stroke="currentColor" strokeWidth="1.7" />
        </svg>
        <span style={label}>Read</span>
      </button>
      <button onClick={a.openLibrary} style={{ ...btn, color: tabc(s.panel === 'library') }}>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <rect x="3" y="5" width="16" height="2.2" rx="1.1" fill="currentColor" />
          <rect x="3" y="9.9" width="16" height="2.2" rx="1.1" fill="currentColor" />
          <rect x="3" y="14.8" width="16" height="2.2" rx="1.1" fill="currentColor" />
        </svg>
        <span style={label}>Library</span>
      </button>
      <button
        onClick={a.openIntake}
        title="Add text"
        style={{
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          background: 'none',
          border: 'none',
          cursor: 'pointer',
          padding: '0 6px',
          marginTop: -14,
        }}
      >
        <div
          style={{
            width: 52,
            height: 52,
            borderRadius: 17,
            background: t.accent,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            boxShadow: '0 6px 16px rgba(0,0,0,.25)',
          }}
        >
          <svg width="24" height="24" viewBox="0 0 24 24">
            <rect x="11" y="5" width="2.4" height="14" rx="1.2" fill={t.bg} />
            <rect x="5" y="10.8" width="14" height="2.4" rx="1.2" fill={t.bg} />
          </svg>
        </div>
      </button>
      <button onClick={a.openStats} style={{ ...btn, color: tabc(s.panel === 'stats') }}>
        <svg width="22" height="22" viewBox="0 0 22 22">
          <rect x="3" y="11" width="3.6" height="8" rx="1.2" fill="currentColor" />
          <rect x="9.2" y="6" width="3.6" height="13" rx="1.2" fill="currentColor" />
          <rect x="15.4" y="3" width="3.6" height="16" rx="1.2" fill="currentColor" />
        </svg>
        <span style={label}>Stats</span>
      </button>
      <button
        onClick={a.openSettings}
        style={{ ...btn, color: tabc(s.panel === 'settings' || s.panel === 'calibrate') }}
      >
        <svg width="22" height="22" viewBox="0 0 22 22">
          <line x1="3" y1="7" x2="19" y2="7" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="8" cy="7" r="2.8" fill="currentColor" />
          <line x1="3" y1="15" x2="19" y2="15" stroke="currentColor" strokeWidth="1.8" />
          <circle cx="14" cy="15" r="2.8" fill="currentColor" />
        </svg>
        <span style={label}>Settings</span>
      </button>
    </div>
  )
}
