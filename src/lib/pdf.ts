// In-browser PDF text extraction via pdf.js. The worker is resolved through
// Vite so nothing is fetched from a CDN and nothing is uploaded.
import * as pdfjsLib from 'pdfjs-dist'
import workerUrl from 'pdfjs-dist/build/pdf.worker.min.js?url'

pdfjsLib.GlobalWorkerOptions.workerSrc = workerUrl

export interface PdfProgress {
  (message: string): void
}

// Extract all page text from a PDF File, reporting per-page progress.
export async function extractPdf(file: File, onProgress?: PdfProgress): Promise<string> {
  const buf = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: buf }).promise
  const out: string[] = []
  for (let p = 1; p <= pdf.numPages; p++) {
    const page = await pdf.getPage(p)
    const tc = await page.getTextContent()
    out.push(tc.items.map((it) => ('str' in it ? it.str : '')).join(' '))
    onProgress?.(`Extracting page ${p} / ${pdf.numPages}…`)
  }
  return out.join('\n').replace(/\s+/g, ' ').trim()
}
