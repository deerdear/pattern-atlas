// Glyph grammar (design language): every glyph is built from the same three
// primitives — circle arc, straight tick, filled dot — in a 16px design box.
// The seed (splitmix32 of the pattern id) chooses ARRANGEMENT only: arc
// rotation snapped to 30°, one of four canonical compositions, tick count
// 2–4, dot placement. It never chooses what kinds of marks exist.
//
// Confidence reads as size (primary channel — survives the dot collapse),
// stroke weight, and arc completeness: 2★ closed circle, 1★ ~270° arc,
// 0 an arc under 180° — hypotheses drawn as literally incomplete figures.
//
// Pure module (AD-6): no React, no app imports. Cohesion problems are fixed
// here, in the grammar — never on individual glyphs.

import { splitmix32 } from './prng'
import type { Confidence } from '../data/schema'

/** Side of the square design box; geometry is centered on (0, 0). */
export const GLYPH_BOX = 16

const ARC_R = 5

/** Arc sweep in degrees — completeness is the confidence channel. */
export const ARC_SWEEP: Record<Confidence, number> = { 0: 150, 1: 270, 2: 360 }

/** Stroke weight in design-box units — the redundant second channel. */
export const STROKE_WIDTH: Record<Confidence, number> = { 0: 1, 1: 1.3, 2: 1.7 }

/**
 * Placed glyph radius in map units — the PRIMARY confidence channel: three
 * discrete size steps. A <use> of a glyph spans 2× this.
 */
export const NODE_RADIUS: Record<Confidence, number> = { 0: 7, 1: 9, 2: 11 }

/** Radius of the collapsed dot at the far LOD tier, in map units. */
export const DOT_RADIUS: Record<Confidence, number> = { 0: 6, 1: 7.5, 2: 9 }

export const COMPOSITIONS = ['rays', 'baseline', 'chord', 'axis'] as const
export type Composition = (typeof COMPOSITIONS)[number]

export interface GlyphGeometry {
  /** Arc-gap direction, snapped to 30° increments. */
  rotationDeg: number
  composition: Composition
  strokeWidth: number
  /** The arc (a closed circle at 2★), as SVG path data. */
  arcPath: string
  /** All 2–4 ticks concatenated into one path. */
  tickPath: string
  /** The single filled dot. */
  dot: { cx: number; cy: number; r: number }
}

const round = (n: number) => Math.round(n * 100) / 100

function pt(angleDeg: number, r: number): { x: number; y: number } {
  const a = (angleDeg * Math.PI) / 180
  return { x: round(r * Math.cos(a)), y: round(r * Math.sin(a)) }
}

function arcPath(gapCenterDeg: number, sweep: number): string {
  if (sweep >= 360) {
    // Full circle as two semicircular arcs (a single arc of 360° collapses).
    return `M ${-ARC_R} 0 A ${ARC_R} ${ARC_R} 0 1 1 ${ARC_R} 0 A ${ARC_R} ${ARC_R} 0 1 1 ${-ARC_R} 0`
  }
  const start = gapCenterDeg + (360 - sweep) / 2
  const a0 = pt(start, ARC_R)
  const a1 = pt(start + sweep, ARC_R)
  const large = sweep > 180 ? 1 : 0
  return `M ${a0.x} ${a0.y} A ${ARC_R} ${ARC_R} 0 ${large} 1 ${a1.x} ${a1.y}`
}

function tick(x1: number, y1: number, x2: number, y2: number): string {
  return `M ${round(x1)} ${round(y1)} L ${round(x2)} ${round(y2)}`
}

function ticksFor(
  composition: Composition,
  rotationDeg: number,
  count: number,
  sweep: number,
): string {
  const parts: string[] = []
  const arcStart = rotationDeg + (360 - sweep) / 2
  switch (composition) {
    case 'rays': {
      // Short radial ticks off the arc itself, spread along its sweep.
      for (let i = 0; i < count; i++) {
        const a = arcStart + (sweep * (i + 0.5)) / count
        const inner = pt(a, ARC_R + 0.8)
        const outer = pt(a, ARC_R + 2.6)
        parts.push(tick(inner.x, inner.y, outer.x, outer.y))
      }
      break
    }
    case 'baseline': {
      // Parallel ticks stacked across the gap direction, just outside the arc.
      const c = pt(rotationDeg, ARC_R + 1.2)
      const along = pt(rotationDeg + 90, 1)
      const out = pt(rotationDeg, 1)
      for (let i = 0; i < count; i++) {
        const o = (i - (count - 1) / 2) * 1.8
        const cx = c.x + along.x * o
        const cy = c.y + along.y * o
        parts.push(
          tick(cx - out.x * 1.2, cy - out.y * 1.2, cx + out.x * 1.2, cy + out.y * 1.2),
        )
      }
      break
    }
    case 'chord': {
      // Parallel chords crossing the figure, aligned with the gap direction.
      const dir = pt(rotationDeg, 1)
      const perp = pt(rotationDeg + 90, 1)
      for (let i = 0; i < count; i++) {
        const o = (i - (count - 1) / 2) * 2.2
        const cx = perp.x * o
        const cy = perp.y * o
        parts.push(
          tick(cx - dir.x * 1.7, cy - dir.y * 1.7, cx + dir.x * 1.7, cy + dir.y * 1.7),
        )
      }
      break
    }
    case 'axis': {
      // Ruler marks along the gap-direction diameter.
      const dir = pt(rotationDeg, 1)
      const perp = pt(rotationDeg + 90, 1)
      for (let i = 0; i < count; i++) {
        const t = count === 1 ? 0 : -3 + (6 * i) / (count - 1)
        const cx = dir.x * t
        const cy = dir.y * t
        parts.push(
          tick(cx - perp.x * 1.2, cy - perp.y * 1.2, cx + perp.x * 1.2, cy + perp.y * 1.2),
        )
      }
      break
    }
  }
  return parts.join(' ')
}

/** Deterministic glyph geometry for a pattern. Same inputs, same figure. */
export function glyphFor(id: number, confidence: Confidence): GlyphGeometry {
  const rand = splitmix32(id)
  const rotationDeg = 30 * Math.floor(rand() * 12)
  const composition = COMPOSITIONS[Math.floor(rand() * COMPOSITIONS.length)]!
  const tickCount = 2 + Math.floor(rand() * 3)
  const sweep = ARC_SWEEP[confidence]

  // Dot placement: center, on the arc, or drifting into the gap.
  const place = Math.floor(rand() * 3)
  const dotJitter = pt(rand() * 360, 0.6)
  let dot: { cx: number; cy: number; r: number }
  if (place === 0) {
    dot = { cx: dotJitter.x, cy: dotJitter.y, r: 1.1 }
  } else if (place === 1) {
    const onArc = pt(rotationDeg + 180, ARC_R)
    dot = { cx: onArc.x, cy: onArc.y, r: 1.1 }
  } else {
    const inGap = pt(rotationDeg, ARC_R * 0.55)
    dot = { cx: round(inGap.x + dotJitter.x), cy: round(inGap.y + dotJitter.y), r: 1.1 }
  }

  return {
    rotationDeg,
    composition,
    strokeWidth: STROKE_WIDTH[confidence],
    arcPath: arcPath(rotationDeg, sweep),
    tickPath: ticksFor(composition, rotationDeg, tickCount, sweep),
    dot,
  }
}
