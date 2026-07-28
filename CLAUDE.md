# Pattern Atlas

Explorable graph of the 253 patterns from A Pattern Language. Read
`plans/feat-pattern-atlas-explorable-graph.md` before starting any phase;
work one phase per session and stop at boundaries. Check history.md first.

## Commands

- `npm run dev` / `build` / `test` / `lint`
- `npm run data:convert` — regenerate src/data/patterns.ts from the graphml

## Conventions

- TypeScript strict + noUncheckedIndexedAccess; no UI framework; styles from
  `src/theme/tokens.ts` / `base.css`. Paper-light only, no dark mode.
- URL is the state for the card (`/pattern/:id`) — but not for the camera
  (d3-zoom owns it) or the trail (`trailStore` owns it).
- `PatternId` is branded; `parsePatternId()` is the only producer from user
  input. Scale is derived via `scaleForId`, never stored.
- Resolve ambiguous UI decisions against the seven patterns and the design
  language section in the plan.

## Hard rules

- Never include text from the book anywhere in the repo. Names, numbers,
  asterisks, and link structure only. All prose is original.
- `src/data/patterns.ts` is generated — never edit by hand. Data fixes go in
  the corrections layer of `scripts/convert-graphml.ts` (precondition-keyed)
  and are logged in `data-notes/validation.md`.
- Gist prose lives in `data-notes/gists.json` (hand-owned); only reviewed
  gists reach the generated output. Scripts must never overwrite a reviewed
  gist.
- Pinned aggregates (1,686 edges, bands 94/110/49, hash of the vendored
  graphml) change only deliberately, in the same commit as the data change.
