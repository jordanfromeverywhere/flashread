// Shared inline-style helpers, matching the prototype's pill / toggle look.
import type { CSSProperties } from 'react'
import type { Theme } from '../lib/theme'

export function pillStyle(t: Theme, on: boolean): CSSProperties {
  return {
    font: '600 12.5px/1 sans-serif',
    padding: '11px 15px',
    borderRadius: 9,
    cursor: 'pointer',
    border: `1px solid ${on ? t.accent : t.border}`,
    color: on ? t.bg : t.text,
    background: on ? t.accent : 'transparent',
  }
}

export function tabStyle(t: Theme, on: boolean): CSSProperties {
  return {
    font: '600 12px/1 sans-serif',
    padding: '9px 13px',
    borderRadius: 9,
    cursor: 'pointer',
    border: `1px solid ${on ? t.accent : t.border}`,
    color: on ? t.bg : t.text,
    background: on ? t.accent : 'transparent',
  }
}

export function fontPillStyle(t: Theme, family: string, on: boolean): CSSProperties {
  return {
    font: `600 13px/1 ${family}`,
    padding: '11px 15px',
    borderRadius: 9,
    cursor: 'pointer',
    border: `1px solid ${on ? t.accent : t.border}`,
    color: on ? t.bg : t.text,
    background: on ? t.accent : 'transparent',
  }
}

export function switchTrack(t: Theme, on: boolean): CSSProperties {
  return {
    width: 44,
    height: 26,
    borderRadius: 20,
    background: on ? t.accent : t.border,
    position: 'relative',
    flex: 'none',
    transition: 'background .15s',
  }
}

export function switchKnob(on: boolean): CSSProperties {
  return {
    position: 'absolute',
    top: 2,
    left: on ? 20 : 2,
    width: 22,
    height: 22,
    borderRadius: '50%',
    background: '#fff',
    transition: 'left .15s',
  }
}
