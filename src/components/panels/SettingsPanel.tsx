import type { CSSProperties } from 'react'
import type { Derived } from '../../derive'
import type { ReaderActions, ReaderState } from '../../useSpeedReader'
import { FONTS, THEME_LABELS, THEME_ORDER } from '../../lib/theme'
import type { FontKey } from '../../lib/theme'
import { curateVoices } from '../../lib/voices'
import { fontPillStyle, pillStyle, switchKnob, switchTrack } from '../ui'

const sectionLabel: CSSProperties = {
  font: '600 11px/1 ui-monospace,Menlo,monospace',
  textTransform: 'uppercase',
  letterSpacing: '.05em',
  marginBottom: 11,
}
const CHUNKS = [1, 2, 3]
const PAUSES: [string, string][] = [
  ['subtle', 'Subtle'],
  ['natural', 'Natural'],
  ['long', 'Long'],
]
const MODES: ['flash' | 'flow', string][] = [
  ['flash', 'Flash — one word'],
  ['flow', 'Flow — guided highlight'],
]

function Toggle({
  t,
  on,
  title,
  desc,
  onClick,
}: {
  t: Derived['t']
  on: boolean
  title: string
  desc: string
  onClick: () => void
}) {
  return (
    <label style={{ display: 'flex', alignItems: 'center', gap: 12, cursor: 'pointer' }} onClick={onClick}>
      <div style={switchTrack(t, on)}>
        <div style={switchKnob(on)} />
      </div>
      <div>
        <div style={{ font: '600 13.5px/1.2 sans-serif' }}>{title}</div>
        <div style={{ font: '400 11.5px/1.35 sans-serif', color: t.sub }}>{desc}</div>
      </div>
    </label>
  )
}

export function SettingsPanel({ s, d, a }: { s: ReaderState; d: Derived; a: ReaderActions }) {
  const { t } = d
  const enVoices = curateVoices(s.voices || []).slice(0, 6)
  const voiceOpts = [{ label: 'Auto — best', uri: '', active: !s.voiceURI }].concat(
    enVoices.map((v) => ({
      label:
        (v.name || 'Voice').replace(/\s*\(.*\)/, '').trim() +
        (/(enhanced|premium|neural|natural)/i.test(v.name || '') ? ' ✦' : ''),
      uri: v.voiceURI,
      active: s.voiceURI === v.voiceURI,
    })),
  )
  const label = { ...sectionLabel, color: t.sub }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 22 }}>
      <div>
        <div style={label}>Theme</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {THEME_ORDER.map((k) => (
            <button key={k} onClick={() => a.setTheme(k)} style={pillStyle(t, s.theme === k)}>
              {THEME_LABELS[k]}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={label}>Typeface</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {(Object.keys(FONTS) as FontKey[]).map((k) => (
            <button key={k} onClick={() => a.setFont(k)} style={fontPillStyle(t, FONTS[k].family, s.font === k)}>
              {FONTS[k].label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={label}>Reading mode</div>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {MODES.map(([k, l]) => (
            <button key={k} onClick={() => a.setMode(k)} style={pillStyle(t, s.readMode === k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      <div style={{ display: 'flex', gap: 22 }}>
        <div style={{ flex: 1 }}>
          <div style={{ ...label, display: 'flex', justifyContent: 'space-between' }}>
            <span>Size</span>
            <span>{s.size}</span>
          </div>
          <input type="range" min={24} max={72} step={2} value={s.size} onInput={a.onSize} onChange={a.onSize} style={{ width: '100%', color: t.accent }} />
        </div>
        <div style={{ flex: 1 }}>
          <div style={{ ...label, display: 'flex', justifyContent: 'space-between' }}>
            <span>Weight</span>
            <span>{s.weight}</span>
          </div>
          <input type="range" min={300} max={800} step={100} value={s.weight} onInput={a.onWeight} onChange={a.onWeight} style={{ width: '100%', color: t.accent }} />
        </div>
      </div>

      <div>
        <div style={label}>Words per flash</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {CHUNKS.map((c) => (
            <button key={c} onClick={() => a.setChunk(c)} style={pillStyle(t, s.chunk === c)}>
              {c + (c === 1 ? ' word' : ' words')}
            </button>
          ))}
        </div>
      </div>

      <div>
        <div style={label}>Pause length at punctuation</div>
        <div style={{ display: 'flex', gap: 8 }}>
          {PAUSES.map(([k, l]) => (
            <button key={k} onClick={() => a.setPause(k)} style={pillStyle(t, s.pauseScale === k)}>
              {l}
            </button>
          ))}
        </div>
      </div>

      {enVoices.length > 0 && (
        <div>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 11 }}>
            <div style={{ ...sectionLabel, marginBottom: 0, color: t.sub }}>Narration voice</div>
            <button
              onClick={a.previewVoice}
              style={{
                font: '600 11px/1 sans-serif',
                color: t.accent,
                background: 'transparent',
                border: `1px solid ${t.accent}`,
                borderRadius: 8,
                padding: '7px 11px',
                cursor: 'pointer',
              }}
            >
              Preview
            </button>
          </div>
          <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
            {voiceOpts.map((v, i) => (
              <button key={i} onClick={() => a.setVoice(v.uri)} style={pillStyle(t, v.active)}>
                {v.label}
              </button>
            ))}
          </div>
          <div style={{ font: '400 11px/1.4 sans-serif', color: t.sub, marginTop: 8 }}>
            Uses the best voice your device provides, generated on-device as you read. Voices marked ✦ are the
            highest quality.
          </div>
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
        <Toggle
          t={t}
          on={s.adaptive}
          onClick={a.togglePacing}
          title="Adaptive pacing"
          desc="Long & complex words linger, sentence ends breathe, short words fly."
        />
        <Toggle
          t={t}
          on={s.easeIn}
          onClick={a.toggleEase}
          title="Ease-in ramp"
          desc="Each session starts slower and accelerates to your target."
        />
        <Toggle
          t={t}
          on={s.focusMode}
          onClick={a.toggleFocus}
          title="Focus mode"
          desc="Fade the controls while playing. Tap the screen to bring them back."
        />
      </div>

      <button
        onClick={a.openCalibrate}
        style={{
          font: '600 13.5px/1 sans-serif',
          color: t.text,
          background: 'transparent',
          border: `1px solid ${t.border}`,
          borderRadius: 12,
          padding: 14,
          cursor: 'pointer',
        }}
      >
        Calibrate my reading speed
      </button>
      <div style={{ font: '400 11px/1.5 sans-serif', color: t.sub }}>Offline: {s.swStatus}</div>
    </div>
  )
}
