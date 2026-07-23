// Theme palette + typography. Warm, easy-on-the-eyes, dark default.
//
// Two-accent system:
//   focus / focusSoft — the RED. Reserved for the reading focal point only: the
//     ORP pivot letter, its guide ticks, and the Flow-mode current-word highlight.
//     This is "the letter thing" — the one color the eye is trained to.
//   accent / accentSoft — warm AMBER. Everything you touch: buttons, toggles,
//     tabs, sliders, the + FAB, progress, toasts, stats. Chrome, not content.
//
// Amber brightness tracks the background (bright on dark themes, deep ochre on
// light themes) so `t.bg` is always the correct high-contrast on-accent text.

export type ThemeKey = 'dark' | 'light' | 'sepia' | 'hc'

export interface Theme {
  bg: string
  panel: string
  text: string
  sub: string
  accent: string
  accentSoft: string
  focus: string
  focusSoft: string
  border: string
}

export const THEMES: Record<ThemeKey, Theme> = {
  dark: {
    bg: '#0e0d0c',
    panel: '#1a1917',
    text: '#f3efe7',
    sub: '#8f887d',
    accent: '#e0a53a',
    accentSoft: 'rgba(224,165,58,.16)',
    focus: '#e5484d',
    focusSoft: 'rgba(229,72,77,.18)',
    border: 'rgba(255,255,255,.12)',
  },
  light: {
    bg: '#f4efe6',
    panel: '#fffdf7',
    text: '#26221b',
    sub: '#6b6456',
    accent: '#9e6510',
    accentSoft: 'rgba(158,101,16,.14)',
    focus: '#cf3339',
    focusSoft: 'rgba(207,51,57,.14)',
    border: 'rgba(0,0,0,.12)',
  },
  sepia: {
    bg: '#e9ddc7',
    panel: '#f5ecd8',
    text: '#463b28',
    sub: '#6a5d3e',
    accent: '#9c5f18',
    accentSoft: 'rgba(156,95,24,.16)',
    focus: '#b04a24',
    focusSoft: 'rgba(176,74,36,.16)',
    border: 'rgba(70,59,40,.18)',
  },
  hc: {
    bg: '#000000',
    panel: '#0b0b0b',
    text: '#ffffff',
    sub: '#c9c9c9',
    accent: '#ffb02e',
    accentSoft: 'rgba(255,176,46,.22)',
    focus: '#ff3b3b',
    focusSoft: 'rgba(255,59,59,.25)',
    border: 'rgba(255,255,255,.35)',
  },
}

export const THEME_LABELS: Record<ThemeKey, string> = {
  dark: 'Dark',
  light: 'Light',
  sepia: 'Sepia',
  hc: 'OLED',
}

export const THEME_ORDER: ThemeKey[] = ['dark', 'light', 'sepia', 'hc']

export type FontKey = 'sans' | 'serif' | 'mono' | 'legible'

export const FONTS: Record<FontKey, { label: string; family: string }> = {
  sans: { label: 'Sans', family: "'Helvetica Neue',Helvetica,Arial,sans-serif" },
  serif: { label: 'Serif', family: "Georgia,'Times New Roman',serif" },
  mono: { label: 'Mono', family: "ui-monospace,'SF Mono',Menlo,monospace" },
  legible: { label: 'Legible', family: "'Atkinson Hyperlegible',sans-serif" },
}

export const PAUSE_SCALE: Record<string, number> = { subtle: 0.6, natural: 1, long: 1.6 }

export function isDarkTheme(theme: ThemeKey): boolean {
  return theme === 'dark' || theme === 'hc'
}
