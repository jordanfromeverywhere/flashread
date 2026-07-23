import type { Derived } from '../../derive'
import type { ReaderState } from '../../useSpeedReader'

export function StatsPanel({ s, d }: { s: ReaderState; d: Derived }) {
  const { t } = d
  const st = s.stats
  const mins = Math.round((st.timeMs || 0) / 60000)
  const statCards = [
    { value: (st.wordsRead || 0).toLocaleString(), label: 'Words read' },
    { value: mins + 'm', label: 'Time reading' },
    { value: st.sessions || 0, label: 'Sessions' },
    { value: st.streak || 0, label: 'Day streak' },
  ]
  const hist = st.history || []
  const maxW = Math.max(300, ...hist.map((h) => h.wpm))
  const wpmBars = hist.map((h) => ({ h: Math.round((h.wpm / maxW) * 88) + '%', title: h.wpm + ' WPM' }))

  return (
    <div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12, marginBottom: 22 }}>
        {statCards.map((c, i) => (
          <div key={i} style={{ padding: 16, border: `1px solid ${t.border}`, borderRadius: 14 }}>
            <div style={{ font: '700 26px/1 ui-monospace,Menlo,monospace', color: t.accent }}>{c.value}</div>
            <div style={{ font: '500 11px/1.3 sans-serif', color: t.sub, marginTop: 6 }}>{c.label}</div>
          </div>
        ))}
      </div>

      <div
        style={{
          font: '600 11px/1 ui-monospace,Menlo,monospace',
          color: t.sub,
          textTransform: 'uppercase',
          letterSpacing: '.05em',
          marginBottom: 11,
        }}
      >
        Recent WPM
      </div>
      <div
        style={{
          display: 'flex',
          alignItems: 'flex-end',
          gap: 5,
          height: 100,
          padding: 10,
          border: `1px solid ${t.border}`,
          borderRadius: 14,
        }}
      >
        {hist.length === 0 ? (
          <div style={{ margin: 'auto', font: '400 12.5px/1 sans-serif', color: t.sub }}>
            Finish a read to start tracking.
          </div>
        ) : (
          wpmBars.map((b, i) => (
            <div
              key={i}
              title={b.title}
              style={{
                flex: 1,
                background: t.accent,
                borderRadius: '3px 3px 0 0',
                height: b.h,
                minHeight: 4,
                opacity: 0.85,
              }}
            />
          ))
        )}
      </div>
    </div>
  )
}
