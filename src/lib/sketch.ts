// Marginalia for the village map: small architectural vignettes — house
// elevations, a floor plan, a church tower, a distant hamlet — drawn in the
// same hairline ink as everything else, like the sketches in the margin of
// an old survey sheet. Same grammar discipline as the glyphs: straight
// lines and circle arcs only; the seed chooses proportions and counts,
// never what kinds of marks exist. All linework is original.
//
// Pure module (AD-6): no React, no app imports. World units; each vignette
// draws with its baseline at y = 0, roughly centered on x = 0.

import { splitmix32 } from './prng'

export interface Vignette {
  /** All strokes concatenated into one path. */
  d: string
  /** Approximate half-width, for placement. */
  hw: number
  /** x shift that centers the drawing (some build rightwards from 0). */
  dx?: number
}

const r1 = (n: number) => Math.round(n * 10) / 10

function rect(x: number, y: number, w: number, h: number): string {
  return `M${r1(x)} ${r1(y)}h${r1(w)}v${r1(h)}h${r1(-w)}Z`
}

function line(x1: number, y1: number, x2: number, y2: number): string {
  return `M${r1(x1)} ${r1(y1)}L${r1(x2)} ${r1(y2)}`
}

/** One gabled facade with door/window marks; returns path + its width. */
function facade(x: number, rand: () => number, tall: boolean): { d: string; w: number } {
  const w = 34 + rand() * 16
  const h = (tall ? 30 : 24) + rand() * 8
  const peak = 12 + rand() * 8
  let d =
    rect(x, -h, w, h) +
    `M${r1(x)} ${r1(-h)}L${r1(x + w / 2)} ${r1(-h - peak)}L${r1(x + w)} ${r1(-h)}`
  // Door on the ground floor…
  const dw = 8 + rand() * 3
  const dx = x + 4 + rand() * (w - dw - 8)
  d += `M${r1(dx)} 0v${r1(-(12 + rand() * 3))}h${r1(dw)}v${r1(12 + rand() * 3)}`
  // …and one or two windows above.
  const wins = 1 + Math.floor(rand() * 2)
  for (let i = 0; i < wins; i++) {
    const wx = x + 5 + ((w - 14) * (i + 0.5)) / wins
    const wy = -h + 5 + rand() * 4
    d += rect(wx, wy, 7, 8) + line(wx + 3.5, wy, wx + 3.5, wy + 8)
  }
  // The odd chimney.
  if (rand() < 0.45) {
    const cx = x + w * (0.2 + rand() * 0.6)
    d += `M${r1(cx)} ${r1(-h - peak * 0.45)}v-8h5v8`
  }
  return { d, w }
}

/** A village street elevation: a few gabled house fronts shoulder to shoulder. */
export function houseRow(seed: number, houses = 4): Vignette {
  const rand = splitmix32(0x51e7 ^ seed)
  let d = ''
  let x = 0
  for (let i = 0; i < houses; i++) {
    const f = facade(x, rand, i % 2 === 1)
    d += f.d
    x += f.w
  }
  // Ground line running a little past both ends.
  d += line(-14, 0, x + 14, 0)
  return { d, hw: x / 2 + 14, dx: -x / 2 }
}

/** An architect's floor plan: rooms, wall gaps, two door-swing arcs. */
export function housePlan(seed: number): Vignette {
  const rand = splitmix32(0x91a ^ seed)
  const w = 130 + rand() * 30
  const h = 90 + rand() * 20
  const x0 = -w / 2
  const y0 = -h
  let d = rect(x0, y0, w, h)
  // One vertical and one horizontal partition, each with a doorway gap.
  const px = x0 + w * (0.35 + rand() * 0.3)
  const gap1 = y0 + h * (0.25 + rand() * 0.4)
  d += line(px, y0, px, gap1) + line(px, gap1 + 14, px, y0 + h)
  const py = y0 + h * (0.4 + rand() * 0.25)
  const gap2 = px + (x0 + w - px) * (0.3 + rand() * 0.3)
  d += line(px, py, gap2, py) + line(gap2 + 14, py, x0 + w, py)
  // Door swings: quarter arcs off the gaps.
  d += `M${r1(px)} ${r1(gap1)}A14 14 0 0 1 ${r1(px + 14)} ${r1(gap1 + 14)}`
  d += `M${r1(gap2)} ${r1(py)}A14 14 0 0 0 ${r1(gap2 + 14)} ${r1(py + 14)}`
  // Front door gap on the south wall with its swing.
  const fd = x0 + w * (0.15 + rand() * 0.2)
  d += `M${r1(fd)} ${r1(y0 + h)}A16 16 0 0 1 ${r1(fd + 16)} ${r1(y0 + h - 16)}`
  // Window ticks along the north wall.
  for (let i = 1; i <= 3; i++) {
    const wx = x0 + (w * i) / 4
    d += line(wx - 5, y0, wx + 5, y0)
    d += line(wx - 5, y0 + 2.5, wx + 5, y0 + 2.5)
  }
  return { d, hw: w / 2 }
}

/** A church tower and nave in elevation — every village has one. */
export function churchElevation(seed: number): Vignette {
  const rand = splitmix32(0xc4c ^ seed)
  const tw = 26 + rand() * 6 // tower
  const th = 62 + rand() * 16
  const nw = 76 + rand() * 18 // nave
  const nh = 30 + rand() * 6
  const x0 = -(tw + nw) / 2
  let d = rect(x0, -th, tw, th)
  d += `M${r1(x0)} ${r1(-th)}L${r1(x0 + tw / 2)} ${r1(-th - 22)}L${r1(x0 + tw)} ${r1(-th)}`
  d += rect(x0 + tw, -nh, nw, nh)
  d += `M${r1(x0 + tw)} ${r1(-nh)}L${r1(x0 + tw + nw / 2)} ${r1(-nh - 16)}L${r1(x0 + tw + nw)} ${r1(-nh)}`
  // Tall lancet strokes on the tower, small ones along the nave.
  d += line(x0 + tw / 2, -th + 8, x0 + tw / 2, -th + 20)
  for (let i = 1; i <= 3; i++) {
    const wx = x0 + tw + (nw * i) / 4
    d += line(wx, -nh + 8, wx, -nh + 18)
  }
  d += line(x0 - 12, 0, x0 + tw + nw + 12, 0)
  return { d, hw: (tw + nw) / 2 + 12 }
}

/** A hamlet on the horizon: tiny gables on a stepped ground line, hatched. */
export function hillHamlet(seed: number): Vignette {
  const rand = splitmix32(0x4a11 ^ seed)
  const n = 4 + Math.floor(rand() * 3)
  let d = ''
  let x = -n * 14
  for (let i = 0; i < n; i++) {
    const w = 16 + rand() * 8
    const h = 9 + rand() * 5
    const peak = 5 + rand() * 4
    d += rect(x, -h, w, h)
    d += `M${r1(x)} ${r1(-h)}L${r1(x + w / 2)} ${r1(-h - peak)}L${r1(x + w)} ${r1(-h)}`
    x += w + 4 + rand() * 8
  }
  const start = -n * 14 - 16
  const end = x + 16
  d += line(start, 0, end, 0)
  // Hatching under the ground line — the hillside.
  for (let i = 0; i < 9; i++) {
    const hx = start + 8 + ((end - start - 16) * i) / 9
    d += line(hx, 2, hx - 6, 7)
  }
  return { d, hw: (end - start) / 2, dx: -(start + end) / 2 }
}
