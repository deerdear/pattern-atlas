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

## 2026-07-28: Phase 1 — data source pivot + layout + gist pipeline

**The headline: BeksOmega's graphml failed validation and was replaced.** Three-source comparison (BeksOmega vs apl-md hand transcription vs iwritewordsgood book mirror):
- Edges: BeksOmega Jaccard 0.34 vs mirror; apl-md 0.93. BeksOmega's edges are mostly wrong, not noisy.
- Stars: BeksOmega agrees with mirror on 172/227 parseable patterns; apl-md 225/227. Spot checks (1, 21, 110 all ** in the book; BeksOmega had 0) confirmed.
- New pipeline: `scripts/extract-apl-metadata.ts` pulls FACTUAL METADATA ONLY (never prose — hard rule) from apl-md @ commit c622b25 → `data-notes/patterns-extracted.json` (SHA-256 pinned) → `scripts/convert.ts` → `src/data/patterns.ts`. apl-md prose is licensed non-commercial-by-permission; we take names/numbers/stars/links only (facts, Feist).
- 1,758 directed edges; 126 conflicting direction declarations resolved small-id→large-id; 159 legit "backwards" edges (pinned count, NOT an invariant — the old direction-by-scale test rule was wrong). No orphans; 75 and 211 fully threaded. Confidence 54/115/84 matches the book. Categories now 36 (subsection tags).
- Direction parse trick: apl-md Related Patterns section = preamble paragraph (upward links) then closing paragraphs (downward). Works for 252/253 (253 declares nothing; edges reach it from other files).
- Open: stars for 13 and 98 differ between apl-md and mirror — book check pending.

**Layout**: compute-layout.ts runs d3-force to completion at build time. Determinism requirements discovered: seed `simulation.randomSource` (splitmix32), sort nodes+links by id, fixed 300 ticks, round to 1 decimal, hard band clamp per tick. Verified byte-identical across two runs (sha256). Bands at y=250/750/1250, half-width 230, canvas width 1000. `positionFor()` throws on missing id; layout.ts embeds input hash so stale layouts fail tests.

**Gists**: draft-gists.ts (Claude API, Opus 4.8, structured outputs, batches of 25) writes data-notes/gists.json; refuses to touch reviewed entries; reviewedHash = sha256 of approved text, converter hard-fails on mismatch. NOT YET RUN — no ANTHROPIC_API_KEY on this machine; smoke-tested to the API boundary (clean 401). Review workflow documented in validation.md.

21 tests green; build 70 kB gzip; lint clean. Remaining Phase 1 item: run `ANTHROPIC_API_KEY=... npm run data:gists` once, then human review.

## 2026-07-28: Phase 2 — the map (branch feat/phase-2-graph)

New: `src/lib/glyph.ts` (grammar), `src/atlas/{Graph,NodeGlyph,Edges,GlyphGrid}.tsx`, `atlas/glow.ts`, `atlas/useCamera.ts`, `atlas/atlas.css`, `src/index/PatternIndex.tsx` (Phase 0 list moved, now `/patterns`), `scripts/validate-colors.ts` (`npm run check:colors`). App.tsx is now the wouter route shell; `/dev/glyphs` is dev-only via `import.meta.env.DEV` + lazy import (verified absent from the prod bundle).

**Color validator caught real token errors.** The pinned `nodeDim #A79B85` claimed ≥3:1 in its comment but measures 2.54:1 — replaced with `#8F8A7E` (ink onto page at 50%, 3.19:1). `fade` was 4.35:1, darkened to `#786E56`. Red `#A93315` vs ochre converge under deuteranopia (ΔE 5.8) — red deepened to `#93280F` per the plan's remedy (ΔE 13.4, and 7.6:1 on page). Cover ochre is 2.70:1 on page → added `ochreDeep #8A6D14` (4.55:1) as the graphics ochre; a test documents that `cover` must not be used for graphics. CVD sim is Viénot 1999 matrices; separation metric is Lab ΔE76 ≥ 12.

**Glyph grammar**: splitmix32(id) chooses rotation (30° snap), one of 4 compositions (rays/baseline/chord/axis), tick count 2–4, dot placement. Confidence → NODE_RADIUS 7/9/11 (primary), STROKE_WIDTH 1/1.3/1.7, arc sweep 150/270/360. Box-containment is tested; first draft's `baseline` composition escaped the 16px box at diagonal rotations (−8.17) — shrunk its radii/spacing.

**Renderer**: 1,758 edges batched into 4 concatenated `<path>`s (`EDGES_PER_PATH=500`); 253 `<symbol>`/`<use>` glyphs; per-node LOD dot + invisible hit circle (`r` via CSS var `--hit-r`, rewritten only on >20% k change, tracks ~32 CSS px). d3-zoom owns the camera; handler writes transform + edge stroke (width/√k) + band-label positions imperatively; React state is only the LOD tier (k<0.7 → dots). Glow: single 50ms timer, `glowing` class goes on the *svg* (not the camera `<g>` — React rewrites that element's className on tier change and would wipe imperative classes), lit set is O(degree) classList writes, highlighted edges are one imperative path `d`. `glow.ts` is pure and tested: n+1 nodes, n edges for all 253.

**jsdom gotchas**: d3-zoom's `defaultExtent` reads `svg.viewBox.baseVal` (missing in jsdom) — fixed properly by passing an explicit `.extent()`, which we know anyway. `act()` needs `IS_REACT_ACT_ENVIRONMENT = true` manually.

38 tests green; build 93.8 kB gzip; lint clean. Chrome extension wasn't connected, so the two visual acceptance items remain for human sign-off: glyph-grid cohesion review (`/dev/glyphs`) and 60fps pan/zoom on laptop + A15 phone.

## 2026-07-29: The town plan — map, not graph (branch worktree-feat-town-plan-map)

User-directed pivot: the banded force graph becomes a cartographic map where
zooming descends the ladder of scales — see the whole thing as a TOWN, zoom
into a district for its BUILDINGS, zoom again for CONSTRUCTION details. This
supersedes the plan's horizontal-band layout ("Ladder of Scales" now reads
as containment depth, not the y-axis); addendum added to the plan doc.

**Layout (compute-layout.ts rewritten, d3-delaunay added as devDep).**
Three nested deterministic stages: (1) towns-only force sim over a 1600×1200
canvas, collide radius grown by sqrt(child count), then Voronoi → 94 district
cells; (2) every buildings pattern assigned a parent district by walking
`broader` links (largest towns id among broader, else recurse through smaller
buildings-scale broaders) — 0 fallbacks needed, the thread structure resolves
all 110; same scheme construction→buildings (0 fallbacks); (3) one seeded sim
per district packs its buildings + their details, every node clamped into the
cell polygon each tick. layout.ts now also exports `districts` (cell rings),
`parents`, `canvas`. Byte-identical across runs (verified).

**Semantic tiers replace the glyph/dot LOD.** tierFor(k): town < 1.5 ≤
building < 3.2 ≤ construction (MAX_K 9). Tier class rides the scene <g>
(React-owned, same slot the old lod-dots class used — svg keeps `glowing`
imperative). atlas.css holds the tier matrix: current scale full (glyphs +
labels), scale above as area labels/walls for orientation, scale below as
context dots; hidden scales get pointer-events: none; `.lit` overrides tier
visibility so a glow thread surfaces cross-scale neighbors. Edges batch into
per-level chunks (edge-towns/-buildings/-construction, still 1,758 pinned,
≤8 paths) so each tier lights its own streets. New src/lib/footprint.ts
(seeded orthogonal plans: rect/L/courtyard-notch, box-containment tested) and
src/lib/geometry.ts (pointInPolygon, centroid — shared with tests). Labels
are per-node <text> in world units sized per scale (15/6.5/3.2).

**Verified** by rasterized SVG previews (qlmanage; Chrome extension not
connected again): town tier reads as a cadastral plan, building tier as a
neighborhood of footprints, construction tier as a detail drawing. 45 tests
green (layout suite rewritten: district tessellation, parent validity,
point-in-polygon containment, detail-near-building ≤80u); build 97.2 kB gzip;
lint clean. Remaining human sign-off: live pan/zoom feel, tier thresholds,
label overlap in dense districts (worst near canvas center), 60fps check.
Force retune after first preview: towns spread to fill canvas (charge -480,
collide 42+11√children), buildings fill their cell (charge -55, center 0.055).

## 2026-07-30: Village iterations, cards, intro, colophon, GitHub Pages

Same branch, user-driven iteration: quarters (15 towns categories, ring
anchors + hulls + baked label separation, two-line headings), bundled lanes
(w≥5), corner sketch marginalia (src/lib/sketch.ts), pattern cards at
/pattern/:id (dev-only draft gists via dynamic import — verified absent
from prod bundle), camera centering (named interruptible transition,
gesture wins), scale-filter rail (highlights a hierarchy, no camera moves),
focus mode (off-thread labels hide while glowing), per-tier label sizing +
paper halos, five intro cards ending on the author's motivation, /colophon
attributions. Deployed: github.com/deerdear/pattern-atlas (public), Pages
via Actions from feat/town-plan-map (environment branch policy widened),
BASE_PATH-aware build + wouter Router base + 404.html SPA fallback. Gotcha
logged: worktrees inside the main repo resolve node_modules from the parent
checkout — @types/d3-transition compiled locally while missing from
package.json; CI caught it. Live: https://deerdear.github.io/pattern-atlas/
