import { describe, expect, it } from 'vitest'
import {
  dwell,
  estRemaining,
  orp,
  prevSentenceStart,
  splitPivot,
  syllables,
  tokenize,
  tokenizeDoc,
  type DwellParams,
} from './engine'
import { linesToParagraphs } from './pdf'

describe('orp', () => {
  it('scales the pivot with word length', () => {
    expect(orp('a')).toBe(0)
    expect(orp('the')).toBe(1)
    expect(orp('reading')).toBe(2)
    expect(orp('comprehension')).toBe(3)
    expect(orp('incomprehensible')).toBe(4)
  })

  it('ignores punctuation when measuring length', () => {
    expect(orp('"the,"')).toBe(orp('the'))
  })

  it('places the brand marks where the wordmark draws them', () => {
    // scripts/gen-icons.mjs mirrors this rule to colour the exported marks; if
    // this moves, the logos are no longer the engine's output on their own text.
    expect(splitPivot('Flashread').pivot).toBe('a')
  })
})

describe('splitPivot', () => {
  it('reassembles the original string', () => {
    for (const w of ['a', 'to', 'read', 'flashread', 'extraordinarily']) {
      const { pre, pivot, post } = splitPivot(w)
      expect(pre + pivot + post).toBe(w)
    }
  })

  it('never runs the pivot past the end of a short string', () => {
    const { pre, pivot, post } = splitPivot('I')
    expect(pivot).toBe('I')
    expect(pre + post).toBe('')
  })
})

describe('tokenizeDoc', () => {
  it('marks the last word of each paragraph as a break', () => {
    const { words, breaks } = tokenizeDoc('one two\n\nthree four')
    expect(words).toEqual(['one', 'two', 'three', 'four'])
    expect(breaks).toEqual([false, true, false, true])
  })

  it('treats a single newline as a soft wrap, not a paragraph', () => {
    const { breaks } = tokenizeDoc('one\ntwo')
    expect(breaks).toEqual([false, true])
  })

  it('yields no breaks for text with no blank lines', () => {
    // The state a PDF used to arrive in — see linesToParagraphs below.
    const { breaks } = tokenizeDoc('one two three')
    expect(breaks.slice(0, -1).some(Boolean)).toBe(false)
  })
})

describe('syllables', () => {
  it('counts short words as one', () => {
    expect(syllables('the')).toBe(1)
    expect(syllables('a')).toBe(1)
  })

  it('counts vowel groups in longer words', () => {
    expect(syllables('reading')).toBe(2)
    expect(syllables('comprehension')).toBe(4)
  })

  it('returns zero for a word with no letters', () => {
    expect(syllables('—')).toBe(0)
  })
})

const base = (over: Partial<DwellParams> = {}): DwellParams => ({
  words: ['one', 'two', 'three'],
  breaks: [false, false, true],
  wpm: 300,
  chunk: 1,
  adaptive: true,
  easeIn: false,
  pauseScale: 'natural',
  playIdx: null,
  ...over,
})

describe('dwell', () => {
  it('is the plain rate when adaptive pacing is off', () => {
    expect(dwell(0, base({ adaptive: false }))).toBeCloseTo(200, 5)
  })

  it('holds a paragraph-ending word longer than a mid-sentence one', () => {
    const p = base()
    expect(dwell(2, p)).toBeGreaterThan(dwell(0, p))
  })

  it('respects the pause scale', () => {
    const off = dwell(2, base({ pauseScale: 'none' }))
    const on = dwell(2, base({ pauseScale: 'long' }))
    expect(on).toBeGreaterThan(off)
  })

  it('clamps to the 55–3000ms window', () => {
    expect(dwell(0, base({ wpm: 100000 }))).toBe(55)
    expect(dwell(2, base({ wpm: 1, pauseScale: 'long' }))).toBe(3000)
  })

  it('returns 0 past the end', () => {
    expect(dwell(99, base())).toBe(0)
  })

  it('eases in, decaying over the first ten words', () => {
    const p = base({ easeIn: true, playIdx: 0, adaptive: false })
    expect(dwell(0, p)).toBeGreaterThan(dwell(1, p))
    expect(dwell(1, p)).toBeGreaterThan(dwell(2, p))
  })
})

describe('estRemaining', () => {
  // The closed form replaced an O(n) loop; this pins it to the loop's result.
  const loop = (words: string[], idx: number, wpm: number, chunk: number, adaptive: boolean) => {
    let ms = 0
    for (let i = idx; i < words.length; i += chunk) ms += (60000 / wpm) * chunk * (adaptive ? 1.18 : 1)
    return ms
  }

  it('matches the loop it replaced across chunk sizes and offsets', () => {
    const words = Array.from({ length: 37 }, (_, i) => `w${i}`)
    for (const chunk of [1, 2, 3, 5]) {
      for (const idx of [0, 1, 10, 36, 37]) {
        expect(estRemaining(words, idx, 300, chunk, true)).toBeCloseTo(
          loop(words, idx, 300, chunk, true),
          5,
        )
      }
    }
  })

  it('is zero at and past the end', () => {
    const words = ['a', 'b']
    expect(estRemaining(words, 2, 300, 1, true)).toBe(0)
    expect(estRemaining(words, 5, 300, 1, true)).toBe(0)
  })
})

describe('prevSentenceStart', () => {
  const words = tokenize('One two. Three four five. Six seven.')

  it('goes back to the start of the previous sentence', () => {
    // Mid-way through "Three four five." lands on its first word.
    expect(prevSentenceStart(words, 4)).toBe(2)
  })

  it('never returns an index past where it started', () => {
    for (let i = 0; i <= words.length; i++) {
      expect(prevSentenceStart(words, i)).toBeLessThanOrEqual(Math.max(0, i))
    }
  })
})

describe('linesToParagraphs', () => {
  it('breaks where a short line ends a sentence', () => {
    const out = linesToParagraphs([
      'This is a fairly long line of running text that',
      'wraps across the page and keeps going for a while',
      'and then stops.',
      'A second paragraph starts here and also runs on',
      'for a good long while before it finally ends.',
    ])
    expect(out.split('\n\n')).toHaveLength(2)
    expect(out.split('\n\n')[0]).toMatch(/and then stops\.$/)
  })

  it('does not break on a long line that merely ends a sentence', () => {
    const out = linesToParagraphs([
      'A line of running text that ends a sentence here.',
      'Another line of running text of much the same width.',
    ])
    expect(out).not.toContain('\n\n')
  })

  it('produces paragraphs tokenizeDoc can see', () => {
    // The regression that mattered: PDFs arrived as one blob, so breaks[] was
    // all false and the paragraph pause never fired.
    const text = linesToParagraphs([
      'A long opening line that runs the full width here',
      'and carries on to about the same width again yes',
      'then ends.',
      'The next paragraph also runs the full width here',
      'and carries on to about the same width again ok.',
    ])
    const { breaks } = tokenizeDoc(text)
    expect(breaks.filter(Boolean).length).toBe(2)
  })

  it('ignores blank lines and returns empty for no content', () => {
    expect(linesToParagraphs(['', '   '])).toBe('')
  })
})
