// Regenerates the PWA/home-screen icons and the full-name wordmark from inline
// SVG. Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

// One rule governs both marks: the red letter is the ORP pivot of whatever is
// written — the same letter the reading engine would land on. See orp() in
// src/lib/engine.ts. orp('Fr') === 1 → the "r" of the square monogram;
// orp('Flashread') === 2 → the "a" of the wordmark. Move a letter here and it
// stops being the app's own output, so keep the two in step.
const CREAM = '#f3efe7'
const RED = '#e5484d'
const BG = '#0e0d0c'

// Light-surface pair, from THEMES.light in src/lib/theme.ts — the dark red is
// tuned for contrast on cream and is not interchangeable with RED.
const INK = '#26221b'
const RED_ON_LIGHT = '#cf3339'

// Full-bleed square (the OS applies its own rounded mask on the home screen).
// "Fr" monogram for Flash·read — the second letter in the app's red, echoing
// the red pivot letter that is the product's whole identity.
const square = `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="${BG}"/>
  <text x="256" y="342" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="300" letter-spacing="-6"><tspan fill="${CREAM}">F</tspan><tspan fill="${RED}">r</tspan></text>
</svg>`

const buf = Buffer.from(square)
await sharp(buf).resize(512, 512).png().toFile('public/icon-512.png')
await sharp(buf).resize(192, 192).png().toFile('public/icon-192.png')
await sharp(buf).resize(180, 180).png().toFile('public/apple-touch-icon.png')

// Browser-tab favicon keeps its own rounded corners.
const rounded = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64">
  <rect width="64" height="64" rx="15" fill="${BG}"/>
  <text x="32" y="42.75" text-anchor="middle" font-family="Georgia, 'Times New Roman', serif" font-weight="700" font-size="37.5" letter-spacing="-0.75"><tspan fill="${CREAM}">F</tspan><tspan fill="${RED}">r</tspan></text>
</svg>`
writeFileSync('public/favicon.svg', rounded + '\n')

// ---------------------------------------------------------------------------
// Wordmark — the full name, for lockups, the landing page and store listings.
// It never replaces the square icon: nine letters of Georgia are unreadable at
// favicon and home-screen sizes.
//
// Drawn on an oversized transparent canvas, then measured by rasterising once
// and trimming, so the emitted viewBox is the true ink box. Guessing it leaves
// stray padding that misaligns the mark in every consumer.
const NAME_SIZE = 260
const draw = (ink, red) =>
  `<text x="60" y="420" font-family="Georgia, 'Times New Roman', serif" font-weight="700" ` +
  `font-size="${NAME_SIZE}" letter-spacing="-5">` +
  `<tspan fill="${ink}">Fl</tspan><tspan fill="${red}">a</tspan><tspan fill="${ink}">shread</tspan></text>`

const probe = `<svg xmlns="http://www.w3.org/2000/svg" width="2000" height="600">${draw(CREAM, CREAM)}</svg>`
const { info } = await sharp(Buffer.from(probe))
  .trim({ threshold: 0 })
  .png()
  .toBuffer({ resolveWithObject: true })

const PAD = 8
const boxX = Math.abs(info.trimOffsetLeft ?? 0) - PAD
const boxY = Math.abs(info.trimOffsetTop ?? 0) - PAD
const boxW = info.width + PAD * 2
const boxH = info.height + PAD * 2

// Transparent background so the mark sits on any of the four themes' surfaces.
const wordmark = (ink, red) =>
  `<svg xmlns="http://www.w3.org/2000/svg" viewBox="${boxX} ${boxY} ${boxW} ${boxH}" ` +
  `width="${boxW}" height="${boxH}">${draw(ink, red)}</svg>\n`

writeFileSync('public/wordmark.svg', wordmark(CREAM, RED))
writeFileSync('public/wordmark-light.svg', wordmark(INK, RED_ON_LIGHT))
await sharp(Buffer.from(wordmark(CREAM, RED)))
  .resize({ height: 240 })
  .png()
  .toFile('public/wordmark.png')

console.log(
  `icons written: icon-512, icon-192, apple-touch-icon, favicon.svg\n` +
    `wordmark written: wordmark.svg, wordmark-light.svg, wordmark.png (${boxW}×${boxH})`,
)
