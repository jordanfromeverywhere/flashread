// Theme palette + typography. Ported verbatim from the Claude Design prototype
// so colors stay pixel-identical: warm, easy-on-the-eyes, red accent, dark default.

export type ThemeKey = 'dark' | 'light' | 'sepia' | 'hc'

export interface Theme {
  bg: string
  panel: string
  text: string
  sub: string
  accent: string
  accentSoft: string
  border: string
}

export const THEMES: Record<ThemeKey, Theme> = {
  dark: {
    bg: '#0e0d0c',
    panel: '#1a1917',
    text: '#f3efe7',
    sub: '#8f887d',
    accent: '#e5484d',
    accentSoft: 'rgba(229,72,77,.18)',
    border: 'rgba(255,255,255,.12)',
  },
  light: {
    bg: '#f4efe6',
    panel: '#fffdf7',
    text: '#26221b',
    sub: '#7a7266',
    accent: '#cf3339',
    accentSoft: 'rgba(207,51,57,.14)',
    border: 'rgba(0,0,0,.12)',
  },
  sepia: {
    bg: '#e9ddc7',
    panel: '#f5ecd8',
    text: '#463b28',
    sub: '#8a7c60',
    accent: '#b04a24',
    accentSoft: 'rgba(176,74,36,.16)',
    border: 'rgba(70,59,40,.18)',
  },
  hc: {
    bg: '#000000',
    panel: '#0b0b0b',
    text: '#ffffff',
    sub: '#c9c9c9',
    accent: '#ff3b3b',
    accentSoft: 'rgba(255,59,59,.25)',
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
