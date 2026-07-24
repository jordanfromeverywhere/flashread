// Speech-synthesis voice curation. Browsers (especially iOS/macOS) expose dozens
// of voices, many of them novelty/low-quality ("Bells", "Zarvox", "Bubbles"…).
// We hide those and rank the rest so both the picker and the auto-selection land
// on something that actually sounds like a person.

// Novelty / low-fidelity voices to hide outright (macOS/iOS classic + character set).
const NOVELTY =
  /\b(albert|bad news|bahh|bells|boing|bubbles|cellos|deranged|good news|jester|organ|pipe organ|superstar|trinoids|whisper|wobble|zarvox|fred|junior|kathy|princess|ralph|bruce|agnes|hysterical|grandma|grandpa|reed|rocko|sandy|shelley|flo|eddy|dtmf|wobble)\b/i

// Names that tend to be the good, natural, default system voices for English.
const PREFERRED =
  /\b(samantha|aaron|siri|alex|ava|allison|nathan|susan|zoe|evan|joelle|noelle|daniel|karen|moira|tessa|rishi|serena|nicky|arthur|matilda)\b/i

const QUALITY = /(siri|enhanced|premium|neural|natural)/i

export function isEnglish(v: SpeechSynthesisVoice): boolean {
  return /^en([-_]|$)/i.test(v.lang || '')
}

function baseName(v: SpeechSynthesisVoice): string {
  return (v.name || '')
    .replace(/\s*\(.*\)\s*/g, ' ')
    .trim()
    .toLowerCase()
}

function rank(v: SpeechSynthesisVoice): number {
  const n = (v.name || '').toLowerCase()
  let s = 0
  if (QUALITY.test(n)) s += 100
  if (PREFERRED.test(n)) s += 40
  if (v.default) s += 30
  if (v.localService) s += 8
  return s
}

// True when the device exposes at least one genuinely high-quality voice
// (Siri / enhanced / premium / neural / natural). If false, the user is stuck
// with basic compact voices and we nudge them to download a better one.
export function hasQualityVoice(voices: SpeechSynthesisVoice[]): boolean {
  return voices.filter(isEnglish).some((v) => QUALITY.test(v.name || ''))
}

// English voices, novelty ones removed, de-duplicated by display name, best first.
export function curateVoices(voices: SpeechSynthesisVoice[]): SpeechSynthesisVoice[] {
  const seen = new Set<string>()
  return voices
    .filter(isEnglish)
    .filter((v) => !NOVELTY.test(v.name || ''))
    .filter((v) => {
      const k = baseName(v)
      if (seen.has(k)) return false
      seen.add(k)
      return true
    })
    .sort((a, b) => rank(b) - rank(a))
}

// The voice to actually speak with: an explicit pick if set, else the best curated
// one, falling back to any English/any voice so audio never silently no-ops.
export function pickVoice(
  voices: SpeechSynthesisVoice[],
  uri: string,
): SpeechSynthesisVoice | null {
  if (uri) {
    const f = voices.find((v) => v.voiceURI === uri)
    if (f) return f
  }
  const c = curateVoices(voices)
  return c[0] || voices.find(isEnglish) || voices[0] || null
}

// Map reading WPM to a speech rate that stays intelligible. Natural TTS is ~160
// wpm at rate 1.0; pushing rate high to "hit" a visual WPM makes voices garble,
// so we keep it gentle and capped — audio is a listen-along, not a race.
export function audioRate(wpm: number): number {
  return Math.max(0.8, Math.min(1.25, wpm / 260))
}
