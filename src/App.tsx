// Route shell. Phase 2: the map at /, the a11y index at /patterns, and a
// dev-only glyph grid. Phase 3 adds /pattern/:id and the not-found card.

import { lazy, Suspense } from 'react'
import { Link, Route, Switch } from 'wouter'
import Graph from './atlas/Graph'
import PatternIndex from './index/PatternIndex'

const GlyphGrid = import.meta.env.DEV
  ? lazy(() => import('./atlas/GlyphGrid'))
  : null

export default function App() {
  return (
    <Switch>
      <Route path="/" component={Graph} />
      <Route path="/patterns" component={PatternIndex} />
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
