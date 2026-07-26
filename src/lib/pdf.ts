// In-browser PDF text extraction via pdf.js. The worker is resolved through
// Vite so nothing is fetched from a CDN and nothing is uploaded.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfProgress {
  (message: string): void
}

// A line is a paragraph's last line when it ends a sentence and is visibly
// short of the page's running line width. PDFs carry no paragraph marker, so
// this ragged-right signal is the only one available from the text layer. It is
// a heuristic and will occasionally miss; the cost of a miss is one absent
// pause, which is why it errs toward NOT breaking (0.8 is a wide margin).
const SHORT_LINE = 0.8
const ENDS_SENTENCE = /[.!?…]["'’”)\]]?$/

/**
 * Joins pdf.js text items into paragraphs.
 *
 * Items expose `hasEOL` at the end of each rendered line. Reconstructing lines
 * first, then merging them, is what preserves paragraph structure: tokenizeDoc
 * splits on blank lines to populate `breaks[]`, which drives the largest pause
 * multiplier in the dwell model. Flatten the newlines here and every PDF reads
 * as one unbroken paragraph with that pause permanently disabled.
 */
export function linesToParagraphs(lines: string[]): string {
  const real = lines.map((l) => l.trim()).filter(Boolean)
  if (!real.length) return ''
  const avg = real.reduce((n, l) => n + l.length, 0) / real.length

  const paras: string[] = []
  let cur: string[] = []
  real.forEach((line) => {
    cur.push(line)
    if (ENDS_SENTENCE.test(line) && line.length < avg * SHORT_LINE) {
      paras.push(cur.join(' '))
      cur = []
    }
  })
  if (cur.length) paras.push(cur.join(' '))
  return paras.join('\n\n')
}

// Extract all page text from a PDF File, reporting per-page progress.
export async function extractPdf(file: File, onProgress?: PdfProgress): Promise<string> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const pages: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()

    const lines: string[] = []
    let line = ''
    tc.items.forEach((it) => {
      if (!('str' in it)) return
      line += it.str
      if ('hasEOL' in it && it.hasEOL) {
        lines.push(line)
        line = ''
      }
    })
    if (line.trim()) lines.push(line)

    // Collapse runs of spaces and tabs only — never newlines, which are the
    // paragraph structure being built here.
    pages.push(linesToParagraphs(lines).replace(/[ \t]+/g, ' '))
    onProgress?.(`Extracting page ${p} / ${pdf.numPages}…`)
  }
  return pages.filter(Boolean).join('\n\n').trim()
}
