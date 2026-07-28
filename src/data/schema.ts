// Pure data schema for A Pattern Language metadata.
// Must stay free of React and app imports (AD-6: reusable by sibling projects).

export type PatternId = number & { readonly __brand: 'PatternId' }
export type Scale = 'towns' | 'buildings' | 'construction'
export type Confidence = 0 | 1 | 2

export interface Pattern {
  id: PatternId
  name: string
  confidence: Confidence
  category: string
  /** Original one-liner, <= 140 chars. Absent until human-reviewed. */
  gist?: string
  /** Larger patterns this one helps complete (sources of incoming edges). */
  broader: PatternId[]
  /** Smaller patterns that complete this one (targets of outgoing edges). */
  narrower: PatternId[]
}

/**
 * Unbranded structural twin of Pattern, used by the generated data module:
 * literals `satisfies` PatternData for compile-time validation (confidence
 * stays 0|1|2, no missing fields), then cast to the branded Pattern.
 */
export interface PatternData {
  id: number
  name: string
  confidence: Confidence
  category: string
  gist?: string
  broader: number[]
  narrower: number[]
}

export const PATTERN_COUNT = 253

export function isPatternId(n: number): n is PatternId {
  return Number.isInteger(n) && n >= 1 && n <= PATTERN_COUNT
}

/**
 * The only producer of PatternId from user input (route params, palette).
 * Normalizes forms like "012"; rejects everything else.
 */
export function parsePatternId(raw: string): PatternId | null {
  if (!/^\d{1,3}$/.test(raw)) return null
  const n = Number(raw)
  return isPatternId(n) ? n : null
}

/** Scale is derived from id, never stored — one source of truth. */
export function scaleForId(id: PatternId): Scale {
  if (id <= 94) return 'towns'
  if (id <= 204) return 'buildings'
  return 'construction'
}

/** Neighbors = deduped broader ∪ narrower, for Neighborhood Glow. */
export function buildAdjacency(
  patterns: readonly Pattern[],
): ReadonlyMap<PatternId, readonly PatternId[]> {
  const adjacency = new Map<PatternId, readonly PatternId[]>()
  for (const p of patterns) {
    adjacency.set(p.id, [...new Set([...p.broader, ...p.narrower])])
  }
  return adjacency
}
