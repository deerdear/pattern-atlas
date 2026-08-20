// Route shell: the map at / and /pattern/:id (the Graph stays mounted
// across the two so opening a card never resets the camera), the a11y
// index at /patterns, and a dev-only glyph grid.

import { lazy, Suspense } from 'react'
import { Link, Redirect, Route, Switch, useRoute } from 'wouter'
import Graph from './atlas/Graph'
import PatternCard from './card/PatternCard'
import NotFoundCard from './card/NotFoundCard'
import PatternIndex from './index/PatternIndex'
import Colophon from './colophon/Colophon'
import Intro from './intro/Intro'
import { parsePatternId } from './data/schema'

const GlyphGrid = import.meta.env.DEV
  ? lazy(() => import('./atlas/GlyphGrid'))
  : null

export default function App() {
  const [onMap] = useRoute('/')
  const [onCard, params] = useRoute('/pattern/:id')

  if (onMap || onCard) {
    let card = null
    if (onCard) {
      const raw = params.id ?? ''
      const id = parsePatternId(raw)
      if (id === null) {
        card = <NotFoundCard raw={raw} />
      } else if (String(id) !== raw) {
        card = <Redirect to={`/pattern/${id}`} replace />
      } else {
        card = <PatternCard id={id} />
      }
    }
    return (
      <>
        <Graph />
        {card}
        <Intro />
      </>
    )
  }

  return (
    <Switch>
      <Route path="/patterns" component={PatternIndex} />
      <Route path="/colophon" component={Colophon} />
      {GlyphGrid ? (
        <Route path="/dev/glyphs">
          <Suspense fallback={null}>
            <GlyphGrid />
          </Suspense>
        </Route>
      ) : null}
      <Route>
        <main style={{ maxWidth: '38rem', margin: '0 auto', padding: '2rem 1rem' }}>
          <p>
            Nothing here. <Link href="/">Back to the map</Link>.
          </p>
        </main>
      </Route>
    </Switch>
  )
}
