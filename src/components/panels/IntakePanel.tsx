import type { CSSProperties } from 'react'
import type { Derived } from '../../derive'
import type { ReaderActions, ReaderState } from '../../useSpeedReader'
import { tokenize } from '../../lib/engine'
import { buildBookmarklet } from '../../lib/intake'
import { STARTERS } from '../../lib/content'
import { tabStyle } from '../ui'

const BOOKMARKLET = buildBookmarklet()
const INTAKE_TABS: [ReaderState['intakeTab'], string][] = [
  ['paste', 'Paste'],
  ['pdf', 'PDF'],
  ['url', 'Web'],
]

export function IntakePanel({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  const { t } = d
  const field: CSSProperties = {
    border: `1px solid ${t.border}`,
    background: t.bg,
    color: t.text,
    outline: 'none',
  }
  return (
    <div>
      <div style={{ display: 'flex', gap: 6, marginBottom: 16 }}>
        {INTAKE_TABS.map(([k, label]) => (
          <button key={k} onClick={() => a.setTab(k)} style={tabStyle(t, s.intakeTab === k)}>
            {label}
          </button>
        ))}
      </div>

      {s.intakeTab === 'paste' && (
        <div>
          <textarea
            value={s.pasteText}
            onInput={a.onPaste}
            onChange={a.onPaste}
            placeholder="Paste or type anything — an article, a chapter, your notes…"
            style={{
              ...field,
              width: '100%',
              height: 160,
              resize: 'none',
              padding: 14,
              borderRadius: 12,
              font: '400 14px/1.6 Georgia,serif',
            }}
          />
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 10 }}>
            <button
              onClick={a.toggleVoice}
              style={{
                font: '600 12.5px/1 sans-serif',
                padding: '11px 15px',
                borderRadius: 9,
                cursor: 'pointer',
                border: `1px solid ${s.voiceOn ? t.accent : t.border}`,
                background: s.voiceOn ? t.accent : 'transparent',
                color: s.voiceOn ? '#fff' : t.text,
                flex: 'none',
              }}
            >
              {s.voiceOn ? 'Stop ●' : 'Dictate'}
            </button>
            <span style={{ font: '400 11.5px/1.4 sans-serif', color: t.sub, flex: 1 }}>{s.voiceHint}</span>
            <span style={{ font: '500 10px/1 ui-monospace,Menlo,monospace', color: t.sub }}>
              {tokenize(s.pasteText).length} words
            </span>
          </div>
        </div>
      )}

      {s.intakeTab === 'pdf' && (
        <div>
          <label
            style={{
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              justifyContent: 'center',
              gap: 8,
              height: 170,
              border: `1.5px dashed ${t.border}`,
              borderRadius: 14,
              cursor: 'pointer',
              color: t.sub,
            }}
          >
            <div style={{ width: 36, height: 44, border: `2px solid ${t.text}`, borderRadius: 5 }} />
            <div style={{ font: '600 14px/1 sans-serif', color: t.text }}>Choose a PDF</div>
            <div style={{ font: '400 11.5px/1.4 sans-serif', textAlign: 'center', maxWidth: 230 }}>
              Extracted in your browser — nothing is uploaded.
            </div>
            <input type="file" accept="application/pdf" onChange={a.onPdf} style={{ display: 'none' }} />
          </label>
          <div style={{ marginTop: 12, font: '400 12.5px/1.5 sans-serif', color: t.sub }}>{s.pdfStatus}</div>
        </div>
      )}

      {s.intakeTab === 'url' && (
        <div>
          <div style={{ display: 'flex', gap: 8 }}>
            <input
              value={s.urlText}
              onInput={a.onUrl}
              onChange={a.onUrl}
              placeholder="https://example.com/article"
              style={{ ...field, flex: 1, padding: '13px 14px', borderRadius: 11, font: '400 14px/1 sans-serif' }}
            />
            <button
              onClick={a.fetchUrl}
              style={{
                font: '600 13px/1 sans-serif',
                color: t.bg,
                background: t.text,
                border: 'none',
                borderRadius: 11,
                padding: '0 18px',
                cursor: 'pointer',
              }}
            >
              Fetch
            </button>
          </div>
          <div style={{ marginTop: 12, font: '400 12.5px/1.5 sans-serif', color: t.sub }}>{s.urlStatus}</div>
          <div style={{ marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
            <div style={{ font: '700 13px/1 sans-serif', marginBottom: 7 }}>Bookmarklet fallback</div>
            <p style={{ font: '400 12px/1.6 sans-serif', color: t.sub, margin: '0 0 10px' }}>
              Many sites block direct fetching. On a computer, drag this to your bookmarks bar, click it on any
              article, and its text is copied — then paste it here.
            </p>
            <a
              href={BOOKMARKLET}
              onClick={(e) => e.preventDefault()}
              style={{
                display: 'inline-block',
                font: '600 12.5px/1 sans-serif',
                color: t.accent,
                border: `1px solid ${t.accent}`,
                borderRadius: 9,
                padding: '10px 15px',
                textDecoration: 'none',
              }}
            >
              Grab article → Flashread
            </a>
          </div>
        </div>
      )}

      <div style={{ display: 'flex', gap: 10, marginTop: 18, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
        <input
          value={s.draftTitle}
          onInput={a.onDraftTitle}
          onChange={a.onDraftTitle}
          placeholder="Title (optional)"
          style={{ ...field, flex: 1, padding: 13, borderRadius: 11, font: '400 13px/1 sans-serif' }}
        />
        <button
          onClick={a.startReading}
          style={{
            font: '600 13px/1 sans-serif',
            color: t.bg,
            background: t.accent,
            border: 'none',
            borderRadius: 11,
            padding: '0 20px',
            cursor: 'pointer',
          }}
        >
          Read →
        </button>
      </div>

      <div style={{ marginTop: 20, paddingTop: 16, borderTop: `1px solid ${t.border}` }}>
        <div
          style={{
            font: '600 11px/1 ui-monospace,Menlo,monospace',
            color: t.sub,
            textTransform: 'uppercase',
            letterSpacing: '.05em',
            marginBottom: 6,
          }}
        >
          A place to start
        </div>
        {STARTERS.map((sx, i) => (
          <div
            key={i}
            onClick={() => a.loadStarter(i)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 12,
              padding: '13px 2px',
              borderBottom: `1px solid ${t.border}`,
              cursor: 'pointer',
            }}
          >
            <div style={{ flex: 1, minWidth: 0 }}>
              <div style={{ font: '600 14px/1.3 sans-serif' }}>{sx.title}</div>
              <div style={{ font: '400 11px/1 ui-monospace,Menlo,monospace', color: t.sub, marginTop: 4 }}>
                {sx.meta}
              </div>
            </div>
            <div style={{ font: '600 12px/1 sans-serif', color: t.accent, flex: 'none' }}>Read →</div>
          </div>
        ))}
      </div>
    </div>
  )
}
