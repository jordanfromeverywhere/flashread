import { createRequire } from 'node:module'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'

// The ONNX runtime the neural voice runs on. Transformers.js otherwise points
// onnxruntime-web at jsDelivr, which means ~21MB of WASM is fetched from a third
// party *after* the model download reports 100% — no progress, no caching, and
// on a phone that reads as "the download finished and the voice never came".
// Serving it ourselves puts it behind the service worker and makes the offline
// promise in Settings true. Names are kept unhashed: the .mjs loader resolves
// the .wasm relative to itself by exact filename.
const ORT_DIR = 'ort'
const ORT_FILES = ['ort-wasm-simd-threaded.jsep.mjs', 'ort-wasm-simd-threaded.jsep.wasm']

function ortRuntime(): Plugin {
  // The package does not export ./package.json, so locate it via the entry point
  // it does export — both live in dist/.
  const require = createRequire(import.meta.url)
  const dist = path.dirname(require.resolve('@huggingface/transformers'))
  const read = (file: string) => readFileSync(path.join(dist, file))

  return {
    name: 'flashread-ort-runtime',
    configureServer(server) {
      server.middlewares.use((req, res, next) => {
        const file = ORT_FILES.find((f) => req.url?.split('?')[0].endsWith(`/${ORT_DIR}/${f}`))
        if (!file) return next()
        res.setHeader(
          'Content-Type',
          file.endsWith('.wasm') ? 'application/wasm' : 'text/javascript',
        )
        res.end(read(file))
      })
    },
    generateBundle(_options, bundle) {
      for (const file of ORT_FILES) {
        this.emitFile({ type: 'asset', fileName: `${ORT_DIR}/${file}`, source: read(file) })
      }
      // onnxruntime-web also references the .wasm through `new URL(..., import.meta.url)`,
      // so Vite emits a second hashed 21MB copy into assets/. That reference is
      // only read when the runtime is proxied into a worker *and* no wasmPaths is
      // set — transformers.js disables the proxy and we always set wasmPaths, so
      // it is unreachable. Shipping it would double the deploy for nothing.
      for (const name of Object.keys(bundle)) {
        if (!name.startsWith(`${ORT_DIR}/`) && /ort-wasm-.*\.wasm$/.test(name)) {
          delete bundle[name]
        }
      }
    },
  }
}

// pdfjs-dist ships a worker we resolve at build time (see lib/pdf.ts).
export default defineConfig({
  plugins: [react(), ortRuntime()],
  base: './',
})
