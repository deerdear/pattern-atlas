// The map (Phase 2). Rendering contract (AD-3): React renders the static
// scene once — batched edges, symbol/use glyphs, band rules — and everything
// interactive happens imperatively: d3-zoom writes the camera transform,
// hover glow marks O(degree) elements, band labels ride the transform.
// The only React state is the discrete LOD tier.

import { memo, useCallback, useEffect, useRef } from 'react'
import { Link } from 'wouter'
import type { ZoomTransform } from 'd3-zoom'
import { patterns } from '../data/patterns'
import { positionFor } from '../data/position'
import type { PatternId } from '../data/schema'
import { DOT_RADIUS, NODE_RADIUS } from '../lib/glyph'
import { Edges } from './Edges'
import { NodeGlyph, glyphId } from './NodeGlyph'
import { highlightFor } from './glow'
import { useCamera, type World } from './useCamera'
import './atlas.css'

const world: World = (() => {
  let x0 = Infinity
  let y0 = Infinity
  let x1 = -Infinity
  let y1 = -Infinity
  for (const p of patterns) {
    const { x, y } = positionFor(p.id)
    x0 = Math.min(x0, x)
    y0 = Math.min(y0, y)
    x1 = Math.max(x1, x)
    y1 = Math.max(y1, y)
  }
  return { x0: x0 - 50, y0: y0 - 60, x1: x1 + 50, y1: y1 + 60 }
})()

const BANDS = [
  { label: 'towns · 1–94', center: 250 },
  { label: 'buildings · 95–204', center: 750 },
  { label: 'construction · 205–253', center: 1250 },
] as const
const BAND_HALF = 280 // label clamp range around each band's stratum
const BAND_RULES = [500, 1000] // hairlines between the strata

const EDGE_WIDTH = 0.65 // at k = 1; scales as width/√k so zoom yields air

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

/** The 253 node groups: glyph <use>, LOD dot, generous invisible hit circle. */
const Nodes = memo(function Nodes() {
  return (
    <>
      {patterns.map((p) => {
        const { x, y } = positionFor(p.id)
        const r = NODE_RADIUS[p.confidence]
        return (
          <g
            key={p.id}
            className="node"
            data-id={p.id}
            transform={`translate(${x} ${y})`}
          >
            <use href={`#${glyphId(p.id)}`} x={-r} y={-r} width={2 * r} height={2 * r} />
            <circle className="lod-dot" r={DOT_RADIUS[p.confidence]} />
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
          <line x1="6" y1="4" x2="40" y2="4" stroke="var(--color-rule)" />
          <line x1="6" y1="14" x2="40" y2="14" stroke="var(--color-rule)" />
        </svg>
        <span>higher = larger scale</span>
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
  const labelRefs = useRef<(HTMLSpanElement | null)[]>([])
  const lastHitR = useRef(28)

  // --- camera side effects: edge weight, hit radius, running-head labels ---
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
    const viewportH = svgRef.current?.clientHeight || 720
    BANDS.forEach((band, i) => {
      const el = labelRefs.current[i]
      if (!el) return
      const top = t.applyY(band.center - BAND_HALF)
      const bottom = t.applyY(band.center + BAND_HALF)
      const y = Math.min(Math.max(top + 8, 56), bottom - 28)
      el.style.transform = `translateY(${y}px)`
      el.style.visibility = bottom < 56 || top > viewportH ? 'hidden' : 'visible'
    })
  }, [])

  const tier = useCamera(svgRef, cameraRef, world, onTransform)

  // --- Neighborhood Glow, applied imperatively (refs + adjacency) ----------
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

  // One pending ~50ms timer: cleared on every new hover, on pointerleave of
  // the SVG, and (Phase 3) on navigation.
  const scheduleGlow = useCallback(
    (id: PatternId | null) => {
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
    window.clearTimeout(hoverTimer.current)
    pendingId.current = null
    applyGlow(null)
  }, [applyGlow])

  return (
    <div className="atlas">
      <svg
        ref={svgRef}
        className="atlas-svg"
        role="img"
        aria-label="Map of the 253 patterns of A Pattern Language, linked by their threads. The pattern index offers the same content as a readable list."
        onPointerOver={onPointerOver}
        onPointerLeave={onPointerLeave}
      >
        <GlyphDefs />
        <g ref={cameraRef} className={tier === 'dot' ? 'scene lod-dots' : 'scene'}>
          <g className="band-rules">
            {BAND_RULES.map((y) => (
              <line
                key={y}
                x1={world.x0}
                y1={y}
                x2={world.x1}
                y2={y}
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </g>
          <g ref={edgesRef} className="edges">
            <Edges />
          </g>
          <path ref={hiEdgeRef} className="edge-hi" />
          <g ref={nodesRef} className="nodes">
            <Nodes />
          </g>
        </g>
      </svg>
      <header className="atlas-header">
        <h1>Pattern Atlas</h1>
        <nav>
          <Link href="/patterns">pattern index</Link>
        </nav>
      </header>
      {BANDS.map((band, i) => (
        <span
          key={band.label}
          className="band-label"
          ref={(el) => {
            labelRefs.current[i] = el
          }}
        >
          {band.label}
        </span>
      ))}
      <Legend />
    </div>
  )
}
