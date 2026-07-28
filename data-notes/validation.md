# Dataset validation log

Source: `patterns.graphml` @ BeksOmega/pattern-language-graph
commit `1404507` (see LICENSE-data). Findings below drive the corrections in
`scripts/convert-graphml.ts`; each correction is precondition-keyed and fails
the conversion if upstream fixes the same error.

## Found during Phase 0 conversion (2026-07)

1. **Duplicate node id 73.** "THE FAMILY" (book pattern 75) was extracted
   with id 73, colliding with the real 73 "ADVENTURE PLAYGROUND"; id 75 is
   absent. File position (between 74 and 76) and the book confirm.
   → correction: reassigned to id 75. Candidate upstream PR.
2. **Duplicate node id 201.** "THICKENING THE OUTER WALLS" (book pattern
   211, CONSTRUCTION) was extracted with id 201 / section BUILDINGS,
   colliding with the real 201 "WAIST-HIGH SHELF"; id 211 is absent.
   → correction: reassigned to id 211, section CONSTRUCTION. Candidate
   upstream PR.
3. **Missing stars on the two collision victims** (73 Adventure Playground,
   201 Waist-High Shelf). → defaulted to 0 pending book check (see open
   items).
4. **66 self-edges** (a pattern "completing itself") and **106 duplicated
   edge pairs** — extraction noise. → dropped/deduped. Clean directed edge
   count: **1,686** (raw file: 1,858).
5. **~199 edges run "backwards" by id** (source > target). Kept as-is: the
   book's threads genuinely cross the numbering in places; direction-by-id
   is not an invariant, only a pinned count.

## Open items for the Phase 1 book spot-check

- [ ] Verify stars for 73 (Adventure Playground) and 201 (Waist-High Shelf)
      against the book; replace the default-0 correction with true values.
- [ ] Patterns 75 and 211 have **no edges** — their threads were conflated
      into ids 73/201 by the collisions above. Transcribe their true
      broader/narrower links from the book and add edge corrections;
      remove them from the orphan allowlist in `tests/data.test.ts`.
- [ ] Category (subsection) for 75 "The Family" reads "Local Common Land" —
      inherited from the collision; verify the book's grouping.
- [ ] 20-pattern random spot-check of names/stars/links per the plan.

## Spot-checks passed so far

- Node 180 = "Window Place", stars 2, BUILDINGS/Alcoves — matches the book.
- Band counts after corrections: towns 94, buildings 110, construction 49.
