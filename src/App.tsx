// Phase 0: minimal shell listing all 253 patterns from the converted
// dataset, grouped by scale band. The graph replaces this in Phase 2; the
// list survives as the /patterns accessibility surface.

import { patterns } from './data/patterns'
import { scaleForId, type Scale } from './data/schema'

const BAND_LABELS: Record<Scale, string> = {
  towns: 'Towns · 1–94',
  buildings: 'Buildings · 95–204',
  construction: 'Construction · 205–253',
}

const ASTERISKS = ['', ' *', ' **'] as const

export default function App() {
  const bands: Scale[] = ['towns', 'buildings', 'construction']
  return (
    <main style={{ maxWidth: '38rem', margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontWeight: 'normal' }}>Pattern Atlas</h1>
      <p style={{ color: 'var(--color-fade)' }}>
        The 253 patterns of <em>A Pattern Language</em> (1977), from region to
        ornament.
      </p>
      {bands.map((band) => (
        <section key={band}>
          <h2
            style={{
              fontVariant: 'small-caps',
              fontWeight: 'normal',
              borderBottom: '1px solid var(--color-rule)',
            }}
          >
            {BAND_LABELS[band]}
          </h2>
          <ol style={{ listStyle: 'none', padding: 0 }}>
            {patterns
              .filter((p) => scaleForId(p.id) === band)
              .map((p) => (
                <li key={p.id}>
                  <span
                    style={{
                      display: 'inline-block',
                      width: '2.5rem',
                      textAlign: 'right',
                      marginRight: '0.75rem',
                      color: 'var(--color-fade)',
                      fontVariantNumeric: 'oldstyle-nums',
                    }}
                  >
                    {p.id}
                  </span>
                  {p.name}
                  <span style={{ color: 'var(--color-red)' }}>
                    {ASTERISKS[p.confidence]}
                  </span>
                </li>
              ))}
          </ol>
        </section>
      ))}
    </main>
  )
}
