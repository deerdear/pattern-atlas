// Color safety validator (design language: "validated by script, not by
// eye"). Checks the paper-light palette for WCAG contrast and for red-vs-
// ochre separation under protanopia and deuteranopia (Viénot 1999
// simulation). Phase 2 acceptance runs this; tests/colors.test.ts wires it
// into the suite.
//
// Run: npm run check:colors

import { color } from '../src/theme/tokens.ts'

type RGB = [number, number, number]

export function hexToRgb(hex: string): RGB {
  const m = /^#([0-9a-f]{6})$/i.exec(hex)
  if (!m) throw new Error(`bad hex color: ${hex}`)
  const n = parseInt(m[1]!, 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

const srgbToLinear = (c: number) => {
  const s = c / 255
  return s <= 0.04045 ? s / 12.92 : ((s + 0.055) / 1.055) ** 2.4
}
const linearToSrgb = (v: number) => {
  const c = v <= 0.0031308 ? v * 12.92 : 1.055 * v ** (1 / 2.4) - 0.055
  return Math.min(255, Math.max(0, Math.round(c * 255)))
}

export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex)
  return (
    0.2126 * srgbToLinear(r) + 0.7152 * srgbToLinear(g) + 0.0722 * srgbToLinear(b)
  )
}

/** WCAG 2.x contrast ratio between two colors. */
export function contrast(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

// --- Dichromacy simulation (Viénot, Brettel & Mollon 1999) ---------------
// linear RGB -> LMS, project onto the dichromat's confusion surface, back.

const RGB_TO_LMS = [
  [17.8824, 43.5161, 4.11935],
  [3.45565, 27.1554, 3.86714],
  [0.0299566, 0.184309, 1.46709],
]
const LMS_TO_RGB = [
  [0.0809444479, -0.130504409, 0.116721066],
  [-0.0102485335, 0.0540193266, -0.113614708],
  [-0.000365296938, -0.00412161469, 0.693511405],
]
const SIM: Record<'protanopia' | 'deuteranopia', number[][]> = {
  protanopia: [
    [0, 2.02344, -2.52581],
    [0, 1, 0],
    [0, 0, 1],
  ],
  deuteranopia: [
    [1, 0, 0],
    [0.494207, 0, 1.24827],
    [0, 0, 1],
  ],
}

const mul = (m: number[][], v: number[]): number[] =>
  m.map((row) => row.reduce((s, c, i) => s + c * v[i]!, 0))

export function simulate(hex: string, kind: keyof typeof SIM): RGB {
  const lin = hexToRgb(hex).map(srgbToLinear)
  const lms = mul(RGB_TO_LMS, lin)
  const sim = mul(SIM[kind], lms)
  const rgb = mul(LMS_TO_RGB, sim)
  return rgb.map(linearToSrgb) as RGB
}

// --- CIE Lab ΔE76 as the separation metric -------------------------------

function rgbToLab([r, g, b]: RGB): [number, number, number] {
  const [lr, lg, lb] = [r, g, b].map(srgbToLinear) as RGB
  // sRGB D65 -> XYZ
  let x = (0.4124 * lr + 0.3576 * lg + 0.1805 * lb) / 0.95047
  let y = 0.2126 * lr + 0.7152 * lg + 0.0722 * lb
  let z = (0.0193 * lr + 0.1192 * lg + 0.9505 * lb) / 1.08883
  const f = (t: number) => (t > 0.008856 ? Math.cbrt(t) : 7.787 * t + 16 / 116)
  ;[x, y, z] = [f(x), f(y), f(z)]
  return [116 * y - 16, 500 * (x - y), 200 * (y - z)]
}

export function deltaE(a: RGB, b: RGB): number {
  const la = rgbToLab(a)
  const lb = rgbToLab(b)
  return Math.hypot(la[0] - lb[0], la[1] - lb[1], la[2] - lb[2])
}

// --- The checks -----------------------------------------------------------

export interface Check {
  name: string
  value: number
  min: number
}

export function runChecks(): Check[] {
  const checks: Check[] = [
    // Text and graphics on paper.
    { name: 'ink on page (body text ≥ 7)', value: contrast(color.ink, color.page), min: 7 },
    { name: 'dim token on page (≥ 3, design-language hard rule)', value: contrast(color.nodeDim, color.page), min: 3 },
    { name: 'trail red on page (graphic ≥ 3)', value: contrast(color.red, color.page), min: 3 },
    { name: 'deep ochre on page (graphic ≥ 3)', value: contrast(color.ochreDeep, color.page), min: 3 },
    { name: 'fade on page (secondary text ≥ 4.5)', value: contrast(color.fade, color.page), min: 4.5 },
  ]
  // Red vs ochre must stay distinct for protanopes and deuteranopes.
  for (const kind of ['protanopia', 'deuteranopia'] as const) {
    checks.push({
      name: `red vs deep ochre ΔE under ${kind} (≥ 12)`,
      value: deltaE(simulate(color.red, kind), simulate(color.ochreDeep, kind)),
      min: 12,
    })
    checks.push({
      name: `red vs dim token ΔE under ${kind} (≥ 12)`,
      value: deltaE(simulate(color.red, kind), simulate(color.nodeDim, kind)),
      min: 12,
    })
  }
  return checks
}

export function failures(checks: Check[]): Check[] {
  return checks.filter((c) => c.value < c.min)
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split('/').pop()!)) {
  const checks = runChecks()
  for (const c of checks) {
    const ok = c.value >= c.min
    console.log(`${ok ? 'ok  ' : 'FAIL'} ${c.name}: ${c.value.toFixed(2)}`)
  }
  if (failures(checks).length > 0) process.exit(1)
}
