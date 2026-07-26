// Regenerates the PWA/home-screen icons and the full-name wordmark.
// Run: node scripts/gen-icons.mjs
//
// Run by hand, never by CI: it needs Georgia Bold installed locally (see
// FONT_CANDIDATES). The committed output is what ships.
import sharp from 'sharp'
import opentype from 'opentype.js'
import { existsSync, readFileSync, writeFileSync } from 'node:fs'

// One rule governs both marks: the red letter is the ORP pivot of whatever is
// written — the same letter the reading engine would land on. orp('Fr') is 1,
// giving the monogram its red "r"; orp('Flashread') is 2, giving the wordmark
// its red "a". Neither index is typed in below; both are computed.
const CREAM = '#f3efe7'
const RED = '#e5484d'
const BG = '#0e0d0c'

// Light-surface pair, from THEMES.light in src/lib/theme.ts — the dark red is
// tuned for contrast on cream and is not interchangeable with RED.
const INK = '#26221b'
const RED_ON_LIGHT = '#cf3339'

// Mirror of orp() in src/lib/engine.ts. Duplicated because this is a plain .mjs
// script and cannot import the TypeScript source; if the rule changes there,
// change it here and regenerate, or the marks stop being the engine's output.
function orp(word) {
  const n = word.replace(/[^A-Za-z0-9]/g, '').length || word.length
  if (n <= 1) return 0
  if (n <= 5) return 1
  if (n <= 9) return 2
  if (n <= 13) return 3
  return 4
}

// ---------------------------------------------------------------------------
// Type. Glyphs are converted to outlines rather than left as live <text>: an
// SVG carrying <text> renders in whatever serif the viewer happens to own, and
// Georgia is absent on Android and most Linux. A viewBox measured against real
// Georgia then clips the substitute. Outlines make the files self-contained.
const FONT_CANDIDATES = [
  'C:/Windows/Fonts/georgiab.ttf',
  '/System/Library/Fonts/Supplemental/Georgia Bold.ttf',
  '/Library/Fonts/Georgia Bold.ttf',
]
const fontPath = FONT_CANDIDATES.find((p) => existsSync(p))
if (!fontPath) {
  console.error(
    'Georgia Bold not found. Looked in:\n  ' +
      FONT_CANDIDATES.join('\n  ') +
      '\nInstall it or add its path to FONT_CANDIDATES, then re-run.',
  )
  process.exit(1)
}
// parse(), not the deprecated loadSync() — the latter returns undefined here.
const font = opentype.parse(readFileSync(fontPath).buffer)

// -0.02em, matching the letter-spacing the in-app <Wordmark> uses.
const TYPE = { kerning: true, letterSpacing: -0.02 }
const advance = (text, size) => (text ? font.getAdvanceWidth(text, size, TYPE) : 0)

/**
 * Splits `text` at its ORP pivot and returns one outlined path per colour run,
 * laid out along a baseline starting at `x`. Each run carries its own bounding
 * box so callers can position by real ink rather than by font metrics.
 */
function pivotRuns(text, { size, x = 0, y = 0, ink, red }) {
  const i = orp(text)
  const parts = [
    { text: text.slice(0, i), fill: ink },
    { text: text[i], fill: red },
    { text: text.slice(i + 1), fill: ink },
  ].filter((p) => p.text)

  let consumed = ''
  return parts.map(({ text: run, fill }) => {
    const path = font.getPath(run, x + advance(consumed, size), y, size, TYPE)
    consumed += run
    return { d: path.toPathData(2), fill, box: path.getBoundingBox() }
  })
}

const union = (runs) => ({
  x1: Math.min(...runs.map((r) => r.box.x1)),
  y1: Math.min(...runs.map((r) => r.box.y1)),
  x2: Math.max(...runs.map((r) => r.box.x2)),
  y2: Math.max(...runs.map((r) => r.box.y2)),
})

const toPaths = (runs) => runs.map((r) => `<path d="${r.d}" fill="${r.fill}"/>`).join('')

// ---------------------------------------------------------------------------
// Square icon. Full-bleed (the OS applies its own rounded mask on the home
// screen); the monogram is centred on its ink box, not on font metrics, so the
// optical centre is right.
const ICON = 512
const iconRuns = (ink, red, size, cx, cy) => {
  const probe = pivotRuns('Fr', { size, ink, red })
  const b = union(probe)
  return pivotRuns('Fr', {
    size,
    ink,
    red,
    x: cx - (b.x1 + b.x2) / 2,
    y: cy - (b.y1 + b.y2) / 2,
  })
}

const square =
  `<svg xmlns="http://www.w3.org/2000/svg" width="${ICON}" height="${ICON}" viewBox="0 0 ${ICON} ${ICON}">` +
  `<rect width="${ICON}" height="${ICON}" fill="${BG}"/>` +
  toPaths(iconRuns(CREAM, RED, 300, ICON / 2, ICON / 2)) +
  `</svg>`

const buf = Buffer.from(square)
await sharp(buf).resize(ICON, ICON).png().toFile('public/icon-512.png')
await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png')

// Browser-tab favicon keeps its own rounded corners.
const FAV = 64
const favicon =
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${FAV} ${FAV}">` +
  `<rect width="${FAV}" height="${FAV}" rx="15" fill="${BG}"/>` +
  toPaths(iconRuns(CREAM, RED, 37.5, FAV / 2, FAV / 2)) +
  `</svg>\n`
writeFileSync('public/favicon.svg', favicon)

// ---------------------------------------------------------------------------
// Wordmark — the full name, for lockups, the landing page and store listings.
// It never replaces the square icon: nine letters of Georgia are unreadable at
// favicon and home-screen sizes.
//
// The viewBox is the union of the glyph outlines' own bounding boxes, so it is
// exact by construction — no rasterise-and-trim pass, no dead padding.
const NAME_SIZE = 260
const PAD = 8

const nameRuns = (ink, red) => pivotRuns('Flashread', { size: NAME_SIZE, ink, red })
const nameBox = union(nameRuns(CREAM, RED))
const boxW = Math.ceil(nameBox.x2 - nameBox.x1) + PAD * 2
const boxH = Math.ceil(nameBox.y2 - nameBox.y1) + PAD * 2

// Transparent background so the mark sits on any of the four themes' surfaces.
const wordmark = (ink, red) =>
  `<svg xmlns="http://www.w3.org/2000/svg" ` +
  `viewBox="${(nameBox.x1 - PAD).toFixed(2)} ${(nameBox.y1 - PAD).toFixed(2)} ${boxW} ${boxH}" ` +
  `width="${boxW}" height="${boxH}">${toPaths(nameRuns(ink, red))}</svg>\n`

writeFileSync('public/wordmark.svg', wordmark(CREAM, RED))
writeFileSync('public/wordmark-light.svg', wordmark(INK, RED_ON_LIGHT))
await sharp(Buffer.from(wordmark(CREAM, RED))).resize({ height: 240 }).png().toFile('public/wordmark.png')

console.log(
  `icons written: icon-512, icon-192, apple-touch-icon, favicon.svg\n` +
    `wordmark written: wordmark.svg, wordmark-light.svg, wordmark.png (${boxW}×${boxH})\n` +
    `outlined from ${fontPath}`,
)
