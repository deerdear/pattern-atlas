// The five introduction cards shown on first visit: where the language
// comes from, how it works, how the map draws it, why this atlas exists
// (EDIT CARD 4 — that one is yours), and how to wander. All prose here is
// original (AD-5): the book's own text never enters the repo.
//
// Shows once (localStorage), reopenable via the small "about" link.

import { useEffect, useState, type ReactNode } from 'react'
import './intro.css'

const SEEN_KEY = 'atlas-intro-seen'

const CARDS: { title: string; body: ReactNode }[] = [
  {
    title: 'a pattern language',
    body: (
      <>
        <p>
          In 1977, the architect Christopher Alexander and his colleagues at
          Berkeley published <em>A Pattern Language</em> — a catalogue of 253
          recurring problems in the built world, each paired with a way of
          resolving it. The patterns run from the size of whole regions down
          to the trim on a doorway.
        </p>
        <p>
          Alexander&rsquo;s claim was radical: towns and buildings feel alive
          when they grow from these patterns, and dead when they are imposed
          without them.
        </p>
      </>
    ),
  },
  {
    title: 'a language, not a list',
    body: (
      <>
        <p>
          The patterns are not a checklist. Each one is completed by smaller
          patterns below it and gives meaning to larger ones above — the way
          a market square needs both a town around it and benches within it.
          Reading the book is walking this web of threads.
        </p>
        <p>
          Alexander starred the patterns he trusted: two asterisks for those
          he thought close to invariant, one for good bets, none for open
          hypotheses. The atlas draws confident patterns larger and more
          complete.
        </p>
      </>
    ),
  },
  {
    title: 'a ladder of scales',
    body: (
      <>
        <p>
          The language descends three scales: <strong>towns</strong> (1–94),
          <strong> buildings</strong> (95–204), and{' '}
          <strong>construction</strong> (205–253). This map draws them as a
          village — quarters of related town patterns, buildings settled in
          the districts they serve, construction details gathered against
          their buildings.
        </p>
        <p>Zooming in is descending the ladder.</p>
      </>
    ),
  },
  {
    // EDIT ME: this card is the author's own motivation. Replace the
    // placeholder paragraphs with your reasons for building the atlas.
    title: 'why this atlas',
    body: (
      <>
        <p className="intro-placeholder">
          [Your motivation goes here — why you wanted to build this. A few
          sentences: what the book means to you, what you hoped a map of it
          would make visible that the bound sequence of pages cannot.]
        </p>
        <p className="intro-placeholder">
          [Optionally a second paragraph: who you hope wanders here, and
          what they might take away.]
        </p>
      </>
    ),
  },
  {
    title: 'how to wander',
    body: (
      <>
        <p>
          Wander before you search. Zoom to move between the town, its
          buildings, and their construction. Click any mark to open its
          pattern and follow the threads up and down the ladder, card to
          card. The rail on the left lights a whole scale at once; hovering
          lights a pattern&rsquo;s immediate neighborhood.
        </p>
        <p>
          The names, numbers, stars, and threads are the book&rsquo;s
          structure; every sentence of prose here is original. The book
          itself is worth owning.
        </p>
      </>
    ),
  },
]

export default function Intro() {
  const [open, setOpen] = useState<boolean>(() => {
    try {
      return !localStorage.getItem(SEEN_KEY)
    } catch {
      return true
    }
  })
  const [index, setIndex] = useState(0)

  const close = () => {
    setOpen(false)
    try {
      localStorage.setItem(SEEN_KEY, '1')
    } catch {
      /* private mode: shows again next visit */
    }
  }

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') close()
      if (e.key === 'ArrowRight') setIndex((i) => Math.min(i + 1, CARDS.length - 1))
      if (e.key === 'ArrowLeft') setIndex((i) => Math.max(i - 1, 0))
      e.stopPropagation()
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open])

  if (!open) {
    return (
      <button
        type="button"
        className="intro-reopen"
        onClick={() => {
          setIndex(0)
          setOpen(true)
        }}
      >
        about
      </button>
    )
  }

  const card = CARDS[index]!
  const last = index === CARDS.length - 1
  return (
    <div className="intro-scrim" role="dialog" aria-modal="true" aria-label="About the Pattern Atlas">
      <article className="intro-card">
        <p className="intro-count">{`${index + 1} · ${CARDS.length}`}</p>
        <h1 className="intro-title">{card.title}</h1>
        {card.body}
        <footer className="intro-footer">
          <button type="button" onClick={() => setIndex(index - 1)} disabled={index === 0}>
            back
          </button>
          <div className="intro-dots" aria-hidden="true">
            {CARDS.map((c, j) => (
              <span key={c.title} className={j === index ? 'on' : undefined} />
            ))}
          </div>
          {last ? (
            <button type="button" className="intro-begin" onClick={close}>
              begin
            </button>
          ) : (
            <button type="button" onClick={() => setIndex(index + 1)}>
              next
            </button>
          )}
        </footer>
        <button type="button" className="intro-skip" onClick={close}>
          skip
        </button>
      </article>
    </div>
  )
}
