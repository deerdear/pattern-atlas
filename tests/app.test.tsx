import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import App from '../src/App'

describe('App smoke', () => {
  it('lists all 253 patterns', () => {
    const html = renderToString(<App />)
    expect((html.match(/<li/g) ?? []).length).toBe(253)
    expect(html).toContain('Window Place')
    expect(html).toContain('Independent Regions')
  })
})
