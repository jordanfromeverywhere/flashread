import { useEffect, useMemo } from 'react'
import { useSpeedReader } from './useSpeedReader'
import { derive } from './derive'
import { TopBar } from './components/TopBar'
import { Toast } from './components/Toast'
import { ReadingCanvas } from './components/ReadingCanvas'
import { ControlCard } from './components/ControlCard'
import { TabBar } from './components/TabBar'
import { BottomSheet } from './components/BottomSheet'

export default function App() {
  const { state: s, actions: a } = useSpeedReader()
  const d = useMemo(() => derive(s), [s])
  const { t } = d

  // Keep the page backdrop and browser chrome in sync with the theme so the
  // full-screen app reads as one surface (no device frame).
  useEffect(() => {
    document.body.style.background = t.bg
    document.documentElement.style.background = t.bg
    document.querySelector('meta[name="theme-color"]')?.setAttribute('content', t.bg)
  }, [t.bg])

  return (
    <div
      className="app-viewport-fill"
      style={{ width: '100%', display: 'flex', justifyContent: 'center', background: t.bg }}
    >
      {/* Height comes from .app-viewport (dvh in-browser, lvh when installed) so
          the tab rail sits flush on the home bar from first paint on iOS. */}
      <div
        className="app-viewport"
        style={{
          position: 'relative',
          width: '100%',
          maxWidth: 480,
          display: 'flex',
          flexDirection: 'column',
          overflow: 'hidden',
          background: t.bg,
          color: t.text,
          fontFamily: "-apple-system,'Helvetica Neue',Helvetica,sans-serif",
          transition: 'background .25s ease,color .25s ease',
        }}
      >
        <TopBar d={d} a={a} />
        <Toast s={s} d={d} a={a} />
        <ReadingCanvas s={s} d={d} a={a} />
        {d.has && <ControlCard s={s} d={d} a={a} />}
        <TabBar s={s} d={d} a={a} />
        <BottomSheet s={s} d={d} a={a} />
      </div>
    </div>
  )
}
