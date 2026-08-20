// Converts data-notes/patterns-extracted.json (factual metadata extracted
// from the apl-md transcription — see scripts/extract-apl-metadata.ts and
// data-notes/LICENSE-data) into typed src/data/patterns.ts.
//
// Pipeline rules (AD-7): refuses input whose SHA-256 doesn't match the pin;
// hand corrections live here, precondition-keyed, and fail loudly when stale;
// gist prose merges in from data-notes/gists.json (hand-owned; never written
// by scripts).
//
// Run: npm run data:convert

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const EXTRACTED_PATH = join(root, 'data-notes/patterns-extracted.json')
const GISTS_PATH = join(root, 'data-notes/gists.json')
const OUT_PATH = join(root, 'src/data/patterns.ts')

// Pinned in data-notes/LICENSE-data; re-extraction updates both deliberately.
const PINNED_SHA256 =
  'c72d4b92bc8178a40e02a94a80210cd3fe1c7c5c50da1ff2cee62e698e204e96'

const PATTERN_COUNT = 253

interface ExtractedPattern {
  id: number
  name: string
  stars: 0 | 1 | 2
  section: string
  subsection: string
  up: number[]
  down: number[]
}

interface GistEntry {
  id: number
  gist: string
  reviewed: boolean
  reviewedHash?: string
}

// --- Corrections layer ---------------------------------------------------
// Each correction states a precondition on the extracted data. If it no
// longer holds (e.g. upstream fixed the same error), conversion FAILS so
// stale corrections never apply silently. Log findings in
// data-notes/validation.md.
interface Correction {
  description: string
  precondition: (patterns: ExtractedPattern[]) => boolean
  apply: (patterns: ExtractedPattern[]) => void
}

const corrections: Correction[] = [
  // none yet — open questions (stars for 13, 98) tracked in validation.md
]

// --- Load and verify -----------------------------------------------------

const buf = readFileSync(EXTRACTED_PATH)
const hash = createHash('sha256').update(buf).digest('hex')
if (hash !== PINNED_SHA256) {
  throw new Error(
    `patterns-extracted.json SHA-256 mismatch.\n  expected ${PINNED_SHA256}\n  actual   ${hash}\n` +
      'If re-extraction was intentional, update the pin here and in data-notes/LICENSE-data.',
  )
}
const extracted = (
  JSON.parse(buf.toString('utf8')) as { patterns: ExtractedPattern[] }
).patterns

for (const c of corrections) {
  if (!c.precondition(extracted)) {
    throw new Error(`Stale correction (precondition failed): ${c.description}`)
  }
  c.apply(extracted)
  console.log(`applied correction: ${c.description}`)
}

// --- Sanity --------------------------------------------------------------

function expectedSection(id: number): string {
  if (id <= 94) return 'TOWN'
  if (id <= 204) return 'BUILDING'
  return 'CONSTRUCTION'
}

if (extracted.length !== PATTERN_COUNT) {
  throw new Error(`expected ${PATTERN_COUNT} patterns, got ${extracted.length}`)
}
const byId = new Map(extracted.map((p) => [p.id, p]))
for (let id = 1; id <= PATTERN_COUNT; id++) {
  const p = byId.get(id)
  if (!p) throw new Error(`missing pattern ${id}`)
  if (p.section !== expectedSection(id)) {
    throw new Error(`pattern ${id}: section ${p.section} != ${expectedSection(id)}`)
  }
  for (const ref of [...p.up, ...p.down]) {
    if (!byId.has(ref)) throw new Error(`pattern ${id}: unknown reference ${ref}`)
  }
}

// --- Directed edges ------------------------------------------------------
// A's `down` declares A -> b (A is broader); A's `up` declares b -> A.
// The same undirected pair is often declared in both files; when the two
// declarations CONFLICT (each claims the other as its child), resolve to
// smaller-id -> larger-id (Alexander's ladder runs large scale -> small,
// which tracks the numbering) and count it — the count is pinned in tests.

const forward = new Set<string>() // "a->b"
for (const p of extracted) {
  for (const b of p.down) forward.add(`${p.id}->${b}`)
  for (const b of p.up) forward.add(`${b}->${p.id}`)
}
let conflicts = 0
const edges = new Set<string>()
for (const key of forward) {
  const [a, b] = key.split('->').map(Number) as [number, number]
  if (edges.has(`${b}->${a}`) || edges.has(`${a}->${b}`)) continue
  if (forward.has(`${b}->${a}`)) {
    conflicts++
    const [lo, hi] = a < b ? [a, b] : [b, a]
    edges.add(`${lo}->${hi}`)
  } else {
    edges.add(key)
  }
}
console.log(`edges: ${edges.size} directed (${conflicts} direction conflicts resolved small->large)`)

const broader = new Map<number, number[]>()
const narrower = new Map<number, number[]>()
for (const key of edges) {
  const [a, b] = key.split('->').map(Number) as [number, number]
  ;(narrower.get(a) ?? narrower.set(a, []).get(a)!).push(b)
  ;(broader.get(b) ?? broader.set(b, []).get(b)!).push(a)
}

// --- Gists ---------------------------------------------------------------

function loadGists(): Map<number, GistEntry> {
  if (!existsSync(GISTS_PATH)) return new Map()
  const entries = JSON.parse(readFileSync(GISTS_PATH, 'utf8')) as GistEntry[]
  const gists = new Map<number, GistEntry>()
  for (const e of entries) {
    if (gists.has(e.id)) throw new Error(`gists.json: duplicate id ${e.id}`)
    if (e.reviewed) {
      const h = createHash('sha256').update(e.gist).digest('hex')
      if (e.reviewedHash !== h) {
        throw new Error(
          `gists.json: gist ${e.id} is marked reviewed but its text no longer matches reviewedHash — re-review it`,
        )
      }
      if (e.gist.length === 0 || e.gist.length > 140) {
        throw new Error(`gists.json: reviewed gist ${e.id} violates length rules`)
      }
    }
    gists.set(e.id, e)
  }
  return gists
}

const gists = loadGists()

// --- Emit ----------------------------------------------------------------

const records = [...extracted]
  .sort((a, b) => a.id - b.id)
  .map((p) => {
    const gist = gists.get(p.id)
    return {
      id: p.id,
      name: p.name,
      confidence: p.stars,
      category: p.subsection,
      // Only reviewed gists reach the shipped data; drafts stay in gists.json.
      ...(gist?.reviewed ? { gist: gist.gist } : {}),
      broader: (broader.get(p.id) ?? []).sort((a, b) => a - b),
      narrower: (narrower.get(p.id) ?? []).sort((a, b) => a - b),
    }
  })

const header = `// GENERATED by scripts/convert.ts — do not edit by hand.
// Source: data-notes/patterns-extracted.json (see data-notes/LICENSE-data
// for provenance). Prose gists come from data-notes/gists.json.
// Regenerate with: npm run data:convert

import type { Pattern, PatternData } from './schema'

export const patterns = `

const body = JSON.stringify(records, null, 2)
writeFileSync(
  OUT_PATH,
  `${header}${body} satisfies readonly PatternData[] as unknown as readonly Pattern[]\n`,
)

const reviewedCount = records.filter((r) => 'gist' in r).length
console.log(
  `wrote ${OUT_PATH}: ${records.length} patterns, ${edges.size} edges, ${reviewedCount} reviewed gists`,
)
