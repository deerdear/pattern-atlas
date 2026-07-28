// The <symbol> definition for one pattern's glyph (AD-3): geometry renders
// once into <defs> and is placed with <use>. State (dim, LOD) rides
// inherited properties — currentColor crosses the use-shadow boundary,
// per-element attributes do not.

import { memo } from 'react'
import { GLYPH_BOX, glyphFor } from '../lib/glyph'
import type { Confidence } from '../data/schema'

export const glyphId = (id: number) => `glyph-${id}`

export const NodeGlyph = memo(function NodeGlyph({
  id,
  confidence,
}: {
  id: number
  confidence: Confidence
}) {
  const g = glyphFor(id, confidence)
  const half = GLYPH_BOX / 2
  return (
    <symbol
      id={glyphId(id)}
      viewBox={`${-half} ${-half} ${GLYPH_BOX} ${GLYPH_BOX}`}
    >
      <path
        d={g.arcPath}
        fill="none"
        stroke="currentColor"
        strokeWidth={g.strokeWidth}
        strokeLinecap="round"
      />
      <path
        d={g.tickPath}
        fill="none"
        stroke="currentColor"
        strokeWidth={g.strokeWidth * 0.85}
        strokeLinecap="round"
      />
      <circle cx={g.dot.cx} cy={g.dot.cy} r={g.dot.r} fill="currentColor" />
    </symbol>
  )
})
