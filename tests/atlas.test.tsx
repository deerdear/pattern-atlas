import { describe, expect, it } from 'vitest'
import { renderToString } from 'react-dom/server'
import { act } from 'react'
import { createRoot } from 'react-dom/client'
import Graph from '../src/atlas/Graph'
import { edgeChunkCount, edgeCount } from '../src/atlas/Edges'
import { adjacency, highlightFor } from '../src/atlas/glow'
import { fitTransform, tierFor } from '../src/atlas/useCamera'
import { patterns } from '../src/data/patterns'

describe('graph scene', () => {
  const html = renderToString(<Graph />)

  it('places all 253 glyphs with <use> over <symbol> defs', () => {
    expect((html.match(/<symbol/g) ?? []).length).toBe(253)
    expect((html.match(/<use/g) ?? []).length).toBe(253)
  })

  it('batches the static edge field into a few concatenated paths', () => {
    expect(edgeCount).toBe(1758) // pinned aggregate
    expect(edgeChunkCount).toBeLessThanOrEqual(5)
  })

  it('renders band furniture and the legend', () => {
    expect(html).toContain('towns · 1–94')
    expect(html).toContain('construction · 205–253')
    expect((html.match(/class="band-rules"/g) ?? []).length).toBe(1)
    expect(html).toContain('Legend')
    expect(html).toContain('your path this session')
  })

  it('marks the SVG as decoration with a pointer to the index', () => {
    expect(html).toContain('role="img"')
    expect(html).toContain('/patterns')
  })
})

describe('neighborhood glow', () => {
  it('highlights exactly n+1 nodes and n edges for every pattern', () => {
    for (const p of patterns) {
      const n = adjacency.get(p.id)!.length
      const { ids, edgePath } = highlightFor(p.id)
      expect(ids.length).toBe(n + 1)
      expect((edgePath.match(/M/g) ?? []).length).toBe(n)
      expect(ids[0]).toBe(p.id)
    }
  })
})

describe('camera math', () => {
  it('fits the world into the viewport with breathing room', () => {
    const world = { x0: 0, y0: 0, x1: 1000, y1: 1500 }
    const t = fitTransform(world, 1000, 750)
    expect(t.k).toBeCloseTo(0.475)
    // Centered horizontally: world center maps to viewport center.
    expect(t.applyX(500)).toBeCloseTo(500)
    expect(t.applyY(750)).toBeCloseTo(375)
  })

  it('collapses glyphs to dots below the LOD threshold', () => {
    expect(tierFor(0.69)).toBe('dot')
    expect(tierFor(0.7)).toBe('glyph')
  })
})

describe('mounted graph (jsdom)', () => {
  it('mounts, applies the camera transform, and wires hit targets', async () => {
    ;(globalThis as { IS_REACT_ACT_ENVIRONMENT?: boolean }).IS_REACT_ACT_ENVIRONMENT = true
    const container = document.createElement('div')
    document.body.appendChild(container)
    await act(async () => {
      createRoot(container).render(<Graph />)
    })
    const scene = container.querySelector('.scene')!
    expect(scene.getAttribute('transform')).toMatch(/translate\(.+\) scale\(.+\)/)
    expect(container.querySelectorAll('.node .hit').length).toBe(253)
    expect(container.querySelectorAll('.node[data-id]').length).toBe(253)
    container.remove()
  })
})
