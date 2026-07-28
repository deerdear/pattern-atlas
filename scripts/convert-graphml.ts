// Converts the vendored patterns.graphml into src/data/patterns.ts.
// Single source of truth pipeline (AD-7): refuses a graphml whose SHA-256
// doesn't match the pin below; hand corrections live here, precondition-keyed,
// and fail loudly when stale. Gist prose merges in from data-notes/gists.json
// (hand-owned; this script never writes it).
//
// Run: npm run data:convert

import { createHash } from 'node:crypto'
import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const GRAPHML_PATH = join(root, 'data-notes/patterns.graphml')
const GISTS_PATH = join(root, 'data-notes/gists.json')
const OUT_PATH = join(root, 'src/data/patterns.ts')

// Pinned in data-notes/LICENSE-data; re-vendoring updates both deliberately.
const PINNED_SHA256 =
  'f107192313d9a68f0a9dfc24eddec3a595c82da20da0a2af54203cd1a4c8a939'

const PATTERN_COUNT = 253

interface RawNode {
  id: number
  name: string
  section: string
  subsection: string
  stars: number | null // null = missing in source; corrections must resolve
}

interface RawEdge {
  source: number
  target: number
}

interface GistEntry {
  id: number
  gist: string
  reviewed: boolean
  reviewedHash?: string
}

// --- Corrections layer ---------------------------------------------------
// Each correction states a precondition on the raw data. If the precondition
// no longer holds (e.g. upstream fixed the same error), conversion FAILS so
// stale corrections never apply silently. Findings go to data-notes/
// validation.md and upstream PRs.
interface Correction {
  description: string
  precondition: (nodes: RawNode[], edges: RawEdge[]) => boolean
  apply: (nodes: RawNode[], edges: RawEdge[]) => void
}

const corrections: Correction[] = [
  {
    // Upstream extraction glitch: "The Family" (book pattern 75) carries
    // id 73, colliding with the real 73 (Adventure Playground); id 75 is
    // absent. Position in file (between 74 and 76) and the book confirm.
    description: 'reassign THE FAMILY from id 73 to id 75',
    precondition: (nodes) =>
      nodes.filter((n) => n.id === 73).length === 2 &&
      nodes.some((n) => n.id === 73 && n.name === 'THE FAMILY') &&
      !nodes.some((n) => n.id === 75),
    apply: (nodes) => {
      nodes.find((n) => n.id === 73 && n.name === 'THE FAMILY')!.id = 75
    },
  },
  {
    // Same glitch: "Thickening the Outer Walls" (book pattern 211,
    // CONSTRUCTION) carries id 201/BUILDINGS, colliding with the real 201
    // (Waist-High Shelf); id 211 is absent.
    description:
      'reassign THICKENING THE OUTER WALLS from id 201 to id 211 (section CONSTRUCTION)',
    precondition: (nodes) =>
      nodes.filter((n) => n.id === 201).length === 2 &&
      nodes.some((n) => n.id === 201 && n.name === 'THICKENING THE OUTER WALLS') &&
      !nodes.some((n) => n.id === 211),
    apply: (nodes) => {
      const n = nodes.find(
        (x) => x.id === 201 && x.name === 'THICKENING THE OUTER WALLS',
      )!
      n.id = 211
      n.section = 'CONSTRUCTION'
    },
  },
  {
    // The two collision victims also lost their stars in extraction.
    // Default to 0 (lowest confidence claim) pending Phase 1 book check —
    // see data-notes/validation.md.
    description: 'default missing stars to 0 for 73 and 201',
    precondition: (nodes) => {
      const missing = nodes.filter((n) => n.stars === null)
      return (
        missing.length === 2 &&
        missing.some((n) => n.name === 'ADVENTURE PLAYGROUND') &&
        missing.some((n) => n.name === 'WAIST-HIGH SHELF')
      )
    },
    apply: (nodes) => {
      for (const n of nodes) if (n.stars === null) n.stars = 0
    },
  },
  {
    // 66 self-edges (a pattern cannot complete itself) and 106 duplicated
    // pairs are extraction noise. Drop selves, dedup pairs.
    description: 'drop 66 self-edges and dedup duplicate edges',
    precondition: (_nodes, edges) =>
      edges.filter((e) => e.source === e.target).length === 66,
    apply: (_nodes, edges) => {
      const seen = new Set<string>()
      const cleaned = edges.filter((e) => {
        if (e.source === e.target) return false
        const key = `${e.source}->${e.target}`
        if (seen.has(key)) return false
        seen.add(key)
        return true
      })
      edges.length = 0
      edges.push(...cleaned)
    },
  },
]

// --- Parse ---------------------------------------------------------------

function verifyHash(buf: Buffer): void {
  const hash = createHash('sha256').update(buf).digest('hex')
  if (hash !== PINNED_SHA256) {
    throw new Error(
      `patterns.graphml SHA-256 mismatch.\n  expected ${PINNED_SHA256}\n  actual   ${hash}\n` +
        'If re-vendoring was intentional, update the pin here and in data-notes/LICENSE-data.',
    )
  }
}

function parseGraphml(xml: string): { nodes: RawNode[]; edges: RawEdge[] } {
  const nodes: RawNode[] = []
  for (const m of xml.matchAll(/<node id="(\d+)">([\s\S]*?)<\/node>/g)) {
    const body = m[2]!
    const data = (key: string): string | null => {
      const dm = body.match(new RegExp(`<data key="${key}">([^<]*)</data>`))
      return dm ? dm[1]! : null
    }
    const required = (key: string): string => {
      const v = data(key)
      if (v === null) throw new Error(`node ${m[1]}: missing data key "${key}"`)
      return v
    }
    const stars = data('stars')
    nodes.push({
      id: Number(m[1]),
      name: required('name'),
      section: required('section'),
      subsection: required('subsection'),
      stars: stars === null ? null : Number(stars),
    })
  }

  const edges: RawEdge[] = []
  for (const m of xml.matchAll(/<edge source="(\d+)" target="(\d+)">/g)) {
    edges.push({ source: Number(m[1]), target: Number(m[2]) })
  }
  return { nodes, edges }
}

// --- Transform -----------------------------------------------------------

const SMALL_WORDS = new Set([
  'a', 'an', 'and', 'at', 'by', 'for', 'in', 'of', 'on', 'or', 'per', 'the', 'to',
])

/** "WINDOW PLACE" -> "Window Place"; "T-JUNCTIONS" -> "T-Junctions". */
function titleCase(caps: string): string {
  return caps
    .toLowerCase()
    .split(' ')
    .map((word, i) => {
      if (i > 0 && SMALL_WORDS.has(word)) return word
      return word
        .split('-')
        .map((part) => (part ? part[0]!.toUpperCase() + part.slice(1) : part))
        .join('-')
    })
    .join(' ')
}

function expectedSection(id: number): string {
  if (id <= 94) return 'TOWNS'
  if (id <= 204) return 'BUILDINGS'
  return 'CONSTRUCTION'
}

function loadGists(): Map<number, GistEntry> {
  if (!existsSync(GISTS_PATH)) return new Map()
  const entries = JSON.parse(readFileSync(GISTS_PATH, 'utf8')) as GistEntry[]
  const byId = new Map<number, GistEntry>()
  for (const e of entries) {
    if (byId.has(e.id)) throw new Error(`gists.json: duplicate id ${e.id}`)
    if (e.reviewed) {
      const hash = createHash('sha256').update(e.gist).digest('hex')
      if (e.reviewedHash !== hash) {
        throw new Error(
          `gists.json: gist ${e.id} is marked reviewed but its text no longer matches reviewedHash — re-review it`,
        )
      }
      if (e.gist.length === 0 || e.gist.length > 140) {
        throw new Error(`gists.json: reviewed gist ${e.id} violates length rules`)
      }
    }
    byId.set(e.id, e)
  }
  return byId
}

// --- Main ----------------------------------------------------------------

const buf = readFileSync(GRAPHML_PATH)
verifyHash(buf)
const { nodes, edges } = parseGraphml(buf.toString('utf8'))

for (const c of corrections) {
  if (!c.precondition(nodes, edges)) {
    throw new Error(`Stale correction (precondition failed): ${c.description}`)
  }
  c.apply(nodes, edges)
  console.log(`applied correction: ${c.description}`)
}

// Sanity: exact node set, section bands, edge endpoints.
if (nodes.length !== PATTERN_COUNT) {
  throw new Error(`expected ${PATTERN_COUNT} nodes, got ${nodes.length}`)
}
const byId = new Map(nodes.map((n) => [n.id, n]))
for (let id = 1; id <= PATTERN_COUNT; id++) {
  const n = byId.get(id)
  if (!n) throw new Error(`missing node ${id}`)
  if (n.section !== expectedSection(id)) {
    throw new Error(`node ${id}: section ${n.section} != ${expectedSection(id)}`)
  }
  if (n.stars === null || ![0, 1, 2].includes(n.stars)) {
    throw new Error(`node ${id}: stars ${n.stars} missing or out of range`)
  }
}
for (const e of edges) {
  if (!byId.has(e.source) || !byId.has(e.target)) {
    throw new Error(`edge ${e.source}->${e.target}: unknown endpoint`)
  }
}

// Edges run parent -> child (larger scale -> smaller). broader = incoming
// sources, narrower = outgoing targets.
const broader = new Map<number, Set<number>>()
const narrower = new Map<number, Set<number>>()
for (const e of edges) {
  if (!narrower.has(e.source)) narrower.set(e.source, new Set())
  narrower.get(e.source)!.add(e.target)
  if (!broader.has(e.target)) broader.set(e.target, new Set())
  broader.get(e.target)!.add(e.source)
}

const gists = loadGists()

const records = [...nodes]
  .sort((a, b) => a.id - b.id)
  .map((n) => {
    const gist = gists.get(n.id)
    return {
      id: n.id,
      name: titleCase(n.name),
      confidence: n.stars,
      category: titleCase(n.subsection),
      // Only reviewed gists reach the shipped data; drafts stay in gists.json.
      ...(gist?.reviewed ? { gist: gist.gist } : {}),
      broader: [...(broader.get(n.id) ?? [])].sort((a, b) => a - b),
      narrower: [...(narrower.get(n.id) ?? [])].sort((a, b) => a - b),
    }
  })

const header = `// GENERATED by scripts/convert-graphml.ts — do not edit by hand.
// Source: data-notes/patterns.graphml (see data-notes/LICENSE-data for
// provenance and license). Prose gists come from data-notes/gists.json.
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
  `wrote ${OUT_PATH}: ${records.length} patterns, ${edges.length} edges, ${reviewedCount} reviewed gists`,
)
