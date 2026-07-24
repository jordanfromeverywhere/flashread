// Regenerates the PWA/home-screen icons from an inline SVG.
// Run: node scripts/gen-icons.mjs
import sharp from 'sharp'
import { writeFileSync } from 'node:fs'

// The mark: the app's own reading reticle — the word "read" with the pivot
// letter "e" in red at the exact horizontal centre, framed by the red guide
// ticks the reader draws above and below the focal point.
const CREAM = '#f3efe7'
const RED = '#e5484d'
const BG = '#0e0d0c'

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

console.log('icons written: icon-512, icon-192, apple-touch-icon, favicon.svg')
