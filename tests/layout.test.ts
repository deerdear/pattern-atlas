// Layout integrity: complete coverage, the town-plan containment contract
// (buildings inside their parent district, details near their building),
// and freshness.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { canvas, districts, layoutInputHash, parents, positions } from '../src/data/layout'
import { patterns } from '../src/data/patterns'
import { positionFor } from '../src/data/position'
import { scaleForId, type PatternId } from '../src/data/schema'
import { pointInPolygon } from '../src/lib/geometry'

describe('layout', () => {
  it('positions every pattern on the canvas', () => {
    for (const p of patterns) {
      const pos = positionFor(p.id)
      expect(Number.isFinite(pos.x)).toBe(true)
      expect(Number.isFinite(pos.y)).toBe(true)
      expect(pos.x, `pattern ${p.id}`).toBeGreaterThanOrEqual(0)
      expect(pos.x, `pattern ${p.id}`).toBeLessThanOrEqual(canvas.w)
      expect(pos.y, `pattern ${p.id}`).toBeGreaterThanOrEqual(0)
      expect(pos.y, `pattern ${p.id}`).toBeLessThanOrEqual(canvas.h)
    }
    expect(Object.keys(positions).length).toBe(patterns.length)
  })

  it('tessellates every towns pattern into a district cell', () => {
    const townIds = patterns.filter((p) => scaleForId(p.id) === 'towns')
    expect(Object.keys(districts).length).toBe(townIds.length)
    for (const p of townIds) {
      const cell = districts[p.id]
      expect(cell, `town ${p.id}`).toBeDefined()
      expect(cell!.length).toBeGreaterThanOrEqual(4) // closed ring
    }
  })

  it('assigns every pattern a parent on the scale above', () => {
    for (const p of patterns) {
      const scale = scaleForId(p.id)
      if (scale === 'towns') {
        expect(parents[p.id]).toBeUndefined()
      } else if (scale === 'buildings') {
        const t = parents[p.id]
        expect(t, `building ${p.id}`).toBeDefined()
        expect(t!).toBeLessThanOrEqual(94)
      } else {
        const b = parents[p.id]
        expect(b, `detail ${p.id}`).toBeDefined()
        expect(b!).toBeGreaterThan(94)
        expect(b!).toBeLessThanOrEqual(204)
      }
    }
  })

  it('keeps every building and detail inside its parent district', () => {
    for (const p of patterns) {
      const scale = scaleForId(p.id)
      if (scale === 'towns') continue
      const town = scale === 'buildings' ? parents[p.id]! : parents[parents[p.id]!]!
      const cell = districts[town]!
      const { x, y } = positionFor(p.id)
      expect(pointInPolygon(x, y, cell), `pattern ${p.id} in district ${town}`).toBe(true)
    }
  })

  it('settles every construction detail against its building', () => {
    for (const p of patterns) {
      if (scaleForId(p.id) !== 'construction') continue
      const b = positionFor(parents[p.id]! as PatternId)
      const d = positionFor(p.id)
      expect(Math.hypot(d.x - b.x, d.y - b.y), `detail ${p.id}`).toBeLessThan(80)
    }
  })

  it('was baked from the current patterns.ts (no stale layout)', () => {
    const ts = readFileSync(
      join(dirname(fileURLToPath(import.meta.url)), '../src/data/patterns.ts'),
      'utf8',
    )
    expect(createHash('sha256').update(ts).digest('hex')).toBe(layoutInputHash)
  })

  it('rounds coordinates to 1 decimal (determinism guard)', () => {
    for (const p of patterns) {
      const { x, y } = positionFor(p.id)
      expect(Math.round(x * 10) / 10).toBe(x)
      expect(Math.round(y * 10) / 10).toBe(y)
    }
  })
})
