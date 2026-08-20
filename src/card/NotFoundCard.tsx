// A not-found card at the bad URL itself — no silent redirect (spec:
// error URLs render in place, owned by parsePatternId's verdict).

import { Link } from 'wouter'
import './card.css'

export default function NotFoundCard({ raw }: { raw: string }) {
  return (
    <article className="card" aria-label="No such pattern">
      <Link href="/" className="card-close" aria-label="Close card">
        ×
      </Link>
      <p className="card-number">?</p>
      <h1 className="card-name">No pattern here</h1>
      <p className="card-gist">
        &ldquo;{raw}&rdquo; is not one of the 253 patterns. The language runs
        from 1 to 253.
      </p>
      <hr className="card-rule" />
      <p className="card-empty">
        <Link href="/">Back to the village</Link> ·{' '}
        <Link href="/patterns">the full index</Link>
      </p>
    </article>
  )
}
