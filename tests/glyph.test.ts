import { describe, expect, it } from 'vitest'
import {
  ARC_SWEEP,
  COMPOSITIONS,
  DOT_RADIUS,
  GLYPH_BOX,
  NODE_RADIUS,
  STROKE_WIDTH,
  glyphFor,
} from '../src/lib/glyph'
import { patterns } from '../src/data/patterns'
import type { Confidence } from '../src/data/schema'

const CONFIDENCES: Confidence[] = [0, 1, 2]

describe('glyph grammar', () => {
  it('is deterministic: same id and confidence, same figure', () => {
    expect(glyphFor(42, 1)).toEqual(glyphFor(42, 1))
    expect(glyphFor(253, 2)).toEqual(glyphFor(253, 2))
  })

  it('generates every pattern from the fixed grammar', () => {
    for (const p of patterns) {
      const g = glyphFor(p.id, p.confidence)
      expect(g.rotationDeg % 30).toBe(0) // rotation snapped to 30°
      expect(COMPOSITIONS).toContain(g.composition)
      const tickCount = (g.tickPath.match(/M/g) ?? []).length
      expect(tickCount).toBeGreaterThanOrEqual(2)
      expect(tickCount).toBeLessThanOrEqual(4)
      expect(g.arcPath).not.toBe('')
    }
  })

  it('keeps all geometry inside the 16px design box', () => {
    const half = GLYPH_BOX / 2
    for (const p of patterns) {
      const g = glyphFor(p.id, p.confidence)
      const coords = `${g.arcPath} ${g.tickPath}`
        .match(/-?\d+(\.\d+)?/g)!
        .map(Number)
        // skip A-command flags/rx/ry by magnitude filter: all real coords and
        // radii here are ≤ half; anything larger is a bug.
        .filter((n) => Math.abs(n) > half)
      expect(coords).toEqual([])
      expect(Math.hypot(g.dot.cx, g.dot.cy) + g.dot.r).toBeLessThanOrEqual(half)
    }
  })

  it('encodes confidence as size, weight, and arc completeness', () => {
    expect(NODE_RADIUS[2]).toBeGreaterThan(NODE_RADIUS[1])
    expect(NODE_RADIUS[1]).toBeGreaterThan(NODE_RADIUS[0])
    expect(DOT_RADIUS[2]).toBeGreaterThan(DOT_RADIUS[1])
    expect(DOT_RADIUS[1]).toBeGreaterThan(DOT_RADIUS[0])
    expect(STROKE_WIDTH[2]).toBeGreaterThan(STROKE_WIDTH[1])
    expect(STROKE_WIDTH[1]).toBeGreaterThan(STROKE_WIDTH[0])
    expect(ARC_SWEEP[2]).toBe(360) // closed circle
    expect(ARC_SWEEP[1]).toBeLessThan(360)
    expect(ARC_SWEEP[0]).toBeLessThan(180) // literally incomplete figure
    // Full circle renders as two arcs; partial confidence as one open arc.
    const [c0, c1, c2] = CONFIDENCES.map((c) => glyphFor(7, c).arcPath)
    expect((c2!.match(/A/g) ?? []).length).toBe(2)
    expect(c0).not.toBe(c1)
    expect(c1).not.toBe(c2)
  })

  it('varies arrangement across ids (seed chooses arrangement only)', () => {
    const rotations = new Set(patterns.map((p) => glyphFor(p.id, p.confidence).rotationDeg))
    const comps = new Set(patterns.map((p) => glyphFor(p.id, p.confidence).composition))
    expect(rotations.size).toBeGreaterThan(4)
    expect(comps.size).toBe(COMPOSITIONS.length)
  })
})
