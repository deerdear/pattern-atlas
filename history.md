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
