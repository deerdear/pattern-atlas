import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from '../src/App'
import PatternIndex from '../src/index/PatternIndex'

describe('App smoke', () => {
  it('serves the map at /', () => {
    window.history.replaceState(null, '', '/')
    const html = renderToString(<App />)
    expect(html).toContain('atlas-svg')
    expect((html.match(/<use/g) ?? []).length).toBe(253)
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
