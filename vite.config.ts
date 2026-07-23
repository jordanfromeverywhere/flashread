import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// pdfjs-dist ships a worker we resolve at build time (see lib/pdf.ts).
export default defineConfig({
  plugins: [react()],
  base: './',
})
