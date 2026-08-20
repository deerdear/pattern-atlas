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

/** Convex hull (Andrew monotone chain). Returns an open ring, CCW. */
export function convexHull(points: Ring): Ring {
  const pts = [...points].sort((a, b) => a[0] - b[0] || a[1] - b[1])
  if (pts.length < 3) return pts
  const cross = (
    o: readonly [number, number],
    a: readonly [number, number],
    b: readonly [number, number],
  ) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0])
  const lower: (readonly [number, number])[] = []
  for (const p of pts) {
    while (lower.length >= 2 && cross(lower[lower.length - 2]!, lower[lower.length - 1]!, p) <= 0)
      lower.pop()
    lower.push(p)
  }
  const upper: (readonly [number, number])[] = []
  for (const p of [...pts].reverse()) {
    while (upper.length >= 2 && cross(upper[upper.length - 2]!, upper[upper.length - 1]!, p) <= 0)
      upper.pop()
    upper.push(p)
  }
  return [...lower.slice(0, -1), ...upper.slice(0, -1)]
}

/** Pushes every hull vertex radially away from the centroid by pad units. */
export function padRing(ring: Ring, pad: number): Ring {
  const c = polygonCentroid(ring)
  return ring.map(([x, y]) => {
    const d = Math.hypot(x - c.x, y - c.y) || 1
    const f = (d + pad) / d
    return [
      Math.round((c.x + (x - c.x) * f) * 10) / 10,
      Math.round((c.y + (y - c.y) * f) * 10) / 10,
    ] as const
  })
}

/**
 * Closed smooth path through a ring: quadratic curves through successive
 * edge midpoints — the hand-drawn hedgerow line of the village map.
 */
export function closedSplinePath(ring: Ring): string {
  const n = ring.length
  if (n < 3) return ''
  const mid = (i: number): readonly [number, number] => {
    const [x1, y1] = ring[i % n]!
    const [x2, y2] = ring[(i + 1) % n]!
    return [Math.round(((x1 + x2) / 2) * 10) / 10, Math.round(((y1 + y2) / 2) * 10) / 10]
  }
  let d = `M${mid(n - 1).join(' ')}`
  for (let i = 0; i < n; i++) {
    const [px, py] = ring[i]!
    d += `Q${px} ${py} ${mid(i).join(' ')}`
  }
  return d + 'Z'
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
