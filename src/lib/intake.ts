// Text-intake helpers: smart title derivation, in-browser article extraction
// from fetched HTML, and the bookmarklet source. Ported from the prototype.

import { tokenize } from './engine'

export function tidyTitle(input: string): string {
  let s = String(input || '')
    .replace(/\s+/g, ' ')
    .trim()
    .replace(/^["“”'(]+/, '')
    .replace(/["“”'.,;:\s]+$/, '')
  if (s.length > 50) {
    let c = s.slice(0, 50)
    const sp = c.lastIndexOf(' ')
    if (sp > 22) c = c.slice(0, sp)
    s = c.replace(/[,;:\-\s]+$/, '') + '…'
  }
  return s || 'Untitled'
}

// Prefer a short standalone first line as the title; otherwise the first
// sentence, trimmed.
export function deriveTitle(text: string): string {
  const raw = String(text || '')
  const lines = raw
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean)
  const first = lines[0] || ''
  if (first && first.length <= 64 && lines.length > 1 && !/[.!?]$/.test(first)) {
    return tidyTitle(first)
  }
  const clean = raw.replace(/\s+/g, ' ').trim()
  const m = clean.match(/^.{0,80}?[.!?](\s|$)/)
  return tidyTitle(m ? m[0] : clean.slice(0, 60))
}

// Strip chrome/boilerplate from an HTML document and return the readable body.
export function extractArticle(html: string): string {
  const doc = new DOMParser().parseFromString(html, 'text/html')
  doc
    .querySelectorAll('script,style,nav,header,footer,aside,form,noscript,iframe,figure')
    .forEach((n) => n.remove())
  const main =
    doc.querySelector('article') || doc.querySelector('main') || doc.body
  const ps = [...main.querySelectorAll('p,li,h1,h2,h3')]
    .map((n) => n.textContent?.trim() || '')
    .filter((t) => t.length > 40)
  return (ps.length ? ps.join('\n\n') : main.textContent || '')
    .replace(/[ \t]+/g, ' ')
    .trim()
}

export function buildBookmarklet(): string {
  const code =
    "(function(){function g(s){return Array.from(document.querySelectorAll(s))}var m=document.querySelector('article')||document.querySelector('main')||document.body;var ps=g('p,li,h1,h2,h3').filter(function(n){return n.innerText.trim().length>40}).map(function(n){return n.innerText.trim()});var t=(ps.length?ps.join('\\n\\n'):m.innerText).replace(/[ \\t]+/g,' ').trim();navigator.clipboard.writeText(t).then(function(){alert('Copied '+t.split(/\\s+/).length+' words. Paste into Flashread.')},function(){prompt('Copy this text:',t)})})();"
  return 'javascript:' + encodeURIComponent(code)
}

export interface ExtractResult {
  text: string
  words: number
}

// Fetch a URL and extract its article text. Throws on CORS / thin content so
// the UI can fall back to the bookmarklet.
export async function fetchArticle(url: string): Promise<ExtractResult> {
  const res = await fetch(url)
  const html = await res.text()
  const text = extractArticle(html)
  const words = tokenize(text).length
  if (words < 20) throw new Error('little readable text found')
  return { text, words }
}
