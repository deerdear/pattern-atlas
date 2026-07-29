// Footprint grammar: deterministic, box-contained, one edition.

import { describe, expect, it } from 'vitest'
import { footprintFor, PLANS } from '../src/lib/footprint'

const BUILDING_IDS = Array.from({ length: 110 }, (_, i) => 95 + i)

describe('footprint grammar', () => {
  it('is deterministic', () => {
    for (const id of BUILDING_IDS) {
      expect(footprintFor(id)).toEqual(footprintFor(id))
    }
  })

  it('stays inside its declared bounding box', () => {
    for (const id of BUILDING_IDS) {
      const f = footprintFor(id)
      // Walk the absolute M/L/H/V/Z commands, tracking the pen.
      let x = 0
      let y = 0
      for (const [, cmd, args] of (f.outline + f.wall).matchAll(
        /([MLHVZ])([^MLHVZ]*)/g,
      )) {
        const nums = (args!.match(/-?\d+(\.\d+)?/g) ?? []).map(Number)
        if (cmd === 'H') x = nums[0]!
        else if (cmd === 'V') y = nums[0]!
        else if (cmd === 'M' || cmd === 'L') [x, y] = [nums[0]!, nums[1]!]
        else continue // Z
        expect(Math.abs(x), `footprint ${id} x`).toBeLessThanOrEqual(f.hw + 0.1)
        expect(Math.abs(y), `footprint ${id} y`).toBeLessThanOrEqual(f.hh + 0.1)
      }
    }
  })

  it('uses every canonical plan across the edition', () => {
    const seen = new Set(BUILDING_IDS.map((id) => footprintFor(id).plan))
    expect([...seen].sort()).toEqual([...PLANS].sort())
  })
})
