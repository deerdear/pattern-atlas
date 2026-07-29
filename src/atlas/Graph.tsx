// The map. Rendering contract (AD-3): React renders the static scene once —
// district cells, batched edges, symbol/use glyphs, footprints, labels —
// and everything interactive happens imperatively: d3-zoom writes the
// camera transform, hover glow marks O(degree) elements. The only React
// state is the discrete semantic tier, which reads the map like a town:
// the town plan first, a district's buildings as you approach, and the
// construction details once you are close enough to touch a wall.

import { memo, useCallback, useEffect, useRef } from 'react'
import { Link, useLocation, useRoute } from 'wouter'
import type { ZoomTransform } from 'd3-zoom'
import { canvas, districtHulls, lanes, quarters } from '../data/layout'
import { patterns } from '../data/patterns'
import { positionFor } from '../data/position'
import { parsePatternId, scaleForId, type PatternId, type Scale } from '../data/schema'
import { footprintFor } from '../lib/footprint'
import { NODE_RADIUS } from '../lib/glyph'
import { splitmix32 } from '../lib/prng'
import { churchElevation, hillHamlet, housePlan, houseRow, type Vignette } from '../lib/sketch'
import { Edges } from './Edges'
import { NodeGlyph, glyphId } from './NodeGlyph'
import { highlightFor } from './glow'
import { useCamera, type LodTier, type World } from './useCamera'
import './atlas.css'

const world: World = {
  x0: -30,
  y0: -30,
  x1: canvas.w + 30,
  y1: canvas.h + 30,
}

const EDGE_WIDTH = 0.65 // at k = 1; scales as width/√k so zoom yields air

/** Per-scale glyph sizing: a town reads at town zoom, a detail up close. */
const SCALE_R: Record<Scale, number> = {
  towns: 1.5,
  buildings: 0.9,
  construction: 0.42,
}

/** Context-dot radius when a scale is one tier below the current view. */
const CTX_DOT_R: Record<Scale, number> = {
  towns: 4,
  buildings: 2.4,
  construction: 1.1,
}

/** Label size in world units, tuned per scale for its home tier's k range. */
const LABEL_SIZE: Record<Scale, number> = {
  towns: 15,
  buildings: 6.5,
  construction: 3.2,
}

const TIER_NOTE: Record<LodTier, string> = {
  town: 'the town — zoom in on a district for its buildings',
  building: 'the buildings — zoom in for construction details',
  construction: 'the construction details',
}

/** All 253 glyph definitions, rendered once into <defs>. */
const GlyphDefs = memo(function GlyphDefs() {
  return (
    <defs>
      {patterns.map((p) => (
        <NodeGlyph key={p.id} id={p.id} confidence={p.confidence} />
      ))}
    </defs>
  )
})

/**
 * Marginalia in the open country around the village: faint architectural
 * vignettes, placed in the corners the quarter ring leaves empty.
 */
const SKETCH_PLACEMENTS: { v: Vignette; x: number; y: number; s: number }[] = [
  { v: hillHamlet(1), x: 250, y: 180, s: 1.4 },
  { v: housePlan(2), x: canvas.w - 230, y: 265, s: 1.25 },
  { v: churchElevation(3), x: 235, y: canvas.h - 105, s: 1.35 },
  { v: houseRow(4), x: canvas.w - 250, y: canvas.h - 110, s: 1.35 },
]

const Sketches = memo(function Sketches() {
  return (
    <>
      {SKETCH_PLACEMENTS.map((p, i) => (
        <path
          key={i}
          className="sketch"
          d={p.v.d}
          transform={`translate(${p.x} ${p.y}) scale(${p.s}) translate(${p.v.dx ?? 0} 0)`}
        />
      ))}
    </>
  )
})

/** The village quarters: one hedgerow hull + one label per category. */
const Quarters = memo(function Quarters() {
  return (
    <>
      {quarters.map((q) => (
        <path key={q.label} className="quarter" d={q.hull} vectorEffect="non-scaling-stroke" />
      ))}
    </>
  )
})

const QuarterLabels = memo(function QuarterLabels() {
  return (
    <>
      {quarters.map((q) => (
        <text key={q.label} className="quarter-label" x={q.cx} y={q.labelY} fontSize={30}>
          {q.label}
        </text>
      ))}
    </>
  )
})

/** Hedges around each district's settlement, for the building tier. */
const DistrictHedges = memo(function DistrictHedges() {
  return (
    <>
      {Object.entries(districtHulls).map(([id, d]) => (
        <path key={id} className="hedge" d={d} vectorEffect="non-scaling-stroke" />
      ))}
    </>
  )
})

/**
 * Quarter-to-quarter lanes: the towns-scale threads bundled into a few
 * curved village lanes, weight = thread count. Each lane bows a little,
 * seeded from its index — straight lines are the one thing no lane does.
 */
const Lanes = memo(function Lanes() {
  return (
    <>
      {lanes.map((l, i) => {
        const rand = splitmix32(0x1a8e ^ i)
        const mx = (l.ax + l.bx) / 2
        const my = (l.ay + l.by) / 2
        const len = Math.hypot(l.bx - l.ax, l.by - l.ay) || 1
        const bow = len * (0.16 + rand() * 0.14) * (rand() < 0.5 ? 1 : -1)
        const cx = mx + (-(l.by - l.ay) / len) * bow
        const cy = my + ((l.bx - l.ax) / len) * bow
        return (
          <path
            key={i}
            className="lane"
            d={`M${l.ax} ${l.ay}Q${cx} ${cy} ${l.bx} ${l.by}`}
            strokeWidth={0.8 + 0.45 * Math.sqrt(l.w)}
          />
        )
      })}
    </>
  )
})

/**
 * The 253 node groups: glyph <use>, building footprint where the scale calls
 * for one, context dot, label, and a generous invisible hit circle.
 */
const Nodes = memo(function Nodes() {
  return (
    <>
      {patterns.map((p) => {
        const { x, y } = positionFor(p.id)
        const scale = scaleForId(p.id)
        const r = NODE_RADIUS[p.confidence] * SCALE_R[scale]
        const fs = LABEL_SIZE[scale]
        const fp = scale === 'buildings' ? footprintFor(p.id) : null
        return (
          <g
            key={p.id}
            className={`node node--${scale}`}
            data-id={p.id}
            transform={`translate(${x} ${y})`}
          >
            {fp && (
              <g className="footprint">
                <path d={fp.outline} />
                <path d={fp.wall} className="footprint-wall" />
              </g>
            )}
            <use href={`#${glyphId(p.id)}`} x={-r} y={-r} width={2 * r} height={2 * r} />
            <circle className="ctx-dot" r={CTX_DOT_R[scale]} />
            <text className="label" y={r + fs} fontSize={fs}>
              {p.name}
            </text>
            <circle className="hit" />
          </g>
        )
      })}
    </>
  )
})

function Legend() {
  return (
    <details className="legend">
      <summary>Legend</summary>
      <div className="legend-row">
        <svg width="46" height="18" aria-hidden="true">
          <circle cx="8" cy="9" r="5.5" fill="currentColor" />
          <circle cx="22" cy="9" r="4.2" fill="currentColor" />
          <circle cx="34" cy="9" r="3" fill="currentColor" />
        </svg>
        <span>
          ** / * / unstarred — Alexander&rsquo;s confidence
        </span>
      </div>
      <div className="legend-row">
        <svg width="46" height="18" aria-hidden="true">
          <path
            d="M3 13 Q 13 4 23 9 T 43 7"
            fill="none"
            stroke="var(--color-red)"
            strokeWidth="2"
            strokeLinecap="round"
          />
        </svg>
        <span>your path this session</span>
      </div>
      <div className="legend-row">
        <svg width="46" height="18" aria-hidden="true">
          <path
            d="M4 15V4h14v11Z M11 4v11"
            fill="none"
            stroke="currentColor"
            strokeWidth="1"
          />
          <path d="M24 15 30 4l12 4-3 7Z" fill="none" stroke="currentColor" strokeWidth="1" />
        </svg>
        <span>zoom in: town → buildings → construction</span>
      </div>
    </details>
  )
}

export default function Graph() {
  const svgRef = useRef<SVGSVGElement>(null)
  const cameraRef = useRef<SVGGElement>(null)
  const edgesRef = useRef<SVGGElement>(null)
  const hiEdgeRef = useRef<SVGPathElement>(null)
  const nodesRef = useRef<SVGGElement>(null)
  const lastHitR = useRef(28)

  // --- camera side effects: edge weight, hit radius ------------------------
  const onTransform = useCallback((t: ZoomTransform) => {
    const sw = EDGE_WIDTH / Math.sqrt(t.k)
    edgesRef.current?.setAttribute('stroke-width', String(sw))
    hiEdgeRef.current?.setAttribute('stroke-width', String(sw * 2.2))
    // Hit targets track ~32 CSS px regardless of zoom; the CSS var restyles
    // all 253 circles, so only rewrite on meaningful k changes.
    const hitR = 16 / t.k
    if (Math.abs(hitR - lastHitR.current) / lastHitR.current > 0.2) {
      nodesRef.current?.style.setProperty('--hit-r', `${hitR}px`)
      lastHitR.current = hitR
    }
  }, [])

  const tier = useCamera(svgRef, cameraRef, world, onTransform)

  // --- Neighborhood Glow, applied imperatively (refs + adjacency) ----------
  // Glow has one owner: an open card beats hover, always.
  const [, navigate] = useLocation()
  const [onCard, cardParams] = useRoute('/pattern/:id')
  const selected = onCard ? parsePatternId(cardParams.id ?? '') : null
  const selectedRef = useRef<PatternId | null>(selected)
  selectedRef.current = selected

  const nodeEls = useRef<Map<number, Element>>(new Map())
  const litEls = useRef<Element[]>([])
  const hoverTimer = useRef<number | undefined>(undefined)
  const pendingId = useRef<PatternId | null>(null)

  useEffect(() => {
    const els = new Map<number, Element>()
    nodesRef.current
      ?.querySelectorAll('[data-id]')
      .forEach((el) => els.set(Number((el as SVGGElement).dataset['id']), el))
    nodeEls.current = els
  }, [])

  const applyGlow = useCallback((id: PatternId | null) => {
    for (const el of litEls.current) el.classList.remove('lit')
    litEls.current = []
    const svg = svgRef.current
    const hi = hiEdgeRef.current
    if (!svg || !hi) return
    if (id === null) {
      svg.classList.remove('glowing')
      hi.removeAttribute('d')
      return
    }
    const { ids, edgePath } = highlightFor(id)
    svg.classList.add('glowing')
    hi.setAttribute('d', edgePath)
    for (const i of ids) {
      const el = nodeEls.current.get(i)
      if (el) {
        el.classList.add('lit')
        litEls.current.push(el)
      }
    }
  }, [])

  // The open card's thread stays lit; navigation cancels any pending hover.
  useEffect(() => {
    window.clearTimeout(hoverTimer.current)
    pendingId.current = null
    applyGlow(selected)
  }, [selected, applyGlow])

  // One pending ~50ms timer: cleared on every new hover, on pointerleave of
  // the SVG, and on navigation. While a card is open it owns the glow and
  // hover does not compete.
  const scheduleGlow = useCallback(
    (id: PatternId | null) => {
      if (selectedRef.current !== null) return
      if (id === pendingId.current) return
      pendingId.current = id
      window.clearTimeout(hoverTimer.current)
      hoverTimer.current = window.setTimeout(() => applyGlow(id), 50)
    },
    [applyGlow],
  )

  useEffect(() => () => window.clearTimeout(hoverTimer.current), [])

  const onPointerOver = useCallback(
    (e: React.PointerEvent<SVGSVGElement>) => {
      const hit = (e.target as Element).closest('[data-id]')
      const raw = hit ? Number((hit as SVGGElement).dataset['id']) : null
      scheduleGlow(raw as PatternId | null)
    },
    [scheduleGlow],
  )

  const onPointerLeave = useCallback(() => {
    if (selectedRef.current !== null) return
    window.clearTimeout(hoverTimer.current)
    pendingId.current = null
    applyGlow(null)
  }, [applyGlow])

  // Click opens the pattern's card. d3-zoom's clickDistance is the sole
  // click-vs-drag referee: it suppresses the click after a real pan.
  const onClick = useCallback(
    (e: React.MouseEvent<SVGSVGElement>) => {
      const hit = (e.target as Element).closest('[data-id]')
      if (!hit) return
      navigate(`/pattern/${(hit as SVGGElement).dataset['id']}`)
    },
    [navigate],
  )

  return (
    <div className="atlas">
      <svg
        ref={svgRef}
        className="atlas-svg"
        role="img"
        aria-label="Town plan of the 253 patterns of A Pattern Language: districts for the towns patterns, buildings inside them, construction details on each building. The pattern index offers the same content as a readable list."
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
        onClick={onClick}
      >
        <GlyphDefs />
        <g ref={cameraRef} className={`scene tier-${tier}`}>
          <g className="sketches">
            <Sketches />
          </g>
          <g className="lanes">
            <Lanes />
          </g>
          <g className="quarters">
            <Quarters />
          </g>
          <g className="hedges">
            <DistrictHedges />
          </g>
          <g ref={edgesRef} className="edges">
            <Edges />
          </g>
          <path ref={hiEdgeRef} className="edge-hi" />
          <g ref={nodesRef} className="nodes">
            <Nodes />
          </g>
          <g className="quarter-labels">
            <QuarterLabels />
          </g>
        </g>
      </svg>
      <header className="atlas-header">
        <h1>Pattern Atlas</h1>
        <nav>
          <Link href="/patterns">pattern index</Link>
        </nav>
      </header>
      <span className="tier-note">{TIER_NOTE[tier]}</span>
      <Legend />
    </div>
  )
}
