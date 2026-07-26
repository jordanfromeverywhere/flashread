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

// -0.02em, matching the letter-spacing the in-app <Wordmark> uses. Individual
// lines can override it — see the stacked icon, which tracks its short line out
// to meet the long one.
const BASE_LS = -0.02
const typeOpts = (ls = BASE_LS) => ({ kerning: true, letterSpacing: ls })
const TYPE = typeOpts()
const advance = (text, size, ls = BASE_LS) =>
  text ? font.getAdvanceWidth(text, size, typeOpts(ls)) : 0

/**
 * Splits `text` at its ORP pivot and returns one outlined path per colour run,
 * laid out along a baseline starting at `x`. Each run carries its own bounding
 * box so callers can position by real ink rather than by font metrics.
 */
function pivotRuns(text, { size, x = 0, y = 0, ink, red, pivotAt, ls = BASE_LS }) {
  // pivotAt overrides the rule for a fragment of a longer word — the stacked
  // icon splits "Flashread" across two lines but the pivot still belongs to
  // the whole name, so each line is told where (or whether) it falls.
  const i = pivotAt === undefined ? orp(text) : pivotAt
  const parts =
    i < 0 || i >= text.length
      ? [{ text, fill: ink }]
      : [
          { text: text.slice(0, i), fill: ink },
          { text: text[i], fill: red },
          { text: text.slice(i + 1), fill: ink },
        ].filter((p) => p.text)

  let consumed = ''
  return parts.map(({ text: run, fill }) => {
    const path = font.getPath(run, x + advance(consumed, size, ls), y, size, typeOpts(ls))
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
// Square icon: the full name, stacked.
//
// Set on one line, nine letters of Georgia inside a 192px home-screen tile give
// roughly 20px per glyph, and under 2px in a favicon. Breaking it across two
// lines is what makes the whole word usable at icon sizes — each line is set
// about two and a half times larger than the single-line version could be.
// "Flash" / "read" is also where the compound wants to break, and the pivot
// stays put: orp('Flashread') is 2, which lands in the first line.
const ICON = 512
const STACK = ['Flash', 'read']
const NAME = STACK.join('')

// Which line holds the pivot, and where in that line.
const stackPivots = (() => {
  const p = orp(NAME)
  let consumed = 0
  return STACK.map((line) => {
    const local = p - consumed
    consumed += line.length
    return local >= 0 && local < line.length ? local : -1
  })
})()

/**
 * Lays the stacked name out to `targetW`, centred on its ink box at (cx, cy).
 * Lines are centred against each other first, then the block is centred as a
 * whole, so the result is optically centred rather than metrically centred.
 */
function stackRuns({ ink, red, targetW, cx, cy }) {
  const NOM = 100
  const size = (NOM * targetW) / Math.max(...STACK.map((l) => advance(l, NOM)))
  const lineH = size * 0.92

  // Ink width of each line at base tracking, and the widest of them.
  const inkW = (line, ls) => {
    const b = union(pivotRuns(line, { size, ink, red, pivotAt: -1, ls }))
    return b.x2 - b.x1
  }
  const natural = STACK.map((l) => inkW(l, BASE_LS))
  const widest = Math.max(...natural)

  // Track each short line out to the widest one. Ink width grows linearly with
  // tracking across the n-1 internal gaps, so the required value is exact, not
  // iterated. Justifying the stack this way is what makes it read as a designed
  // lockup rather than two centred lines that happen to sit together.
  const tracking = STACK.map((line, i) => {
    const gaps = line.length - 1
    if (gaps < 1) return BASE_LS
    return BASE_LS + (widest - natural[i]) / (gaps * size)
  })

  let runs = []
  STACK.forEach((line, i) => {
    runs = runs.concat(
      pivotRuns(line, {
        size,
        x: -advance(line, size, tracking[i]) / 2,
        y: i * lineH,
        ink,
        red,
        pivotAt: stackPivots[i],
        ls: tracking[i],
      }),
    )
  })

  const b = union(runs)
  return {
    runs,
    dx: cx - (b.x1 + b.x2) / 2,
    dy: cy - (b.y1 + b.y2) / 2,
    w: b.x2 - b.x1,
    h: b.y2 - b.y1,
  }
}

const stackSvg = (size, targetW, bg, rx = 0) => {
  const s = stackRuns({ ink: CREAM, red: RED, targetW, cx: 0, cy: 0 })
  const scale = size / ICON
  return {
    svg:
      `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 ${ICON} ${ICON}">` +
      (bg ? `<rect width="${ICON}" height="${ICON}"${rx ? ` rx="${rx}"` : ''} fill="${BG}"/>` : '') +
      `<g transform="translate(${(ICON / 2 + s.dx).toFixed(2)} ${(ICON / 2 + s.dy).toFixed(2)})">` +
      toPaths(s.runs) +
      `</g></svg>`,
    diag: Math.hypot(s.w, s.h) * scale,
    w: s.w,
    h: s.h,
  }
}

// "any" icons carry the mark at full size.
const main = stackSvg(ICON, ICON * 0.8, true)
const buf = Buffer.from(main.svg)
await sharp(buf).resize(ICON, ICON).png().toFile('public/icon-512.png')
await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png')

// Maskable is a separate file, not the same one reused. Android crops maskable
// icons to an arbitrary shape and only guarantees a centred circle of 80% the
// width; a mark sized for the "any" tile loses the ends of "Flash" to that
// crop. This one is sized so its diagonal fits inside that circle.
const SAFE_D = ICON * 0.8
const maskable = stackSvg(ICON, ICON * 0.56, true)
if (maskable.diag > SAFE_D) {
  console.error(
    `maskable mark diagonal ${maskable.diag.toFixed(0)} exceeds the ${SAFE_D} safe circle — reduce its targetW`,
  )
  process.exit(1)
}
await sharp(Buffer.from(maskable.svg)).resize(ICON, ICON).png().toFile('public/icon-maskable-512.png')

// Browser-tab favicon keeps its own rounded corners.
const FAV = 64
writeFileSync('public/favicon.svg', stackSvg(FAV, ICON * 0.8, true, 120).svg + '\n')

// ---------------------------------------------------------------------------
// Wordmark — the full name on one line, for lockups, the landing page and
// store listings, where there is width to carry it. The icons above stack the
// same name because a square has no width to spare.
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
