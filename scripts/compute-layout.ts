// Bakes the town-plan layout at build time (AD-3): the browser never
// simulates. The map is cartographic, not banded — zooming descends the
// ladder of scales like approaching a real town:
//
//   1. The 94 towns-scale patterns get a force layout over the canvas, then
//      a Voronoi tessellation turns each into a DISTRICT cell.
//   2. Every buildings-scale pattern is assigned a parent district (via its
//      broader links, walking up until a towns-scale ancestor is found) and
//      packed inside that district's cell — a BUILDING on the plan.
//   3. Every construction-scale pattern is assigned a parent building the
//      same way and settles against it — a DETAIL on the drawing.
//
// Determinism: nodes and links enter sorted by id, every simulation's
// randomSource is seeded (splitmix32), tick counts are fixed, and
// coordinates round to 1 decimal. Running twice must be byte-identical.
//
// Run: npm run data:layout

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { Delaunay } from 'd3-delaunay'
import {
  forceCollide,
  forceLink,
  forceManyBody,
  forceSimulation,
  forceX,
  forceY,
  type SimulationLinkDatum,
  type SimulationNodeDatum,
} from 'd3-force'
import {
  closedSplinePath,
  convexHull,
  padRing,
  pointInPolygon,
  type Ring,
} from '../src/lib/geometry.ts'
import { splitmix32 } from '../src/lib/prng.ts'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const PATTERNS_PATH = join(root, 'src/data/patterns.ts')
const OUT_PATH = join(root, 'src/data/layout.ts')

interface LayoutNode extends SimulationNodeDatum {
  id: number
}

// Canvas in abstract world units; the renderer fits it to the viewport.
const CANVAS = { w: 1600, h: 1200 } as const
const MARGIN = 70 // town centers keep this far from the canvas edge
const SEED = 0x9a7031 // arbitrary, fixed forever

const round1 = (n: number) => Math.round(n * 10) / 10

// --- Load the generated dataset (parse the JSON literal back out) --------
const ts = readFileSync(PATTERNS_PATH, 'utf8')
const inputHash = createHash('sha256').update(ts).digest('hex')
const match = ts.match(/= (\[[\s\S]*\]) satisfies/)
if (!match) throw new Error('cannot parse src/data/patterns.ts')
const patterns = JSON.parse(match[1]!) as {
  id: number
  category: string
  broader: number[]
  narrower: number[]
}[]
const byId = new Map(patterns.map((p) => [p.id, p]))

const towns = patterns.filter((p) => p.id <= 94)
const buildings = patterns.filter((p) => p.id > 94 && p.id <= 204)
const construction = patterns.filter((p) => p.id > 204)

// --- 1. Parent assignment: every pattern hangs off the scale above -------
// A building's district is its most specific towns-scale ancestor (largest
// towns id among broader links, else recurse through smaller buildings-scale
// broaders). Same scheme one rung down for construction details. The rare
// pattern with no upward path inherits the previous sibling's parent —
// deterministic and logged, never silent.

const townOf = new Map<number, number>()
function resolveTown(id: number): number | undefined {
  if (id <= 94) return id
  if (townOf.has(id)) return townOf.get(id)
  const p = byId.get(id)!
  const direct = p.broader.filter((b) => b <= 94)
  if (direct.length > 0) {
    const t = Math.max(...direct)
    townOf.set(id, t)
    return t
  }
  const upward = p.broader.filter((b) => b > 94 && b <= 204 && b < id).sort((a, b) => b - a)
  for (const b of upward) {
    const t = resolveTown(b)
    if (t !== undefined) {
      townOf.set(id, t)
      return t
    }
  }
  return undefined
}

const buildingOf = new Map<number, number>()
function resolveBuilding(id: number): number | undefined {
  if (buildingOf.has(id)) return buildingOf.get(id)
  const p = byId.get(id)!
  const direct = p.broader.filter((b) => b > 94 && b <= 204)
  if (direct.length > 0) {
    const b = Math.max(...direct)
    buildingOf.set(id, b)
    return b
  }
  const upward = p.broader.filter((b) => b > 204 && b < id).sort((a, b) => b - a)
  for (const c of upward) {
    const b = resolveBuilding(c)
    if (b !== undefined) {
      buildingOf.set(id, b)
      return b
    }
  }
  return undefined
}

let fallbacks = 0
let lastTown = 94
for (const p of buildings) {
  const t = resolveTown(p.id)
  if (t === undefined) {
    townOf.set(p.id, lastTown)
    fallbacks++
  } else {
    lastTown = t
  }
}
let lastBuilding = 204
for (const p of construction) {
  const b = resolveBuilding(p.id)
  if (b === undefined) {
    buildingOf.set(p.id, lastBuilding)
    fallbacks++
  } else {
    lastBuilding = b
  }
}
// A construction detail lives in the district of its building.
for (const p of construction) townOf.set(p.id, townOf.get(buildingOf.get(p.id)!)!)

// --- 2. Town layout + Voronoi districts ----------------------------------
// The village reads as QUARTERS around a green: the book's own towns-scale
// category headings become the quarters, each anchored on a ring around the
// canvas center so same-category patterns settle together.
const childCount = new Map<number, number>(towns.map((t) => [t.id, 0]))
for (const p of patterns) {
  if (p.id > 94) {
    const t = townOf.get(p.id)!
    childCount.set(t, (childCount.get(t) ?? 0) + 1)
  }
}

const quarterNames = [...new Set(towns.map((p) => p.category))].sort(
  (a, b) =>
    Math.min(...towns.filter((p) => p.category === a).map((p) => p.id)) -
    Math.min(...towns.filter((p) => p.category === b).map((p) => p.id)),
)
const anchorOf = new Map<string, { x: number; y: number }>()
quarterNames.forEach((name, i) => {
  const a = -Math.PI / 2 + (2 * Math.PI * i) / quarterNames.length
  anchorOf.set(name, {
    x: CANVAS.w / 2 + 600 * Math.cos(a),
    y: CANVAS.h / 2 + 440 * Math.sin(a),
  })
})
const categoryOf = new Map(patterns.map((p) => [p.id, p.category]))

const townNodes: LayoutNode[] = towns
  .map((p) => ({ id: p.id }))
  .sort((a, b) => a.id - b.id)
const townLinks: SimulationLinkDatum<LayoutNode>[] = towns
  .flatMap((p) =>
    p.narrower.filter((n) => n <= 94).map((n) => ({ source: p.id, target: n })),
  )
  .sort(
    (a, b) =>
      (a.source as number) - (b.source as number) ||
      (a.target as number) - (b.target as number),
  )

const seedRand = splitmix32(SEED)
for (const n of townNodes) {
  const anchor = anchorOf.get(categoryOf.get(n.id)!)!
  n.x = anchor.x + (seedRand() - 0.5) * 120
  n.y = anchor.y + (seedRand() - 0.5) * 120
}

const townSim = forceSimulation(townNodes)
  .randomSource(splitmix32(SEED ^ 0x5f5f5f))
  .force(
    'link',
    forceLink<LayoutNode, SimulationLinkDatum<LayoutNode>>(townLinks)
      .id((d) => d.id)
      .distance(130)
      .strength(0.025),
  )
  .force('charge', forceManyBody().strength(-260).distanceMax(420))
  .force('x', forceX<LayoutNode>((d) => anchorOf.get(categoryOf.get(d.id)!)!.x).strength(0.2))
  .force('y', forceY<LayoutNode>((d) => anchorOf.get(categoryOf.get(d.id)!)!.y).strength(0.2))
  .force(
    'collide',
    forceCollide<LayoutNode>(
      (d) => 40 + 11 * Math.sqrt(childCount.get(d.id) ?? 0),
    ).iterations(2),
  )
  .stop()

const TOWN_TICKS = 300
for (let i = 0; i < TOWN_TICKS; i++) {
  townSim.tick()
  for (const n of townNodes) {
    n.x = Math.min(Math.max(n.x!, MARGIN), CANVAS.w - MARGIN)
    n.y = Math.min(Math.max(n.y!, MARGIN), CANVAS.h - MARGIN)
  }
}

const delaunay = Delaunay.from(
  townNodes,
  (d) => d.x!,
  (d) => d.y!,
)
const voronoi = delaunay.voronoi([0, 0, CANVAS.w, CANVAS.h])
const districts = new Map<number, Ring>()
townNodes.forEach((n, i) => {
  const cell = voronoi.cellPolygon(i)
  if (!cell) throw new Error(`no Voronoi cell for town ${n.id}`)
  districts.set(
    n.id,
    cell.map(([x, y]) => [round1(x!), round1(y!)] as const),
  )
})

// --- 3. Pack each district: buildings settle in the cell, details on their
// building. One seeded simulation per district over its buildings AND their
// construction details, every node clamped into the cell each tick.

const positions = new Map<number, { x: number; y: number }>()
for (const n of townNodes) positions.set(n.id, { x: n.x!, y: n.y! })

function clampIntoCell(n: LayoutNode, cell: Ring, cx: number, cy: number) {
  for (let i = 0; i < 24 && !pointInPolygon(n.x!, n.y!, cell); i++) {
    n.x = n.x! + (cx - n.x!) * 0.18
    n.y = n.y! + (cy - n.y!) * 0.18
  }
  // A final nudge keeps linework off the district boundary.
  n.x = n.x! + (cx - n.x!) * 0.04
  n.y = n.y! + (cy - n.y!) * 0.04
}

const townIds = [...districts.keys()].sort((a, b) => a - b)
for (const townId of townIds) {
  const cell = districts.get(townId)!
  // Children settle around the town itself, not the cell centroid — edge
  // cells sprawl to the canvas rim and their centroids sit in open country.
  const centroid = positions.get(townId)!
  const members = patterns
    .filter((p) => p.id > 94 && townOf.get(p.id) === townId)
    .sort((a, b) => a.id - b.id)
  if (members.length === 0) continue

  const memberIds = new Set(members.map((m) => m.id))
  const nodes: LayoutNode[] = members.map((m) => ({ id: m.id }))
  const rand = splitmix32(SEED ^ (townId * 0x85eb))
  // Seeded phyllotaxis around the centroid.
  nodes.forEach((n, i) => {
    const a = i * 2.3999632 + rand() * Math.PI * 2
    const r = 10 * Math.sqrt(i + 1)
    n.x = centroid.x + r * Math.cos(a)
    n.y = centroid.y + r * Math.sin(a)
  })

  // Details tether to their building, short and stiff.
  const tethers: SimulationLinkDatum<LayoutNode>[] = members
    .filter((m) => m.id > 204 && memberIds.has(buildingOf.get(m.id)!))
    .map((m) => ({ source: buildingOf.get(m.id)!, target: m.id }))
  // Same-scale threads within the district, loose.
  const siblings: SimulationLinkDatum<LayoutNode>[] = members
    .flatMap((m) =>
      m.narrower
        .filter((n) => memberIds.has(n) && (m.id <= 204) === (n <= 204))
        .map((n) => ({ source: m.id, target: n })),
    )
    .sort(
      (a, b) =>
        (a.source as number) - (b.source as number) ||
        (a.target as number) - (b.target as number),
    )

  const sim = forceSimulation(nodes)
    .randomSource(splitmix32(SEED ^ (townId * 0x2545f)))
    .force(
      'tether',
      forceLink<LayoutNode, SimulationLinkDatum<LayoutNode>>(tethers)
        .id((d) => d.id)
        .distance(24)
        .strength(0.9),
    )
    .force(
      'sibling',
      forceLink<LayoutNode, SimulationLinkDatum<LayoutNode>>(siblings)
        .id((d) => d.id)
        .distance(60)
        .strength(0.05),
    )
    .force('charge', forceManyBody().strength(-55).distanceMax(200))
    .force('x', forceX(centroid.x).strength(0.055))
    .force('y', forceY(centroid.y).strength(0.055))
    .force(
      'collide',
      forceCollide<LayoutNode>((d) => (d.id <= 204 ? 28 : 8)).iterations(2),
    )
    .stop()

  const DISTRICT_TICKS = 220
  for (let i = 0; i < DISTRICT_TICKS; i++) {
    sim.tick()
    for (const n of nodes) clampIntoCell(n, cell, centroid.x, centroid.y)
  }
  for (const n of nodes) positions.set(n.id, { x: n.x!, y: n.y! })
}

// --- 4. Village furniture: quarter hulls, district hedges, lanes ---------
// A ring for a member set: padded convex hull, or a seeded rough circle when
// there are too few points to enclose anything.
function hullFor(ids: readonly number[], pad: number, seed: number): Ring {
  const pts: Ring = ids.map((id) => {
    const p = positions.get(id)!
    return [p.x, p.y] as const
  })
  if (pts.length >= 3) {
    const hull = convexHull(pts)
    if (hull.length >= 3) return padRing(hull, pad)
  }
  const cx = pts.reduce((s, p) => s + p[0], 0) / pts.length
  const cy = pts.reduce((s, p) => s + p[1], 0) / pts.length
  const rand = splitmix32(SEED ^ seed)
  const ring: (readonly [number, number])[] = []
  for (let i = 0; i < 8; i++) {
    const a = (2 * Math.PI * i) / 8
    const r = pad * (1.5 + rand() * 0.5)
    ring.push([
      round1(cx + r * Math.cos(a)),
      round1(cy + r * Math.sin(a)),
    ] as const)
  }
  return ring
}

const quarters = quarterNames.map((name, qi) => {
  const ids = towns.filter((p) => p.category === name).map((p) => p.id)
  const cx = ids.reduce((s, id) => s + positions.get(id)!.x, 0) / ids.length
  const cy = ids.reduce((s, id) => s + positions.get(id)!.y, 0) / ids.length
  // Labels float clear of the glyphs, alternating above/below around the
  // ring so neighboring quarters' names never stack.
  const ys = ids.map((id) => positions.get(id)!.y)
  const labelY =
    qi % 2 === 0 ? Math.min(...ys) - 46 : Math.max(...ys) + 64
  return {
    label: name.toLowerCase(),
    cx: round1(cx),
    cy: round1(cy),
    labelY: round1(labelY),
    hull: closedSplinePath(hullFor(ids, 40, qi * 0x1f3d)),
  }
})

const districtHulls = Object.fromEntries(
  townIds.map((townId) => {
    const ids = [
      townId,
      ...patterns.filter((p) => p.id > 94 && townOf.get(p.id) === townId).map((p) => p.id),
    ]
    return [townId, closedSplinePath(hullFor(ids, 34, townId * 0x77))]
  }),
)

// Lanes: the towns-scale threads aggregated quarter-to-quarter. Intra-quarter
// threads stay local streets (invisible at the village view).
const quarterIndex = new Map<number, number>()
towns.forEach((p) => quarterIndex.set(p.id, quarterNames.indexOf(p.category)))
const laneWeight = new Map<string, number>()
for (const p of towns) {
  for (const n of p.narrower) {
    if (n > 94) continue
    const a = quarterIndex.get(p.id)!
    const b = quarterIndex.get(n)!
    if (a === b) continue
    const key = a < b ? `${a}-${b}` : `${b}-${a}`
    laneWeight.set(key, (laneWeight.get(key) ?? 0) + 1)
  }
}
// A village has a few lanes, not a lattice: only the strong threads draw.
const lanes = [...laneWeight.entries()]
  .filter(([, w]) => w >= 5)
  .sort((x, y) => (x[0] < y[0] ? -1 : 1))
  .map(([key, w]) => {
    const [a, b] = key.split('-').map(Number) as [number, number]
    return {
      ax: quarters[a]!.cx,
      ay: quarters[a]!.cy,
      bx: quarters[b]!.cx,
      by: quarters[b]!.cy,
      w,
    }
  })

// --- Emit -----------------------------------------------------------------
if (positions.size !== patterns.length) {
  throw new Error(`positions for ${positions.size}/${patterns.length} patterns`)
}
console.log(`parent fallbacks: ${fallbacks}`)
console.log(`quarters: ${quarters.length}, lanes: ${lanes.length}`)

const positionsOut = Object.fromEntries(
  [...positions.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([id, p]) => [id, { x: round1(p.x), y: round1(p.y) }]),
)
const districtsOut = Object.fromEntries(
  townIds.map((id) => [id, districts.get(id)!.map(([x, y]) => [x, y])]),
)
const parentsOut = Object.fromEntries(
  patterns
    .filter((p) => p.id > 94)
    .sort((a, b) => a.id - b.id)
    .map((p) => [p.id, p.id <= 204 ? townOf.get(p.id)! : buildingOf.get(p.id)!]),
)

const out = `// GENERATED by scripts/compute-layout.ts — do not edit by hand.
// Deterministic town-plan layout (seed ${SEED}): Voronoi districts for the
// towns scale, buildings packed inside their parent district, construction
// details settled against their parent building.
// inputHash guards against a layout baked from stale patterns.ts.
// Regenerate with: npm run data:layout

export const layoutInputHash =
  '${inputHash}'

/** World canvas the layout was baked on. */
export const canvas = { w: ${CANVAS.w}, h: ${CANVAS.h} } as const

export const positions: Readonly<Record<number, { x: number; y: number }>> =
  ${JSON.stringify(positionsOut)}

/** District cell (closed Voronoi ring) per towns-scale pattern. */
export const districts: Readonly<
  Record<number, readonly (readonly [number, number])[]>
> = ${JSON.stringify(districtsOut)}

/**
 * Parent on the scale above: buildings-scale id → its district's towns id;
 * construction-scale id → its parent buildings id.
 */
export const parents: Readonly<Record<number, number>> =
  ${JSON.stringify(parentsOut)}

/**
 * The village quarters: one per towns-scale category heading, with its
 * hedgerow hull (smoothed closed path) and label anchor.
 */
export const quarters: readonly {
  label: string
  cx: number
  cy: number
  labelY: number
  hull: string
}[] = ${JSON.stringify(quarters)}

/** Hedgerow hull around each district's settlement (town + its children). */
export const districtHulls: Readonly<Record<number, string>> =
  ${JSON.stringify(districtHulls)}

/** Quarter-to-quarter lanes: aggregated towns-scale threads with weights. */
export const lanes: readonly {
  ax: number
  ay: number
  bx: number
  by: number
  w: number
}[] = ${JSON.stringify(lanes)}
`
writeFileSync(OUT_PATH, out)
console.log(
  `wrote ${OUT_PATH}: ${positions.size} positions, ${townIds.length} districts`,
)
