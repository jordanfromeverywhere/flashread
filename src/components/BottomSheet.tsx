import type { Derived } from '../derive'
import type { PanelKey, ReaderActions, ReaderState } from '../useSpeedReader'
import { IntakePanel } from './panels/IntakePanel'
import { LibraryPanel } from './panels/LibraryPanel'
import { SettingsPanel } from './panels/SettingsPanel'
import { CalibratePanel } from './panels/CalibratePanel'
import { StatsPanel } from './panels/StatsPanel'

const TITLES: Record<Exclude<PanelKey, null>, string> = {
  intake: 'Add to read',
  library: 'Library',
  settings: 'Settings',
  stats: 'Your reading',
  calibrate: 'Calibrate speed',
}

export function BottomSheet({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  if (!s.panel) return null
  const { t } = d
  return (
    <>
      <div
        onClick={a.closePanel}
        style={{
          position: 'absolute',
          inset: 0,
          zIndex: 80,
          background: 'rgba(0,0,0,.45)',
          backdropFilter: 'blur(2px)',
          animation: 'srfade .2s ease',
        }}
      />
      <div
        style={{
          position: 'absolute',
          left: 0,
          right: 0,
          bottom: 0,
          zIndex: 81,
          height: '90%',
          background: t.panel,
          borderRadius: '24px 24px 0 0',
          boxShadow: '0 -12px 40px rgba(0,0,0,.3)',
          display: 'flex',
          flexDirection: 'column',
          animation: 'srsheet .28s cubic-bezier(.32,.72,0,1)',
          overflow: 'hidden',
          color: t.text,
        }}
      >
        <div style={{ flex: 'none', display: 'flex', alignItems: 'center', padding: '12px 20px 10px' }}>
          <div
            style={{
              position: 'absolute',
              left: '50%',
              top: 8,
              transform: 'translateX(-50%)',
              width: 38,
              height: 5,
              borderRadius: 3,
              background: t.border,
            }}
          />
          <div style={{ font: '700 19px/1 sans-serif', letterSpacing: '-.01em', marginTop: 6 }}>
            {TITLES[s.panel]}
          </div>
          <button
            onClick={a.closePanel}
            style={{
              marginLeft: 'auto',
              marginTop: 6,
              width: 34,
              height: 34,
              borderRadius: 10,
              border: 'none',
              background: t.border,
              color: t.text,
              cursor: 'pointer',
              fontSize: 16,
            }}
          >
            ✕
          </button>
        </div>
        <div style={{ flex: 1, overflow: 'auto', padding: '8px 20px 44px' }}>
          {s.panel === 'intake' && <IntakePanel s={s} d={d} a={a} />}
          {s.panel === 'library' && <LibraryPanel s={s} d={d} a={a} />}
          {s.panel === 'settings' && <SettingsPanel s={s} d={d} a={a} />}
          {s.panel === 'calibrate' && <CalibratePanel s={s} d={d} a={a} />}
          {s.panel === 'stats' && <StatsPanel s={s} d={d} />}
        </div>
      </div>
    </>
  )
}
