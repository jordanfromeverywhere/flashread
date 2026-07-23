// Built-in sample, calibration passage and starter library — carried over from
// the prototype so the "Try a sample" and "A place to start" surfaces match.

export const SAMPLE =
  'Rapid serial visual presentation flashes words one at a time at a single fixed point. Because your eyes never travel across a line, you spend no time on the small jumps between words, and none on drifting backward to reread. What remains is recognition itself. Each word is aligned on its optimal recognition point, the spot a fraction left of center where the eye lands most naturally, marked here in red. Try nudging the speed upward. You will likely find you can follow far faster than you read on paper, because most of ordinary reading is motion, not thought. Start slow, trust the rhythm, and let the words come to you.'

export const CAL_PASSAGE =
  'The lighthouse keeper kept a journal for forty years. He recorded the weather, the ships that passed, and the strange green light he swore he saw on moonless nights. When the automatic lamp replaced him, the journal was found in a drawer, its final entry unfinished. Nobody knows what he meant to write, but the last two words were simply: it returns.'

export interface Starter {
  title: string
  meta: string
  text: string
}

export const STARTERS: Starter[] = [
  {
    title: 'Why your mind wanders',
    meta: 'Essay · ~130 words',
    text: 'Attention is less a spotlight you aim than a current you ride. Left alone, the mind drifts toward whatever is unresolved: a half-finished message, a worry, a sound in the next room. This wandering is not a flaw. It is the brain scanning for anything more urgent than the task in front of you. The trick is not to force focus but to remove the exits. Give the mind one clear thing to do, make that thing arrive a little faster than your doubts can, and the drifting quiets on its own. You are not broken for losing your place. You simply never gave your attention a reason to stay.',
  },
  {
    title: 'The map that lied',
    meta: 'Story · ~150 words',
    text: 'The old atlas showed an island exactly where the sea was empty. Sailors had trusted it for a hundred years, steering wide around waters that held nothing at all. When a young captain finally sailed straight through, charting each fathom herself, she found only open blue and a school of silver fish. She kept the old map anyway, framed above her desk. It reminded her that a confident line on paper is not the same as the world, and that the fastest way forward is sometimes to test the thing everyone already believes.',
  },
  {
    title: 'How to read faster',
    meta: 'Guide · ~120 words',
    text: 'Speed is mostly a matter of removing friction, not adding effort. Start slower than feels impressive and let the rhythm settle before you push the pace. Trust the red letter; keep your eyes still and let each word arrive. When a sentence ends, notice the small pause, then move on without rereading. If your mind slips, rewind one sentence rather than starting the page again. Do this for ten minutes a day and the comfortable numbers climb on their own. The goal was never to race. It was to spend your attention on meaning instead of motion.',
  },
]
