import type { Derived } from '../derive'
import type { ReaderActions, ReaderState } from '../useSpeedReader'

export function Toast({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  if (!s.toast) return null
  const { t } = d
  return (
    <div
      onClick={a.dismissToast}
      style={{
        position: 'absolute',
        top: 'calc(env(safe-area-inset-top) + 20px)',
        left: '50%',
        transform: 'translateX(-50%)',
        zIndex: 90,
        display: 'flex',
        alignItems: 'center',
        gap: 11,
        padding: '11px 16px',
        borderRadius: 14,
        background: t.accent,
        color: t.bg,
        boxShadow: '0 12px 34px rgba(0,0,0,.4)',
        animation: 'srtoast .32s cubic-bezier(.32,.72,0,1)',
        maxWidth: 310,
        cursor: 'pointer',
      }}
    >
      <span style={{ fontSize: 15 }}>✦</span>
      <div>
        <div style={{ font: '700 13.5px/1.2 sans-serif' }}>{s.toast.title}</div>
        <div style={{ font: '500 11px/1.3 sans-serif', opacity: 0.85 }}>{s.toast.sub}</div>
      </div>
    </div>
  )
}
