import type { CSSProperties, ReactNode } from 'react'
import type { Derived } from '../derive'
import type { ReaderActions, ReaderState } from '../useSpeedReader'

// Bottom rail, refined to three real destinations: Library · Add · More.
// Reading is the ground state (no "Read" tab — the canvas IS reading), and the
// rare Stats/Settings/Calibrate live behind More. While reading in Focus mode
// the whole rail collapses OUT of the layout (not just fades), so the canvas
// reclaims the space and the buttons leave the accessibility tree.
export function TabBar({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  const { t } = d
  const hidden = d.chromeHidden
  const libActive = s.panel === 'library'
  const moreActive =
    s.panel === 'more' || s.panel === 'stats' || s.panel === 'settings' || s.panel === 'calibrate'

  const tab = (active: boolean, onClick: () => void, label: string, icon: ReactNode) => {
    const btn: CSSProperties = {
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 3,
      background: 'none',
      border: 'none',
      cursor: 'pointer',
      padding: '6px 10px',
      minWidth: 64,
      minHeight: 44,
      color: active ? t.accent : t.sub,
    }
    return (
      <button onClick={onClick} aria-label={label} aria-current={active ? 'page' : undefined} style={btn}>
        {icon}
        <span style={{ font: '600 10px/1 sans-serif' }}>{label}</span>
      </button>
    )
  }

  return (
    <div
      aria-hidden={hidden}
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-around',
        overflow: 'hidden',
        maxHeight: hidden ? 0 : 120,
        padding: hidden ? '0 12px' : '9px 12px calc(env(safe-area-inset-bottom) + 12px)',
        borderTop: `1px solid ${hidden ? 'transparent' : t.border}`,
        background: t.panel,
        opacity: d.chromeOp,
        pointerEvents: d.chromePe,
        transition: 'max-height .3s ease, padding .3s ease, opacity .3s ease',
      }}
    >
      {tab(
        libActive,
        a.openLibrary,
        'Library',
        <svg width="22" height="22" viewBox="0 0 22 22">
          <rect x="3" y="5" width="16" height="2.2" rx="1.1" fill="currentColor" />
          <rect x="3" y="9.9" width="16" height="2.2" rx="1.1" fill="currentColor" />
          <rect x="3" y="14.8" width="16" height="2.2" rx="1.1" fill="currentColor" />
        </svg>,
      )}

      <button
        onClick={a.openIntake}
        aria-label="Add text"
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 7,
          background: t.accent,
          color: t.bg,
          border: 'none',
          borderRadius: 12,
          padding: '0 18px',
          minHeight: 44,
          cursor: 'pointer',
          font: '600 13px/1 sans-serif',
        }}
      >
        <svg width="16" height="16" viewBox="0 0 24 24">
          <rect x="11" y="5" width="2.4" height="14" rx="1.2" fill={t.bg} />
          <rect x="5" y="10.8" width="14" height="2.4" rx="1.2" fill={t.bg} />
        </svg>
        Add
      </button>

      {tab(
        moreActive,
        a.openMore,
        'More',
        <svg width="22" height="22" viewBox="0 0 22 22">
          <circle cx="5" cy="11" r="2" fill="currentColor" />
          <circle cx="11" cy="11" r="2" fill="currentColor" />
          <circle cx="17" cy="11" r="2" fill="currentColor" />
        </svg>,
      )}
    </div>
  )
}
