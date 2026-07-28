// Integrity suite for the generated dataset (plan: "Data model" rules).
// Pinned aggregates are deliberate constants: changing the data means
// changing them here in the same commit, with a note in validation.md.

import { describe, expect, it } from 'vitest'
import { patterns } from '../src/data/patterns'
import {
  PATTERN_COUNT,
  buildAdjacency,
  parsePatternId,
  scaleForId,
  type PatternId,
} from '../src/data/schema'

const EDGE_COUNT = 1686 // cleaned: raw 1858 minus 66 self-edges and 106 dups
const BAND_COUNTS = { towns: 94, buildings: 110, construction: 49 }
const DIRECTION_QUIRKS = 199 // unique non-self edges with source > target
// 75 and 211: threads conflated into 73/201 by upstream id collisions;
// see data-notes/validation.md open items. 1 has no broader (top of ladder)
// but is not an orphan.
const ORPHAN_ALLOWLIST = new Set([75, 211])

const byId = new Map(patterns.map((p) => [p.id as number, p]))

describe('pattern ids', () => {
  it('are exactly 1..253 with no gaps or duplicates', () => {
    expect(patterns.length).toBe(PATTERN_COUNT)
    const ids = patterns.map((p) => p.id as number)
    expect([...ids].sort((a, b) => a - b)).toEqual(
      Array.from({ length: PATTERN_COUNT }, (_, i) => i + 1),
    )
  })

  it('fall into the pinned scale bands', () => {
    const counts = { towns: 0, buildings: 0, construction: 0 }
    for (const p of patterns) counts[scaleForId(p.id)]++
    expect(counts).toEqual(BAND_COUNTS)
  })
})

describe('names', () => {
  it('are non-empty, trimmed, and not digits-only', () => {
    for (const p of patterns) {
      expect(p.name).toBeTruthy()
      expect(p.name).toBe(p.name.trim())
      expect(p.name).not.toMatch(/^\d+$/)
    }
  })

  it('are unique (case-insensitive)', () => {
    const seen = new Set(patterns.map((p) => p.name.toLowerCase()))
    expect(seen.size).toBe(PATTERN_COUNT)
  })
})

describe('categories', () => {
  it("come from a closed set of the book's section headings", () => {
    const categories = new Set(patterns.map((p) => p.category))
    // 35 subsection headings in the source; pinned so free-text drift fails.
    expect(categories.size).toBe(35)
    for (const c of categories) expect(c).toBeTruthy()
  })
})

describe('edges', () => {
  it('total the pinned count with no self-edges or duplicates', () => {
    let total = 0
    for (const p of patterns) {
      total += p.narrower.length
      expect(new Set(p.narrower as number[]).size).toBe(p.narrower.length)
      expect(new Set(p.broader as number[]).size).toBe(p.broader.length)
      expect(p.narrower).not.toContain(p.id)
      expect(p.broader).not.toContain(p.id)
    }
    expect(total).toBe(EDGE_COUNT)
  })

  it('reference only existing patterns', () => {
    for (const p of patterns) {
      for (const id of [...p.broader, ...p.narrower]) {
        expect(byId.has(id as number)).toBe(true)
      }
    }
  })

  it('broader and narrower are consistent inverses', () => {
    for (const p of patterns) {
      for (const n of p.narrower) {
        expect(byId.get(n as number)!.broader).toContain(p.id)
      }
      for (const b of p.broader) {
        expect(byId.get(b as number)!.narrower).toContain(p.id)
      }
    }
  })

  it('id-direction quirks match the pinned count', () => {
    // The book's threads mostly run small id -> large id but genuinely
    // cross the numbering in places; pin the count so drift is loud.
    let quirks = 0
    for (const p of patterns) {
      quirks += p.narrower.filter((n) => (n as number) < (p.id as number)).length
    }
    expect(quirks).toBe(DIRECTION_QUIRKS)
  })

  it('only allowlisted patterns are orphans', () => {
    for (const p of patterns) {
      const orphan = p.broader.length === 0 && p.narrower.length === 0
      expect(orphan, `pattern ${p.id}`).toBe(ORPHAN_ALLOWLIST.has(p.id as number))
    }
  })
})

describe('confidence', () => {
  it('is 0, 1, or 2 for every pattern', () => {
    for (const p of patterns) expect([0, 1, 2]).toContain(p.confidence)
  })

  it('has the expected spread (not all one value)', () => {
    const spread = new Set(patterns.map((p) => p.confidence))
    expect(spread.size).toBe(3)
  })
})

describe('gists', () => {
  it('when present are original one-liners within 140 chars', () => {
    for (const p of patterns) {
      if (p.gist !== undefined) {
        expect(p.gist.length).toBeGreaterThan(0)
        expect(p.gist.length).toBeLessThanOrEqual(140)
      }
    }
  })
})

describe('schema helpers', () => {
  it('parsePatternId accepts 1..253 and normalizes zero-padding', () => {
    expect(parsePatternId('1')).toBe(1)
    expect(parsePatternId('012')).toBe(12)
    expect(parsePatternId('253')).toBe(253)
    for (const bad of ['0', '254', 'abc', '12.5', '-3', '', '1e2', '00']) {
      expect(parsePatternId(bad), bad).toBeNull()
    }
  })

  it('scaleForId matches the band boundaries', () => {
    const id = (n: number) => n as PatternId
    expect(scaleForId(id(1))).toBe('towns')
    expect(scaleForId(id(94))).toBe('towns')
    expect(scaleForId(id(95))).toBe('buildings')
    expect(scaleForId(id(204))).toBe('buildings')
    expect(scaleForId(id(205))).toBe('construction')
    expect(scaleForId(id(253))).toBe('construction')
  })

  it('buildAdjacency unions broader and narrower without duplicates', () => {
    const adjacency = buildAdjacency(patterns)
    expect(adjacency.size).toBe(PATTERN_COUNT)
    const p180 = byId.get(180)!
    const neighbors = adjacency.get(p180.id)!
    expect(neighbors.length).toBe(
      new Set([...p180.broader, ...p180.narrower]).size,
    )
  })
})
