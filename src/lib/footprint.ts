// Building footprints for the town plan: each buildings-scale pattern draws
// a small orthogonal plan outline under its glyph, like the figure-ground of
// a town map. Same grammar discipline as the glyphs — one edition, not 110
// doodles: every footprint is straight ink lines on an orthogonal grid; the
// seed chooses proportions and which of three canonical plans (rectangle,
// L-shape, courtyard notch), never what kinds of marks exist.
//
// Pure module (AD-6): no React, no app imports. World units, centered (0,0).

import { splitmix32 } from './prng'

export const FOOTPRINT_SEED = 0xf007
export const PLANS = ['rect', 'ell', 'notch'] as const
export type Plan = (typeof PLANS)[number]

export interface Footprint {
  plan: Plan
  /** Outline as SVG path data (closed). */
  outline: string
  /** One interior wall line, for plan texture. */
  wall: string
  /** Half-extents of the bounding box, for containment tests. */
  hw: number
  hh: number
}

const round = (n: number) => Math.round(n * 10) / 10

function ringPath(points: readonly (readonly [number, number])[]): string {
  return (
    points
      .map(([x, y], i) => `${i === 0 ? 'M' : 'L'}${round(x)} ${round(y)}`)
      .join('') + 'Z'
  )
}

/** Deterministic footprint for a buildings-scale pattern. */
export function footprintFor(id: number): Footprint {
  const rand = splitmix32(FOOTPRINT_SEED ^ id)
  const hw = round(13 + rand() * 6) // half-width 13..19
  const hh = round(10 + rand() * 5) // half-height 10..15
  const plan = PLANS[Math.floor(rand() * PLANS.length)]!
  // Which corner (or side) the cut lands on.
  const sx = rand() < 0.5 ? 1 : -1
  const sy = rand() < 0.5 ? 1 : -1
  const cw = round(hw * (0.7 + rand() * 0.5)) // cut width
  const ch = round(hh * (0.5 + rand() * 0.4)) // cut depth

  let outline: string
  if (plan === 'rect') {
    outline = ringPath([
      [-hw, -hh],
      [hw, -hh],
      [hw, hh],
      [-hw, hh],
    ])
  } else if (plan === 'ell') {
    // Rectangle with the (sx, sy) corner removed: a six-vertex walk.
    outline = ringPath([
      [-sx * hw, -sy * hh],
      [sx * hw, -sy * hh],
      [sx * hw, sy * (hh - ch)],
      [sx * (hw - cw), sy * (hh - ch)],
      [sx * (hw - cw), sy * hh],
      [-sx * hw, sy * hh],
    ])
  } else {
    // Courtyard notch biting into the middle of the ±y side.
    const nw = round(Math.min(cw * 0.5, hw * 0.6))
    const edge = sy * hh
    const inner = round(sy * (hh - ch * 0.8))
    outline =
      ringPath([
        [-hw, -hh],
        [hw, -hh],
        [hw, hh],
        [-hw, hh],
      ]) + `M${-nw} ${round(edge)}V${inner}H${nw}V${round(edge)}`
  }

  // Interior wall: one straight partition, offset from center.
  const wx = round((rand() - 0.5) * hw)
  const wall = `M${wx} ${-hh}V${hh}`

  return { plan, outline, wall, hw, hh }
}
