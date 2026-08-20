import type { PatternId } from './schema'
import { positions } from './layout'

export interface Point {
  x: number
  y: number
}

/**
 * Baked layout position for a pattern. Throws rather than returning
 * undefined — "every id has a position" is an integrity-tested invariant.
 */
export function positionFor(id: PatternId): Point {
  const p = positions[id]
  if (!p) throw new Error(`no layout position for pattern ${id}`)
  return p
}
