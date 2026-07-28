// Dev-only route (/dev/glyphs): all 253 glyphs in a grid for family-
// cohesion review. Outliers are fixed by adjusting the grammar in
// src/lib/glyph.ts — never by special-casing individual glyphs.

import { patterns } from '../data/patterns'
import { GLYPH_BOX, glyphFor } from '../lib/glyph'

const CELL = 56

export default function GlyphGrid() {
  const half = GLYPH_BOX / 2
  return (
    <main style={{ padding: '2rem 1rem', maxWidth: '64rem', margin: '0 auto' }}>
      <h1 style={{ fontWeight: 'normal' }}>Glyph grid (dev)</h1>
      <p style={{ color: 'var(--color-fade)' }}>
        One edition, not 253 doodles. Fix cohesion problems in the grammar.
      </p>
      <div
        style={{
          display: 'grid',
          gridTemplateColumns: `repeat(auto-fill, ${CELL + 16}px)`,
          gap: '0.5rem',
        }}
      >
        {patterns.map((p) => {
          const g = glyphFor(p.id, p.confidence)
          return (
            <figure key={p.id} style={{ margin: 0, textAlign: 'center' }}>
              <svg
                width={CELL}
                height={CELL}
                viewBox={`${-half} ${-half} ${GLYPH_BOX} ${GLYPH_BOX}`}
                style={{ color: 'var(--color-ink)' }}
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
              </svg>
              <figcaption
                style={{ fontSize: '0.75rem', color: 'var(--color-fade)' }}
              >
                {p.id} · {'**'.slice(0, p.confidence) || '·'}
              </figcaption>
            </figure>
          )
        })}
      </div>
    </main>
  )
}
