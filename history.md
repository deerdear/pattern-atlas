# Project History — Pattern Atlas

## 2026-07-15/16: Planning session (/workflows:plan)

Input: a complete hand-written PLAN.md draft for Pattern Atlas (force-directed graph of the 253 A Pattern Language patterns). Ran four parallel research agents (repo survey, dataset/copyright, framework docs, spec-flow analysis) and wrote the revised plan to `plans/feat-pattern-atlas-explorable-graph.md`.

Key findings that changed the plan:
- **Edge transcription cancelled**: BeksOmega/pattern-language-graph (MIT) has all 253 nodes + 1,858 true directed edges with stars/sections/edge-origin. Old Phase 1a/1b replaced by graphml conversion + 20-pattern spot-check.
- **Layout moved to build time**: run d3-force to completion in `scripts/compute-layout.ts`, bake positions into `layout.json`. Gives deterministic map, no settle jank, near-free reduced-motion, removes the 60fps risk.
- **Daily Pattern sibling does not exist** anywhere in ~/Projects — this project originates the shared tokens/schema.
- **2026 stack**: Vite 8 + plugin-react v6 (not SWC), wouter instead of React Router 8, Vitest 4, d3-force/zoom still 3.0.0, cmdk 1.1.1 (~15 kB gzip incl. Radix), inline splitmix32 for glyph seeding.
- Spec-flow analysis forced decisions now recorded in the plan: trail semantics table (what appends a segment), touch model (glow follows the open card's node), no prev/next wrap at 1/253, not-found cards for bad URLs, a11y via `/patterns` index route with the graph as `role="img"` decoration.

Repo state: directory was empty, not yet a git repo (git init pending user confirmation). No code written — plan only.

## 2026-07-16: Deepen pass (/deepen-plan, auto-run under ultrathink)

Eight more agents (frontend-design + dataviz skill applications; architecture, simplicity, TypeScript, performance, UI-race, data-integrity reviews). Plan revised in place; every change marked `[deepened]` in the plan.

Highest-impact corrections:
- **AD-3 spec error** caught independently twice: zoom transform must NOT go through React state. d3-zoom owns the camera; imperative transform on the `<g>`; React holds only the LOD tier.
- **Batch static edges** into a few concatenated `<path>` elements (~2,100 DOM elements → ~300); highlighted edges drawn individually. Edge opacity transitions banned (main-thread repaint of full scene).
- **Gist clobber path** found by three reviewers: gists + review flags move to hand-owned `data-notes/gists.json`; converter merges, never writes; prod omits unreviewed gists instead of failing the build; review-time hash prevents silent post-review edits.
- **Generated data ships as .ts modules** (`satisfies readonly Pattern[]`), not JSON — JSON imports widen the `0|1|2` unions. Branded `PatternId` with `parsePatternId()` as sole producer from user input.
- **Interaction concurrency rules**: named interruptible centering transitions (latest-wins, gesture wins), single hover timer, trail appends only in event handlers (never route effects — popstate vs click indistinguishable there), `clickDistance` as sole click/drag referee, MAP/CARD/PALETTE input-owner state machine.
- **Design language section added**: glyph grammar (3 primitives, seeded arrangement, confidence = size + stroke weight + arc completeness), trail as ink (multiply blend, age taper, curved segments), card typography, band rules, paper-light-only commitment, ban list.
- **Simplicity cuts**: edge `origin` dropped, cmdk fallback hedge cut, hand seed dataset deleted (graphml conversion moved into Phase 0), palette-latency criterion cut, label LOD deferred. Declined: deleting the gist-review mechanism (clobber risk justifies it); cutting `category` (groups the /patterns index).

## 2026-07-18..28: Phase 0 implemented (branch feat/phase-0-scaffold)

Scaffold: Vite 8 react-ts template (came with oxlint instead of eslint — kept it; TS ~6.0, React 19.2). Added `strict` + `noUncheckedIndexedAccess` (template ships with NEITHER — check this on future scaffolds), Vitest 4 (jsdom), wouter, tsx for scripts, engines >=22.12.

**Dataset findings (the important part).** Vendored patterns.graphml at commit `1404507` (SHA-256 pinned in LICENSE-data + converter). The upstream data has real extraction errors the plan's spot-check anticipated:
- "THE FAMILY" (book 75) carried id 73, colliding with Adventure Playground; id 75 absent.
- "THICKENING THE OUTER WALLS" (book 211, CONSTRUCTION) carried id 201/BUILDINGS, colliding with Waist-High Shelf; id 211 absent.
- The two collision victims lost their `stars` values (defaulted 0 pending book check).
- 66 self-edges and 106 duplicate edge pairs — noise; dropped/deduped. Clean edge count **1,686** (not the advertised 1,858 — plan's pinned aggregate corrected).
- ~199 edges run large-id→small-id; legitimate (threads cross the numbering), pinned as a count, NOT an invariant. The plan's "direction-by-scale" integrity rule was wrong; replaced with pinned quirk count.
- Patterns 75/211 are edge-orphans (their threads conflated into 73/201) — allowlisted, Phase 1 open item to transcribe their true links from the book.

All corrections are precondition-keyed in convert-graphml.ts and logged in data-notes/validation.md. Generated `src/data/patterns.ts` as a `.ts` module (`satisfies readonly PatternData[]` — added unbranded `PatternData` twin to schema.ts because literal `number`s can't satisfy branded `PatternId`).

Phase 0 acceptance: 17 tests green (16 integrity + render smoke), `npm run build` clean (227 kB / 70 kB gzip), lint clean, App lists 253 patterns grouped by band.
