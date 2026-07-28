import { describe, expect, it } from 'vitest'
import { contrast, failures, runChecks, simulate } from '../scripts/validate-colors'
import { color } from '../src/theme/tokens'

describe('color safety (design language: validated by script, not by eye)', () => {
  it('passes every contrast and CVD check', () => {
    const failed = failures(runChecks())
    expect(
      failed.map((c) => `${c.name}: ${c.value.toFixed(2)} < ${c.min}`),
    ).toEqual([])
  })

  it('simulates dichromacy into valid sRGB', () => {
    for (const kind of ['protanopia', 'deuteranopia'] as const) {
      for (const c of simulate(color.red, kind)) {
        expect(c).toBeGreaterThanOrEqual(0)
        expect(c).toBeLessThanOrEqual(255)
      }
    }
  })

  it('documents why cover ochre is not a graphics color', () => {
    expect(contrast(color.cover, color.page)).toBeLessThan(3)
    expect(contrast(color.ochreDeep, color.page)).toBeGreaterThanOrEqual(3)
  })
})
