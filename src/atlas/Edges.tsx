// Static edge field (AD-3): all 1,758 edges batched into a few concatenated
// <path> elements instead of ~1,800 individual ones, grouped by the deepest
// scale they touch so each semantic tier can light its own streets: an edge
// between towns patterns belongs to the town plan; an edge touching a
// construction pattern belongs to the detail drawings. pointer-events: none;
// highlighted edges draw separately over this in Graph.tsx.

import { memo } from 'react'
import { patterns } from '../data/patterns'
import { positionFor } from '../data/position'

const EDGES_PER_PATH = 500

export const EDGE_LEVELS = ['towns', 'buildings', 'construction'] as const
export type EdgeLevel = (typeof EDGE_LEVELS)[number]

function levelOf(a: number, b: number): EdgeLevel {
  if (a > 204 || b > 204) return 'construction'
  if (a > 94 || b > 94) return 'buildings'
  return 'towns'
}

function buildChunks(): {
  chunks: { level: EdgeLevel; d: string }[]
  count: number
} {
  const segments: Record<EdgeLevel, string[]> = {
    towns: [],
    buildings: [],
    construction: [],
  }
  let count = 0
  for (const p of patterns) {
    const from = positionFor(p.id)
    for (const n of p.narrower) {
      const to = positionFor(n)
      segments[levelOf(p.id, n)].push(`M${from.x} ${from.y}L${to.x} ${to.y}`)
      count++
    }
  }
  const chunks: { level: EdgeLevel; d: string }[] = []
  for (const level of EDGE_LEVELS) {
    const segs = segments[level]
    for (let i = 0; i < segs.length; i += EDGES_PER_PATH) {
      chunks.push({ level, d: segs.slice(i, i + EDGES_PER_PATH).join('') })
    }
  }
  return { chunks, count }
}

const built = buildChunks()
export const edgeCount = built.count
export const edgeChunkCount = built.chunks.length

export const Edges = memo(function Edges() {
  return (
    <>
      {built.chunks.map((c, i) => (
        <path key={i} className={`edge-${c.level}`} d={c.d} />
      ))}
    </>
  )
})
