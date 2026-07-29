// Small planar helpers shared by the layout baker and the integrity tests.
// Pure module (AD-6): no React, no app imports.

export type Ring = readonly (readonly [number, number])[]

/** Ray-cast point-in-polygon. The ring may be open or closed. */
export function pointInPolygon(x: number, y: number, ring: Ring): boolean {
  let inside = false
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) {
      inside = !inside
    }
  }
  return inside
}

/** Area-weighted centroid of a simple polygon. */
export function polygonCentroid(ring: Ring): { x: number; y: number } {
  let area = 0
  let cx = 0
  let cy = 0
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) {
    const [xi, yi] = ring[i]!
    const [xj, yj] = ring[j]!
    const cross = xj * yi - xi * yj
    area += cross
    cx += (xi + xj) * cross
    cy += (yi + yj) * cross
  }
  if (area === 0) {
    const [x0, y0] = ring[0] ?? [0, 0]
    return { x: x0, y: y0 }
  }
  return { x: cx / (3 * area), y: cy / (3 * area) }
}
