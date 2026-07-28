# Dataset validation log

Current source: `patterns-extracted.json`, extracted from apl-md @ `c622b25`
by `scripts/extract-apl-metadata.ts`. See LICENSE-data for provenance.

## Phase 1 (2026-07-28): three-source validation and source pivot

Compared three independent derivations of the book's structure:

| Source | Kind | Edges (undirected) | Stars vs mirror |
|---|---|---|---|
| BeksOmega graphml (v1 source) | automated extraction | 1,649 · Jaccard **0.34** vs mirror | 172/227 agree |
| apl-md wiki-links (current) | hand transcription | 1,758 · Jaccard **0.93** vs mirror | 225/227 agree |
| iwritewordsgood mirror | HTML mirror of the book | 1,855 (incl. its own noise) | reference |

**Verdict: the BeksOmega graphml's edges and stars are unreliable** (its
README's "not perfect" warning understated it), and it carried two node-id
collisions (73/75 and 201/211, both fixed by correction in v1). The pipeline
was pivoted to apl-md-derived metadata. All v1 graphml corrections are
obsolete and removed with the source; see git history.

Spot checks against the mirror's own pages:
- 1 Independent Regions **, 21 Four-Story Limit **, 110 Main Entrance **,
  180 Window Place ** — all match apl-md (BeksOmega had 0 for the first three).
- 75 The Family * — matches apl-md (medium).
- 180's declared neighbors (130, 134, 159, 164, 179 up; 202, 221, 222, 223,
  231 down) are all present in our edge set.

Direction resolution: apl-md declares each edge in up to two files; 126
pairs conflicted (each side claiming the other as child). Resolved
smaller-id → larger-id (the ladder tracks the numbering); count pinned in
tests. 159 edges legitimately run larger-id → smaller-id where declarations
were consistent.

Ladder ends (verified plausible, not errors): 1 has no broader (top);
178, 198, 245, 246, 252, 253 have no narrower. No orphans.

## Gist review workflow

1. `ANTHROPIC_API_KEY=... npm run data:gists` drafts all missing/unreviewed
   gists into `data-notes/gists.json` (`reviewed: false`). Reviewed entries
   are never touched — safe to re-run.
2. Review each entry: original prose (not the book's), ≤140 chars, reads as
   problem → move.
3. To approve, set `reviewed: true` and `reviewedHash` to the sha256 hex of
   the exact gist string (the script prints a one-liner for this).
4. `npm run data:convert` merges reviewed gists into `patterns.ts`; the
   converter hard-fails if a reviewed gist's text doesn't match its hash.
5. Unreviewed gists never reach the generated data; a card without a gist is
   the worst case in production.

## Open items

- [ ] Stars for 13 (Subculture Boundary: apl-md *, mirror shows none) and
      98 (Circulation Realms: apl-md **, mirror shows *) — check against a
      physical copy; correct via the corrections layer if apl-md is wrong.
- [ ] 20-pattern random spot-check against a physical copy (plan Phase 1);
      the three-source digital validation above substitutes for now.
- [x] Upstream fix submitted: BeksOmega PR #1
      (https://github.com/BeksOmega/pattern-language-graph/pull/1) — fixes
      the `end`-edge off-by-one in addEdges (root cause of the 0.34 Jaccard:
      `lines[i-2]` is the *previous* pattern's closing; 1008/1053 end edges
      correct after the shift), the 141 name typo, adds a dedupe guard, and
      repairs the committed graphml (0.34 → 0.81, 64 star corrections,
      node renames). Builds on their unmerged `fix-data-errors` branch.
      A companion issue draft with the full 55-star mismatch table is in
      the session scratchpad (`beksomega-issue-draft.md`) — not filed.
- [ ] File apl-md issue for 13/98 stars if the book check disagrees.
