import type { Derived } from '../../derive'
import type { ReaderActions, ReaderState } from '../../useSpeedReader'

export function LibraryPanel({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  const { t } = d
  if (s.library.length === 0) {
    return (
      <div style={{ textAlign: 'center', padding: '44px 20px', color: t.sub, font: '400 14px/1.6 sans-serif' }}>
        Nothing saved yet.
        <br />
        Anything you read is kept here with your exact position.
      </div>
    )
  }
  return (
    <div>
      {s.library.map((it) => {
        const p = it.count ? Math.round((it.idx || 0) / it.count * 100) : 0
        const cta = p > 0 && p < 100 ? 'Resume' : p >= 100 ? 'Reread' : 'Read'
        const editing = s.renameId === it.id
        return (
          <div
            key={it.id}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              padding: '14px 2px',
              borderBottom: `1px solid ${t.border}`,
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              {editing ? (
                <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                  <input
                    value={s.renameText}
                    onInput={a.renameChange}
                    onChange={a.renameChange}
                    style={{
                      flex: 1,
                      minWidth: 0,
                      padding: '9px 10px',
                      borderRadius: 8,
                      border: `1px solid ${t.accent}`,
                      background: t.bg,
                      color: t.text,
                      font: '600 13px/1 sans-serif',
                      outline: 'none',
                    }}
                  />
                  <button
                    onClick={a.renameSave}
                    style={{
                      font: '600 12px/1 sans-serif',
                      color: t.bg,
                      background: t.accent,
                      border: 'none',
                      borderRadius: 8,
                      padding: '10px 13px',
                      cursor: 'pointer',
                      flex: 'none',
                    }}
                  >
                    Save
                  </button>
                </div>
              ) : (
                <div onClick={() => a.openLibraryItem(it)} style={{ cursor: 'pointer' }}>
                  <div
                    style={{
                      font: '600 14.5px/1.3 sans-serif',
                      whiteSpace: 'nowrap',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                    }}
                  >
                    {it.title}
                  </div>
                  <div style={{ font: '400 11px/1 ui-monospace,Menlo,monospace', color: t.sub, marginTop: 5 }}>
                    {(it.count || 0) + ' words · ' + p + '% read'}
                  </div>
                  <div
                    style={{ height: 4, borderRadius: 3, background: t.border, marginTop: 8, position: 'relative' }}
                  >
                    <div
                      style={{
                        position: 'absolute',
                        left: 0,
                        top: 0,
                        bottom: 0,
                        width: p + '%',
                        background: t.accent,
                        borderRadius: 3,
                      }}
                    />
                  </div>
                </div>
              )}
            </div>
            {!editing && (
              <>
                <button
                  onClick={() => a.renameStart(it.id, it.title)}
                  title="Rename"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: `1px solid ${t.border}`,
                    background: 'transparent',
                    color: t.sub,
                    cursor: 'pointer',
                    flex: 'none',
                    fontSize: 13,
                  }}
                >
                  ✎
                </button>
                <button
                  onClick={() => a.openLibraryItem(it)}
                  style={{
                    font: '600 12px/1 sans-serif',
                    color: t.bg,
                    background: t.text,
                    border: 'none',
                    borderRadius: 9,
                    padding: '10px 12px',
                    cursor: 'pointer',
                    flex: 'none',
                  }}
                >
                  {cta}
                </button>
                <button
                  onClick={() => a.removeLibraryItem(it.id)}
                  title="Delete"
                  style={{
                    width: 34,
                    height: 34,
                    borderRadius: 9,
                    border: `1px solid ${t.border}`,
                    background: 'transparent',
                    color: t.sub,
                    cursor: 'pointer',
                    flex: 'none',
                  }}
                >
                  ✕
                </button>
              </>
            )}
          </div>
        )
      })}
    </div>
  )
}
