import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from '../src/App'
import PatternIndex from '../src/index/PatternIndex'
import { patterns } from '../src/data/patterns'

describe('App smoke', () => {
  it('serves the map at /', () => {
    window.history.replaceState(null, '', '/')
    const html = renderToString(<App />)
    expect(html).toContain('atlas-svg')
    expect((html.match(/<use/g) ?? []).length).toBe(253)
  })

  it('serves a pattern card over the map at /pattern/180', () => {
    window.history.replaceState(null, '', '/pattern/180')
    const html = renderToString(<App />)
    const p = patterns.find((x) => x.id === 180)!
    expect(html).toContain('atlas-svg') // the map stays underneath
    expect(html).toContain('Window Place')
    expect(html).toContain('Alexander’s confidence')
    for (const n of [...p.broader, ...p.narrower]) {
      expect(html).toContain(`/pattern/${n}`)
    }
  })

  it('renders a not-found card at bad pattern URLs', () => {
    for (const bad of ['/pattern/999', '/pattern/abc', '/pattern/0']) {
      window.history.replaceState(null, '', bad)
      const html = renderToString(<App />)
      expect(html, bad).toContain('No pattern here')
      expect(html, bad).toContain('atlas-svg')
    }
  })
})

describe('pattern index (/patterns a11y surface)', () => {
  it('lists all 253 patterns', () => {
    const html = renderToString(<PatternIndex />)
    expect((html.match(/<li/g) ?? []).length).toBe(253)
    expect(html).toContain('Window Place')
    expect(html).toContain('Independent Regions')
  })
})
