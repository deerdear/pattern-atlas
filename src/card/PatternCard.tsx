// One Pattern, One Page (contract pattern 3): number, name, asterisks,
// gist, and the thread up and down the ladder. Nothing else. A page, not a
// popover: paper surface, 1px ink border, square corners.

import { useEffect, useState } from 'react'
import { Link, useLocation } from 'wouter'
import { patterns } from '../data/patterns'
import { scaleForId, type PatternId } from '../data/schema'
import './card.css'

const byId = new Map(patterns.map((p) => [p.id, p]))

const ASTERISKS = ['', '*', '**'] as const
const CONFIDENCE_LINE = [
  'Alexander’s confidence: a hypothesis',
  'Alexander’s confidence: moderate',
  'Alexander’s confidence: high',
] as const

/**
 * Unreviewed draft gists are visible in dev builds only, marked as drafts;
 * production cards simply omit the line until prose is human-reviewed.
 */
function useDraftGist(id: PatternId, reviewed: string | undefined): string | null {
  const [draft, setDraft] = useState<string | null>(null)
  useEffect(() => {
    setDraft(null)
    if (!import.meta.env.DEV || reviewed) return
    let alive = true
    import('../../data-notes/gists.json').then((m) => {
      if (!alive) return
      const entry = (m.default as { id: number; gist: string }[]).find(
        (g) => g.id === id,
      )
      setDraft(entry?.gist ?? null)
    })
    return () => {
      alive = false
    }
  }, [id, reviewed])
  return draft
}

function Thread({
  eyebrow,
  ids,
  empty,
}: {
  eyebrow: string
  ids: readonly PatternId[]
  empty: string
}) {
  return (
    <section className="card-thread">
      <h2 className="card-eyebrow">{eyebrow}</h2>
      {ids.length === 0 ? (
        <p className="card-empty">{empty}</p>
      ) : (
        <ul>
          {ids.map((n) => (
            <li key={n}>
              <Link href={`/pattern/${n}`}>
                {n} · {byId.get(n)!.name}
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

export default function PatternCard({ id }: { id: PatternId }) {
  const p = byId.get(id)!
  const [, navigate] = useLocation()
  const draft = useDraftGist(id, p.gist)
  const gist = p.gist ?? draft

  useEffect(() => {
    document.title = `${p.id}. ${p.name} — Pattern Atlas`
    return () => {
      document.title = 'Pattern Atlas'
    }
  }, [p])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') navigate('/')
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [navigate])

  return (
    <article className="card" aria-label={`Pattern ${p.id}, ${p.name}`}>
      <Link href="/" className="card-close" aria-label="Close card">
        ×
      </Link>
      <p className="card-eyebrow">
        {scaleForId(id)} · {p.category.toLowerCase()}
      </p>
      <p className="card-number">{p.id}</p>
      <h1 className="card-name">
        {p.name}
        {p.confidence > 0 && (
          <span className="card-asterisks"> {ASTERISKS[p.confidence]}</span>
        )}
      </h1>
      <p className="card-confidence">{CONFIDENCE_LINE[p.confidence]}</p>
      {gist && (
        <p className={p.gist ? 'card-gist' : 'card-gist draft'}>{gist}</p>
      )}
      <hr className="card-rule" />
      <Thread
        eyebrow="serves the larger patterns"
        ids={p.broader}
        empty="the top of the ladder — nothing larger"
      />
      <Thread
        eyebrow="completed by the smaller patterns"
        ids={p.narrower}
        empty="ground level — nothing smaller"
      />
    </article>
  )
}
