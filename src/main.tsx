import { createRoot } from 'react-dom/client'
import App from './App'
// Self-hosted Atkinson Hyperlegible (the "Legible" typeface option) — bundled so
// the app needs no external font CDN and works fully offline.
import '@fontsource/atkinson-hyperlegible/400.css'
import '@fontsource/atkinson-hyperlegible/400-italic.css'
import '@fontsource/atkinson-hyperlegible/700.css'
import './index.css'

// No StrictMode: the reading engine drives an imperative setTimeout loop and TTS
// scheduling that must not be double-invoked in development.
createRoot(document.getElementById('root')!).render(<App />)
