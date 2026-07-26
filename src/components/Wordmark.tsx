import type { CSSProperties } from 'react'
import { splitPivot } from '../lib/engine'
import type { Theme } from '../lib/theme'

// The full-name wordmark.
//
// The red letter is not hand-picked: splitPivot() runs the app's own ORP rule
// over the name and lands on the "a" of Fl-a-shread — the same letter the
// reader would light up if you pasted "Flashread" in and pressed play. The two-
// letter mark resolves the same way, to its "r". Change orp() and both marks
// follow, which is the point.
//
// scripts/gen-icons.mjs draws the static export of this mark (public/wordmark*)
// for surfaces outside React — README, store listings, OG images. That copy
// carries fixed colours; this one tracks the active theme, which is why the
// in-app mark is drawn here rather than dropped in as an <img>.
const NAME = 'Flashread'
const MARK = 'Fr'

const SERIF = "Georgia, 'Times New Roman', serif"

export function Wordmark({
  t,
  size = 20,
  withMark = false,
  style,
}: {
  t: Theme
  size?: number
  /** Prefix the name with the rounded "Fr" square, for splash-style lockups. */
  withMark?: boolean
  style?: CSSProperties
}) {
  const name = splitPivot(NAME)
  const mark = splitPivot(MARK)
  const box = Math.round(size * 1.6)

  return (
    <span
      aria-label={NAME}
      role="img"
      style={{ display: 'inline-flex', alignItems: 'center', gap: Math.round(size * 0.5), ...style }}
    >
      {withMark && (
        <span
          aria-hidden
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            justifyContent: 'center',
            width: box,
            height: box,
            borderRadius: box * 0.23,
            background: t.panel,
            font: `700 ${Math.round(box * 0.58)}px/1 ${SERIF}`,
            letterSpacing: '-.02em',
            color: t.text,
          }}
        >
          {mark.pre}
          <span style={{ color: t.focus }}>{mark.pivot}</span>
          {mark.post}
        </span>
      )}
      <span aria-hidden style={{ font: `700 ${size}px/1 ${SERIF}`, letterSpacing: '-.02em', color: t.text }}>
        {name.pre}
        <span style={{ color: t.focus }}>{name.pivot}</span>
        {name.post}
      </span>
    </span>
  )
}
