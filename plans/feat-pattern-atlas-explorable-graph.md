# feat: Pattern Atlas — explorable graph of A Pattern Language

An explorable map of the 253 patterns from Christopher Alexander's *A Pattern Language* (1977). One force-directed graph, banded by scale from regions down to ornament. You wander it by following threads, and your walk leaves a fading red trail.

---

## Enhancement summary

**Planned:** 2026-07-15 from a hand-written PLAN.md draft, grounded by four research agents (repo survey, dataset/copyright, framework docs, user-flow analysis).
**Deepened:** 2026-07-16 by eight more agents (frontend-design and dataviz skill passes; architecture, simplicity, TypeScript, performance, UI-race, and data-integrity reviews).

Changes the deepen pass forced (each marked `[deepened]` below):

1. **AD-3 rewritten.** "Zoom transform in React state" was a spec error caught independently by the performance and race reviews: wheel/pinch events at 60–120Hz through setState guarantees jank, and mirrored state fights d3-zoom's internal transform. d3-zoom's transform is now the single source of truth, written to the `<g>` imperatively; React holds only the discrete LOD tier.
2. **Static edges batch into a few concatenated `<path>` elements** (~2,100 DOM elements → ~300); highlighted edges draw individually on hover. The biggest performance win the original plan missed.
3. **Gists move to a hand-owned file the converter never writes** (`data-notes/gists.json` with review flag + review-time hash). Three reviewers independently found the silent-clobber path where regenerating `patterns` reverts reviewed prose. Production omits unreviewed gists instead of failing the build.
4. **Generated data ships as `.ts` modules, not JSON**, so `confidence: 0|1|2` and `Scale` survive import and bad data fails compilation. `PatternId` is branded, with `parsePatternId()` as the single entry point from user input.
5. **Interaction concurrency rules specified** (centering transitions named + interruptible + latest-wins, gesture always wins, one hover timer, trail appends only in event handlers, one input-owner state machine, d3-zoom `clickDistance` as the sole click-vs-drag referee).
6. **A design language section added**: glyph grammar, trail-as-ink rules, card typography, band treatment, legend, and a deliberate paper-light-only commitment.
7. **Simplicity cuts adopted**: edge `origin` dropped from conversion output, cmdk fallback hedge deleted, apl-md cross-check demoted, palette-latency criterion cut, label LOD tier deferred, graphml→dataset moved into Phase 0 (no hand-typed seed).
8. **Determinism and provenance hardened**: seeded `randomSource`, sorted inputs, rounded coords, pinned counts (94/110/49 nodes, 1,858 edges), SHA-256-pinned vendored file, corrections that fail loudly when stale.

---

## What the first research pass changed (2026-07-15)

1. **The edge transcription project is cancelled.** [BeksOmega/pattern-language-graph](https://github.com/BeksOmega/pattern-language-graph) ships `patterns.graphml` under MIT: exactly 253 nodes and 1,858 directed edges, with per-node `name`, `section` (TOWNS/BUILDINGS/CONSTRUCTION — our three bands), `subsection` (the book's category headings), and `stars` (0/1/2 confidence). The README states the intent is exactly this use case. Vendor it, convert it, spot-check 20 patterns against a physical copy, contribute corrections upstream. Roughly one afternoon instead of weeks.
2. **The layout is computed at build time, not in the browser.** d3-force runs to completion synchronously in a script (~300 ticks, under 100ms at this size) and positions ship in the data. Deterministic map, no settle jank, near-free reduced-motion, and the per-frame-simulation performance risk disappears.
3. **Daily Pattern does not exist yet.** Searched all of `~/Projects`; no sibling project, no shared tokens anywhere. Pattern Atlas originates the identity. `[deepened]` The only enabler worth building now is purity, not packaging: `schema.ts`, `tokens.ts`, and glyph geometry (`lib/glyph.ts`) stay free of React and app imports so extraction stays trivial. No monorepo, no published package.
4. **2026 stack**: Vite 8 (Rolldown/Oxc) with `@vitejs/plugin-react` v6 (the SWC plugin is legacy); **wouter** (~2 kB) instead of React Router 8 for one dynamic route; Vitest 4; d3-force and d3-zoom unchanged at 3.0.0; cmdk 1.1.1 (~15 kB gzip incl. Radix deps — accepted, its combobox accessibility earns it); inline splitmix32 for glyph seeding.

Copyright stance validated: names, numbers, asterisks, and link structure are factual metadata (Feist; Copyright Office Circular 33); no APL derivative has a takedown record; the rights holder granted written permission in 2024 to a far more text-heavy project ([apl-md](https://github.com/zenodotus280/apl-md), non-commercial + attribution). We ship zero book prose regardless; a colophon credits the book and the dataset.

---

## Product in one paragraph

The atlas renders all 253 patterns as a single force-directed graph. Vertical position encodes scale: towns (1–94) at the top, buildings (95–204) in the middle, construction details (205–253) at the bottom, so descending the page is descending the ladder from region to doorknob. Each node is a small generative ink glyph seeded by its pattern number. Hovering a node lights its immediate thread and dims the rest. Clicking opens a card: number, name, confidence asterisks, a one-line gist, and links up and down the ladder. Navigation is primarily by following edges; a command palette exists as a side door. The user's path through the graph renders as a fading red trail, a desire line across the map.

---

## The atlas's own pattern language (design contract)

These seven patterns are the spec. When a UI decision is ambiguous, resolve it against them.

1. **Ladder of Scales.** The y-axis is scale. Every view makes clear what a pattern serves above and what completes it below.
2. **Wander Before Search.** Edges are the primary navigation. Search is present but secondary (cmd-k, no persistent search bar; a small "find" icon on touch).
3. **One Pattern, One Page.** Each pattern has a card and a URL. Number, name, asterisks, gist, thread. Nothing else.
4. **Neighborhood Glow.** The selected or hovered pattern lights its 1-hop thread and fades everything else. On desktop, hover previews it; on touch, the open card's node carries it. Glow has one owner: an open card beats hover, always.
5. **Confidence Marks.** Alexander starred the patterns he trusted. Two asterisks render heavier than one; unstarred patterns render lightest.
6. **Trail of Breadcrumbs.** The session's walk draws as a thin red path that fades with age. This is the signature element; spend the polish budget here.
7. **Living Language.** v1 is read-only. The schema leaves room for user annotations and forks later; do not build them yet.

---

## Architecture decisions

- **AD-1: Static site, no backend.** All data ships bundled (imported modules, not fetched — no runtime fetch-failure state). Deploy to **Vercel**: matches recent local precedent (martinimap), and SPA fallback is one rewrite in `vercel.json`. `[deepened]` The client bundle never includes the graphml; total payload (React + wouter + d3-zoom + cmdk + data ≈ well under 150 kB gzip) is a non-issue.
- **AD-2: Vite 8 + React 19 + TypeScript ~5.9, strict mode.** `@vitejs/plugin-react` v6, Vitest 4, flat ESLint config (copy the shape from `~/Projects/Personal/prediction-market-calculator/eslint.config.js`), three-file tsconfig split. `[deepened]` Enable `noUncheckedIndexedAccess`. No UI framework. Styles come from `src/theme/tokens.ts` plus plain CSS.
- **AD-3: d3-force at build time; SVG rendered by React; d3-zoom owns the camera.** `[deepened — rewritten]` `scripts/compute-layout.ts` runs the simulation to completion (forceLink + forceManyBody with `distanceMax`, per-scale `forceY` banding, `forceCollide`) and bakes positions. In the browser:
  - **d3-zoom's internal transform is the single source of truth for the camera.** Its handler writes `transform` to the inner `<g>` via ref, imperatively — zero React renders during a gesture. Nothing else ever writes the transform except `zoom.transform` calls (never the attribute directly). React state holds only the discrete LOD tier (crossing k≈0.7), applied as a class toggle on the root `<g>`.
  - **Static edges render as a few concatenated `<path>` elements** (one `d` string batching hundreds of edges), `pointer-events: none`. Highlighted edges draw as individual elements over them on hover/selection. DOM stays ~300 elements instead of ~2,100.
  - Glyphs render once into `<defs><symbol>` and place with `<use>`; state (dim, confidence weight) rides inherited properties (`opacity`, `currentColor`, CSS variables) since styles don't cross the use-shadow boundary.
  - Node list and edge paths are `React.memo` over the immutable data module; hover, route, and zoom never flow through their props.
  - Canvas is the named fallback only if this still janks on an A15-class iPhone.
- **AD-4: URL is the state — for the card, not the camera.** **wouter** for routing. `/pattern/180` deep-links a card and centers its node. Prev/next keys walk the ladder. No global state library. `[deepened]` Two stated exceptions to "URL is the state": the camera (owned by d3-zoom) and the trail (owned by `trailStore`, a ~30-line subscribable module). Back/forward restores the card, and the normal centering rule brings the node into view; the viewport itself is not restored.
- **AD-5: Content stance (copyright).** Pattern names, numbers, confidence marks, scale bands, categories, and the link structure are factual metadata and ship as data. Every sentence of prose in the app is original. The book's text never enters the repo — not in data, comments, or fixtures. A colophon page credits the book and the BeksOmega dataset (MIT).
- **AD-6: This project originates the shared identity.** Daily Pattern doesn't exist yet. Enable future reuse through purity only: `schema.ts`, `tokens.ts`, and `lib/glyph.ts` (pure glyph geometry that `NodeGlyph.tsx` merely renders) import nothing from React or app code.
- **AD-7: Single data source of truth, with loud failure modes.** `[deepened]` `data-notes/patterns.graphml` (vendored, MIT) → `scripts/convert-graphml.ts` → generated `src/data/patterns.ts`. Rules:
  - The vendored file's SHA-256 is pinned in `data-notes/LICENSE-data` (with upstream URL, commit, retrieval date, MIT text); conversion refuses a file whose hash doesn't match, so re-vendoring is a deliberate step.
  - Hand corrections live in the conversion script, each keyed to a precondition ("edge 112→106 exists"); a correction whose precondition no longer holds **fails the conversion** — stale corrections never apply silently.
  - Gist prose lives in hand-owned `data-notes/gists.json`, merged in by the converter, never written by it.
  - Edge `origin` (start/end) is not emitted — no v1 feature uses it; the graphml retains it if ever needed.
  - The nearly identical [pattern-language-explorer](https://github.com/kurtneiswender/pattern-language-explorer) is a reference implementation only — no license, and its JSON embeds book prose.

---

## Data model `[deepened — revised]`

```ts
// src/data/schema.ts — pure, no React/app imports
export type PatternId = number & { readonly __brand: "PatternId" };
export type Scale = "towns" | "buildings" | "construction";
export type Confidence = 0 | 1 | 2;

export interface Pattern {
  id: PatternId;          // 1..253, the book's numbering
  name: string;           // the book's pattern name
  confidence: Confidence; // asterisks in the book (graphml `stars`)
  category: string;       // the book's section heading (graphml `subsection`)
  gist?: string;          // ORIGINAL one-liner, <= 140 chars; absent until reviewed
  broader: PatternId[];   // sources of incoming edges (larger patterns this completes)
  narrower: PatternId[];  // targets of outgoing edges (smaller patterns that complete it)
}

// scale is derived, not stored: scaleForId(id) — one source of truth.
// parsePatternId(raw: string): PatternId | null is the ONLY producer of
// PatternId from user input; it owns "/pattern/012" normalization and not-found.
// buildAdjacency(patterns): ReadonlyMap<PatternId, readonly PatternId[]>
//   — neighbors = deduped broader ∪ narrower; pure, tested.
```

**Generated data ships as TypeScript, not JSON.** `convert-graphml.ts` and `compute-layout.ts` emit `src/data/patterns.ts` and `src/data/layout.ts` (`export const patterns = [...] satisfies readonly Pattern[]`). JSON imports would widen `0|1|2` to `number`; `.ts` emission means invalid generated data fails the build, with no runtime validation layer. Positions round to 1 decimal; keys sort; the writers are deterministic. `layout.ts` embeds a content hash of its input so a layout baked from stale edges fails validation. Layout access goes through `positionFor(id: PatternId): Point` (throws; "every id has a position" is an integrity test).

**Gist prose is pipeline data, not app schema.** `data-notes/gists.json` holds `{ id, gist, reviewed, reviewedHash }` per pattern, hand-owned. The converter merges reviewed gists into `patterns.ts`; unreviewed gists ship to dev builds with a draft marker and are **omitted from production** (card renders without a gist; build log prints the count). `draft-gists.ts` refuses to touch any entry with `reviewed: true`; `reviewed && hash(gist) !== reviewedHash` is a hard validation failure, so prose edited after review can't ship as reviewed.

**Integrity rules** (`tests/data.test.ts`):
- ids exactly 1..253, no gaps; every edge endpoint exists; `broader`/`narrower` consistent inverses; no self-edges or duplicate edges
- edge direction: `broader` ids < own id and `narrower` ids > own id (Alexander's structure runs larger→smaller); violations from the graphml are named exceptions in the test, not silent
- pinned aggregates: 1,858 edges total (constant, updated deliberately with corrections); band counts 94/110/49
- names unique (trim/case-normalized), non-empty, no digit-only names
- orphan check: no node with empty `broader` AND empty `narrower` outside a documented allowlist (pattern 1 legitimately tops the ladder)
- categories drawn from a closed list of the book's headings
- every gist ≤ 140 chars, non-empty when present; reviewed-hash rule above
- every id has a layout position, inside its scale band; layout file hash matches its input hash
- vendored graphml hash matches the pin in `LICENSE-data`

---

## Design language `[deepened — new section]`

From the frontend-design and dataviz passes. These are commitments, not suggestions; Phase 2/3 acceptance references them.

**Glyphs — one edition, not 253 doodles.** Every glyph is built from the same three primitives Alexander's own diagrams use: circle arc, straight tick, small filled dot. Stroke-only (plus the dot), ink color, round caps, ~16px design box. The seed (splitmix32 of the pattern id) chooses arrangement only — arc rotation snapped to 30° increments, one of 3–4 canonical compositions, tick count 2–4, dot offset — never what kinds of marks exist. Confidence reads as weight and completeness: 2★ = heaviest stroke + closed circle; 1★ = medium + ~270° arc; 0 = lightest + arc under 180° — hypotheses drawn as literally incomplete figures. **Size is the primary confidence channel** (three discrete radius steps, smallest ≥3px at minimum zoom) because it alone survives the glyph→dot LOD collapse; stroke weight is the redundant second channel at glyph tier. Never encode confidence in opacity — it collides with dimming. Phase 2 includes a throwaway dev route rendering all 253 in a grid; cohesion problems are fixed by adjusting the grammar, never individual glyphs.

**Trail — ink, not debug polyline.** Printer's red `#A93315`, round caps/joins, **`mix-blend-mode: multiply`** over the paper — multiply makes overdraw darken naturally (the revisit rule falls out for free) and sits the line *in* the paper. Taper by age: newest segment ~2.5px, oldest ~1px, opacity fading in parallel. Each segment's midpoint displaces 2–4px perpendicular (seeded from the endpoint ids, deterministic) and draws as a quadratic curve — straight lines between force-layout coordinates are the single biggest "demo" tell. A small filled dot at the current position only; no arrowheads, no vertex dots, no SVG filter textures. The trail's non-color identity (2px continuous stroke over a hairline edge field) is a hard requirement — it must read in grayscale.

**Cards — a page, not a popover.** Number large in the serif with `font-variant-numeric: oldstyle-nums`; name in caps-and-small-caps, letterspaced ~+0.05em (close to the 1977 edition's heading treatment). Asterisks as literal `*`/`**` after the name in ochre, with a plain-text line beneath ("Alexander's confidence: high") — no invented star icons. Gist as the only paragraph: ~1.15em, leading 1.55, max ~34ch. Broader/narrower as two labeled lists with small-caps eyebrows, separated by one hairline ink rule at 20%. Card surface is paper with a 1px ink border, square corners, no drop shadow.

**Bands.** No hulls. Two solid 1px hairline rules at the band boundaries, plus marginal small-caps labels ("TOWNS · 1–94") in the left gutter, screen-fixed vertically like running heads. No tinted band backgrounds — they eat contrast headroom.

**Dimming (Neighborhood Glow's other half).** Dim asymmetrically: nodes drop to a **precomputed dim token** (`--node-dim`: ink flattened onto paper at ~40%, verified ≥3:1 — a checkable hex, not an emergent blend); non-neighbor edges drop to ~0.03 opacity or hide; neighbor edges rise to ~0.6–0.8 with a heavier stroke. Highlighted nodes keep their normal color — highlight by contrast difference, never recoloring. ~120ms transition on the 253 nodes only; **instant on edges** (SVG strokes don't composite; transitioning 1,858 of them repaints the scene per frame) and instant everywhere under reduced motion.

**Edges at rest.** Hairline 0.5–0.75px at 0.08–0.12 opacity; stroke scales as width/√k on zoom so zooming in yields air, not ropes. **No arrowheads** — the vertical banding is the arrow (edges run top→down, broader→narrower); the card's lists carry exact semantics.

**Legend.** One small collapsible card, bottom-left, keyboard-reachable, three rows: confidence (three sized dots, `** / * / unstarred`), the trail ("your path this session"), bands ("higher = larger scale"). Asterisk meaning restated on the pattern card where it's actually read.

**Paper-light only.** The identity is the paper: ink on `#FBF6E8` with multiply blending is a print metaphor, meaningless on dark ground. Declare `color-scheme: light`. A deliberate art-direction commitment, like the book having one paper stock; revisit only if pattern 7 makes long reading sessions a use case.

**Color safety.** Verify ochre-on-paper contrast (pick an ochre step dark enough or ink-stroke the glyphs); check red-vs-ochre under protanopia/deuteranopia and deepen the red (lower lightness, keep chroma) if they converge. Validated by script in Phase 2 acceptance, not by eye.

**Ban list:** node hue coding, drop shadows, gray-#999 edges, rounded floating tooltips, any sans-serif anywhere, any animation of the layout itself.

---

## Resolved interaction decisions

The plan's previously unspecified behaviors, decided so implementation never guesses. `[deepened]` items come from the race-condition review.

**Trail semantics** (the signature element; this table is the spec):

| Navigation act | Appends a trail segment? |
|---|---|
| Click a node on the graph | Yes — from previous node to it |
| Thread link on a card | Yes |
| Prev/next keys | Yes |
| cmd-k palette select | Yes — segments are node-to-node, so palette jumps draw long strokes across the map; that is the desire-line aesthetic, intended |
| Deep link (cold load) | Seeds the start point; no segment |
| Browser back/forward | No — replaying history doesn't extend the walk |
| Revisiting a node | Yes — multiply blending darkens the overdraw, like a real desire line |

Fade: last 20 segments visible, width and opacity taper by age, reload clears. In-memory only for v1. `[deepened]` **Appends happen synchronously in the navigation event handlers** (node click, thread-link click, keydown, palette select) via `trailStore.visit(id)` — never in a route-observing effect, where popstate is indistinguishable from a click and StrictMode double-fires. "Previous node" is read from the trail itself.

**Camera and centering.** `[deepened]` Every card navigation centers its node at the current zoom via a **named, interruptible d3 transition** on the zoom selection (`zoom.transform`, never the attribute). Rules: a user gesture always wins immediately (d3's same-selection/same-name interruption semantics; interrupted transitions are never resumed); a new navigation cancels the in-flight centering, so the camera only ever animates toward the current route (test: hold →, release — camera settles on the displayed card); while a gesture is active (tracked via zoom start/end events), centering is deferred to gesture end. Instant jump under reduced motion.

**Click vs. drag.** `[deepened]` d3-zoom's `clickDistance` (and its filter) is the sole referee — no hand-rolled threshold beside it, or two adjudicators occasionally both rule. Nodes are not draggable in v1. Hit areas: generous invisible circles, ≥32 CSS px at default zoom, ≥24 at minimum, independent of glyph size.

**Hover.** One pending ~50ms debounce timer, cleared on every new hover, on pointerleave of the SVG, and on navigation. Glow ownership precedence: open card beats hover, always. Dim/highlight applied imperatively (refs + adjacency Map): one class on the root `<g>` plus per-element marking of only the O(degree) highlighted set (~30 DOM writes, not 2,100).

**Input ownership.** `[deepened]` One state machine — MAP / CARD / PALETTE — decides who owns the keyboard. `←`/`→` walk prev/next when CARD owns input; no wrap at 1 and 253 (Alexander's sequence has ends; disabled affordance). `Esc` closes card → `/`, closes palette → previous owner. `cmd-k`/`ctrl-k` opens the palette from anywhere; while PALETTE is open, arrows belong to it.

**Touch model.** Tap opens the card; Neighborhood Glow binds to the *open* pattern on every device. Desktop hover is a preview of the same state. Contract pattern 4 survives on phones without a two-tap dance. `preventDefault` on Safari's `gesturestart`; `touch-action: none` on the SVG.

**Error URLs.** `/pattern/999`, `/pattern/0`, `/pattern/abc` render a not-found card at that URL (no silent redirect) with a link home; `/pattern/012` normalizes to `/pattern/12` — all owned by `parsePatternId`. Unknown routes get the same treatment.

**Accessibility model.** The graph SVG is decoration: `role="img"` with a description. The keyboard/screen-reader surface is `/patterns`, a semantic list of all 253 grouped by category, each linking to its card. Cards are fully semantic; each sets `document.title` to `"N. Name — Pattern Atlas"`. Reduced motion: layout is pre-baked (nothing to suppress), centering jumps, transitions instant, trail renders as static segments. Dimmed nodes keep ≥3:1 contrast.

---

## Content pipeline

**Structure (solved).** Vendor `patterns.graphml` (MIT, hash-pinned, attributed in `LICENSE-data` and the colophon). `convert-graphml.ts` emits `patterns.ts`. Validation: spot-check 20 patterns' names, stars, and links against a physical copy, recorded in `data-notes/validation.md`; the apl-md link cross-check runs only if the spot-check finds errors. Corrections found get PR'd upstream (their `postProcessGraph`) and mirrored locally with preconditions.

**Prose.** `draft-gists.ts` calls the Claude API to draft gists into `data-notes/gists.json` (skipping reviewed entries) with explicit instructions to paraphrase from general knowledge and never quote. A human pass flips `reviewed` per entry; reviewing 253 one-liners is a few hours and full review is a Phase 5 exit criterion. Production omits unreviewed gists rather than blocking the build.

---

## Milestones

### Phase 0 — Scaffold and dataset structure `[deepened — absorbed the graphml conversion; no hand-typed seed]`
Goal: a running skeleton with the schema locked and real data flowing.
- `npm create vite@latest . -- --template react-ts` (Vite 8, plugin-react v6), TS strict + `noUncheckedIndexedAccess`, flat ESLint, Vitest 4 (jsdom), wouter. `engines` pins Node.
- `schema.ts` (branded `PatternId`, `parsePatternId`, `scaleForId`, `buildAdjacency`), `tokens.ts`.
- Vendor `data-notes/patterns.graphml` + `LICENSE-data` (URL, commit, date, SHA-256, MIT text); `convert-graphml.ts` → generated `src/data/patterns.ts` (committed).
- Integrity tests wired into `npm test`.
- `git init` + initial commit; `history.md` started.

Accept when: `npm run dev` lists real patterns from the converted dataset; `npm test` passes the full integrity suite on 253/253; `npm run build` succeeds.

### Phase 1 — Validation, corrections, gists
Goal: trusted data and drafted prose.
- 20-pattern spot-check against the book → `data-notes/validation.md`; corrections added with preconditions; upstream PRs filed.
- `compute-layout.ts` → `layout.ts` (sorted inputs, seeded `randomSource`, fixed tick count, 1-decimal coords, input hash embedded).
- `draft-gists.ts` run once → `data-notes/gists.json`; review workflow documented; converter merges reviewed gists only into prod output.

Accept when: integrity tests pass including pinned aggregates and band-position checks; running `compute-layout.ts` twice produces byte-identical output (hash-compared); repo contains zero passages of the book's text; spot-check documented.

### Phase 2 — Graph
Goal: the map.
- SVG graph per AD-3: batched static edge paths (`pointer-events: none`), `<symbol>`/`<use>` glyphs per the design-language grammar, imperative camera, LOD dot collapse below k≈0.7 (label tier deferred — add only if eyeballing demands it).
- d3-zoom pan/pinch (`touch-action: none`, `scaleExtent`, `clickDistance`), band rules + marginal labels, legend.
- Neighborhood Glow per the dimming spec (root-class + O(degree) marking, dim token, instant edges).
- Dev-only glyph grid route (all 253) for family-cohesion review.

Accept when: pan and zoom hold 60fps on a mid-range laptop **and an A15-class phone**; hovering a node with n neighbors highlights exactly n+1 nodes and n edges; layout byte-identical across two builds; a >clickDistance drag starting on a node pans and opens nothing; trail-red/ochre/dim-token combination passes the contrast/CVD validator script; glyph grid reviewed and grammar signed off.

### Phase 3 — Cards and routing
Goal: One Pattern, One Page.
- `PatternCard.tsx` per the card typography spec; wouter routes `/`, `/pattern/:id`, `/patterns`, not-found.
- Centering per the camera rules (named transition, latest-wins, gesture wins); `document.title` per card.
- `←`/`→` prev/next with disabled ends; `Esc`; input-owner state machine; empty `broader`/`narrower` render explicit "top of the ladder" / "ground level" states.
- `vercel.json` SPA rewrite committed now, so acceptance runs against a preview deploy.

Accept when: cold load of `/pattern/180` on a preview deploy renders the card with the node centered; every thread link works; holding → then releasing settles the camera on the displayed card; `/pattern/999` and `/pattern/abc` render the not-found card; back/forward restore prior cards (viewport re-centers, not restored).

### Phase 4 — Wandering
Goal: the signature.
- Trail of Breadcrumbs per the semantics table and ink spec (`trailStore`, multiply, taper, curved segments, 20-segment window).
- cmd-k palette (cmdk 1.1.1): match on name and number, integer 1–253 surfaces that pattern first, ctrl-k on Windows, visible "find" icon on touch/narrow viewports, Escape restores focus, zero-match copy.

Accept when: visiting five patterns draws a five-segment trail fading oldest-first; each row of the trail table behaves as specified (tested, including back/forward appending nothing); revisit overdraw visibly darkens; palette flows work per spec.

### Phase 5 — Polish and ship
Goal: quality floor, then deploy.
- Touch pass: tap-to-open with glow-follows-selection, pinch, hit targets verified on a real phone in the densest graph region; decide the default mobile viewport (fit-all vs. open on the towns band) by eye.
- Visible keyboard focus everywhere; `/patterns` navigable end-to-end without a mouse; reduced-motion verified by emulation; dim-token contrast ≥3:1 re-verified in situ.
- All 253 gists reviewed (`reviewed: true`) — exit criterion; colophon (book credit, dataset credit, "all prose original").
- Deploy to Vercel.

Accept when: Lighthouse accessibility ≥95 **and** a manual keyboard-only pass reaches pattern 1's card from `/` (Lighthouse can't see an empty SVG); production serves the full atlas with every gist reviewed; cold `GET /pattern/180` on production returns the app.

---

## File tree

```
patternlanguages/
  PLAN.md  CLAUDE.md  history.md  package.json  vercel.json
  plans/        feat-pattern-atlas-explorable-graph.md
  src/
    main.tsx  App.tsx
    atlas/      Graph.tsx  NodeGlyph.tsx  Edges.tsx  Trail.tsx  trailStore.ts  useCamera.ts
    card/       PatternCard.tsx  NotFoundCard.tsx
    index/      PatternIndex.tsx            # /patterns a11y + browse surface
    search/     Palette.tsx
    data/       patterns.ts  layout.ts      # generated, committed
                schema.ts  adjacency.ts
    theme/      tokens.ts  base.css
    lib/        prng.ts  glyph.ts           # pure; splitmix32 cited; glyph geometry
  scripts/      convert-graphml.ts  compute-layout.ts  draft-gists.ts  validate-data.ts
  data-notes/   patterns.graphml  LICENSE-data  gists.json  validation.md
  tests/        data.test.ts
```

---

## Simplifications adopted and declined `[deepened]`

Adopted from the simplicity review: edge `origin` not emitted; cmdk committed (fallback paragraph deleted); apl-md cross-check demoted to error-triggered; palette `<150ms` criterion cut (can't fail at 253 items); label LOD tier deferred; Daily Pattern served by purity only; hand-typed seed dataset deleted (real conversion lands in Phase 0).

Declined, with reasons: **`gistReviewed` machinery kept** in reduced form — the reviewer proposed deleting it, but three other reviewers found the regeneration-clobber path, which justifies the separate hand-owned file; the "reduced form" is: no flag in the shipped schema, production omits rather than build-blocks, full review is a Phase 5 exit criterion. **`category` kept** — it groups the `/patterns` index, comes free from the graphml, and grouping is the difference between an a11y checkbox and a usable browse page.

---

## Risks and open questions

- **Upstream data errors.** BeksOmega's README warns the extraction "is not perfect." Mitigated by the spot-check, precondition-keyed corrections, pinned aggregates, and upstream PRs.
- **Gist quality.** 253 machine-drafted lines will be uneven. The hand-owned review file plus prod-omission means shipping pressure never publishes an unread paraphrase — worst case a card lacks a gist.
- **Glyph grammar cohesion.** The grid review exists because the first grammar draft will have outliers; fix the grammar, not glyphs.
- **Band layout on portrait phones.** Three vertical bands at full-graph zoom is a hard aspect ratio; default mobile viewport decided by eye in Phase 5.
- **Safari SVG paint.** The known weak spot even after edge batching; the A15-class acceptance test exists to catch it, canvas edges are the named escape hatch.
- **Trail persistence** (localStorage/export) stays deferred to pattern 7, Living Language.

---

## References & research

### Data
- MIT edge dataset (primary source): https://github.com/BeksOmega/pattern-language-graph — 253 nodes / 1,858 edges, `stars` + `section` + `subsection`; write-up: http://bekawestberg.me/blog/pattern-language/
- Reference implementation (no license — study only): https://github.com/kurtneiswender/pattern-language-explorer
- Cross-validation source: https://github.com/zenodotus280/apl-md (rights-holder permission letter in its LICENSE.md, 2024-04-14); GPL alternative dataset: https://github.com/mabafaba/apatternlanguage
- Academic ground truth for counts: Dawes & Ostwald 2020, https://journals.sagepub.com/doi/10.1177/2399808318761396

### Copyright
- Facts/titles not protectable: Feist v. Rural (1991); US Copyright Office Circular 33: https://www.copyright.gov/circs/circ33.pdf
- apl-md launch discussion (tolerance precedent): https://news.ycombinator.com/item?id=40342008

### Frameworks (versions verified 2026-07)
- Vite 8 / Rolldown: https://vite.dev/blog/announcing-vite8 ; plugin-react v6 (Oxc; SWC plugin legacy): https://github.com/vitejs/vite-plugin-react/releases
- d3-force 3.0.0 static-layout tick loop: https://d3js.org/d3-force/simulation ; d3-zoom 3.0.0: https://d3js.org/d3-zoom
- wouter 3.10.0 (~2 kB, chosen over React Router 8): https://github.com/molefrog/wouter ; RR8 scope: https://remix.run/blog/react-router-v8
- Vitest 4 migration notes: https://vitest.dev/guide/migration.html
- cmdk 1.1.1: https://github.com/pacocoursey/cmdk
- splitmix32 (inline, cite in code): https://github.com/bryc/code/blob/master/jshash/PRNGs.md

### Technique
- React + d3 split (headless layout): https://weser.io/blog/interactive-dynamic-force-directed-graphs-with-d3
- SVG scale limits for React graphs: https://medium.com/splunk-engineering/lessons-learned-from-creating-a-custom-graph-visualization-in-react-9a667ba799d1
- Neighborhood highlight pattern: https://observablehq.com/@john-guerra/force-directed-graph-with-link-highlighting
- Banded force layouts: https://www.d3indepth.com/force-layout/
- Graph a11y bar: https://cambridge-intelligence.com/build-accessible-data-visualization-apps-with-keylines/ ; https://vis.csail.mit.edu/pubs/rich-screen-reader-vis-experiences/

### Local conventions (from ~/Projects/Personal)
- ESLint flat config template: `prediction-market-calculator/eslint.config.js`
- Vercel deploy precedent: `martinimap/.vercel/project.json`
- `history.md` format: `martinimap/history.md`

### AI-assisted research note
Plan grounded by twelve Claude agents across two passes (2026-07-15/16): research (repo survey, dataset/copyright, framework docs, user-flow analysis) and deepening (frontend-design + dataviz skill applications; architecture, simplicity, TypeScript, performance, UI-race, and data-integrity reviews). The gist-drafting script will use the Claude API; all drafts require human review before shipping (production omits unreviewed prose).
