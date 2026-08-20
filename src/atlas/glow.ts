// Pure Neighborhood Glow computation: which nodes light up and what the
// highlighted-edge overlay draws for a hovered/selected pattern. Kept out
// of Graph.tsx so the n+1 nodes / n edges contract is unit-testable.

import { patterns } from '../data/patterns'
import { positionFor } from '../data/position'
import { buildAdjacency, type PatternId } from '../data/schema'

export const adjacency = buildAdjacency(patterns)

const byId = new Map(patterns.map((p) => [p.id, p]))

export interface Highlight {
  /** The pattern itself plus its 1-hop thread (n+1 ids). */
  ids: readonly PatternId[]
  /** Path data drawing exactly the n edges of the thread. */
  edgePath: string
}

export function highlightFor(id: PatternId): Highlight {
  const p = byId.get(id)
  if (!p) throw new Error(`unknown pattern ${id}`)
  const neighbors = adjacency.get(id) ?? []
  const from = positionFor(id)
  const edgePath = [...p.broader, ...p.narrower]
    .map((n) => {
      const to = positionFor(n)
      return `M${from.x} ${from.y}L${to.x} ${to.y}`
    })
    .join('')
  return { ids: [id, ...neighbors], edgePath }
}
