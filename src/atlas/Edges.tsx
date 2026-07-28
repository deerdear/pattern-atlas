// Static edge field (AD-3): all 1,758 edges batched into a few concatenated
// <path> elements instead of ~1,800 individual ones. pointer-events: none;
// highlighted edges draw separately over this in Graph.tsx.

import { memo } from 'react'
import { patterns } from '../data/patterns'
import { positionFor } from '../data/position'

const EDGES_PER_PATH = 500

function buildChunks(): { chunks: string[]; count: number } {
  const segments: string[] = []
  for (const p of patterns) {
    const from = positionFor(p.id)
    for (const n of p.narrower) {
      const to = positionFor(n)
      segments.push(`M${from.x} ${from.y}L${to.x} ${to.y}`)
    }
  }
  const chunks: string[] = []
  for (let i = 0; i < segments.length; i += EDGES_PER_PATH) {
    chunks.push(segments.slice(i, i + EDGES_PER_PATH).join(''))
  }
  return { chunks, count: segments.length }
}

const built = buildChunks()
export const edgeCount = built.count
export const edgeChunkCount = built.chunks.length

export const Edges = memo(function Edges() {
  return (
    <>
      {built.chunks.map((d, i) => (
        <path key={i} d={d} />
      ))}
    </>
  )
})
