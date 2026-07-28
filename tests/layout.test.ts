// Layout integrity: complete coverage, band containment, freshness.

import { createHash } from 'node:crypto'
import { readFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { describe, expect, it } from 'vitest'
import { layoutInputHash, positions } from '../src/data/layout'
import { patterns } from '../src/data/patterns'
import { positionFor } from '../src/data/position'
import { scaleForId, type Scale } from '../src/data/schema'

// Must mirror scripts/compute-layout.ts
const BAND: Record<Scale, number> = { towns: 250, buildings: 750, construction: 1250 }
const BAND_HALF = 230

describe('layout', () => {
  it('positions every pattern', () => {
    for (const p of patterns) {
      const pos = positionFor(p.id)
      expect(Number.isFinite(pos.x)).toBe(true)
      expect(Number.isFinite(pos.y)).toBe(true)
    }
    expect(Object.keys(positions).length).toBe(patterns.length)
  })

  it('keeps every node inside its scale band', () => {
    for (const p of patterns) {
      const { y } = positionFor(p.id)
      const center = BAND[scaleForId(p.id)]
      expect(y, `pattern ${p.id}`).toBeGreaterThanOrEqual(center - BAND_HALF)
      expect(y, `pattern ${p.id}`).toBeLessThanOrEqual(center + BAND_HALF)
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
