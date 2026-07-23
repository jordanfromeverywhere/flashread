import { createRoot } from 'react-dom/client'
import App from './App'
import './index.css'

// No StrictMode: the reading engine drives an imperative setTimeout loop and TTS
// scheduling that must not be double-invoked in development.
createRoot(document.getElementById('root')!).render(<App />)
