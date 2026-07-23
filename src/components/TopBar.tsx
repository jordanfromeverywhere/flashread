import type { Derived } from '../derive'
import type { ReaderActions } from '../useSpeedReader'

export function TopBar({ d, a }: { d: Derived; a: ReaderActions }) {
  const { t } = d
  return (
    <div
      style={{
        flex: 'none',
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: 'calc(env(safe-area-inset-top) + 14px) 20px 6px',
        transition: 'opacity .3s ease',
        opacity: d.chromeOp,
        pointerEvents: d.chromePe,
      }}
    >
      <div style={{ width: 9, height: 9, borderRadius: '50%', background: t.accent, flex: 'none' }} />
      <div
        style={{
          font: '400 12px/1.3 ui-monospace,Menlo,monospace',
          color: t.sub,
          flex: 1,
          minWidth: 0,
          whiteSpace: 'nowrap',
          overflow: 'hidden',
          textOverflow: 'ellipsis',
        }}
      >
        {d.headerTitle}
      </div>
      <button
        onClick={a.openSettings}
        title="Text options"
        style={{
          width: 42,
          height: 38,
          display: 'flex',
          alignItems: 'baseline',
          justifyContent: 'center',
          color: t.text,
          background: 'transparent',
          border: `1px solid ${t.border}`,
          borderRadius: 11,
          cursor: 'pointer',
          font: '700 16px/1 Georgia,serif',
          paddingTop: 9,
        }}
      >
        A<span style={{ fontSize: 11 }}>a</span>
      </button>
      <button
        onClick={a.quickTheme}
        title="Theme"
        style={{
          width: 38,
          height: 38,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          color: t.text,
          background: 'transparent',
          border: `1px solid ${t.border}`,
          borderRadius: 11,
          cursor: 'pointer',
          fontSize: 15,
        }}
      >
        {d.themeGlyph}
      </button>
    </div>
  )
}
