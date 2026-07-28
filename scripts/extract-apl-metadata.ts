// Extracts factual metadata (ids, names, asterisks, sections, link structure)
// from the apl-md transcription at a pinned commit, writing
// data-notes/patterns-extracted.json. The transcription's PROSE is never
// written anywhere — only metadata leaves this script (AD-5 hard rule).
//
// Network step; run rarely and deliberately: npm run data:extract
// The converter (scripts/convert.ts) hash-pins the output of this script.

import { writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const REPO = 'zenodotus280/apl-md'
const COMMIT = 'c622b25f0b4267363d854eba3da6a82516dd5af9'
const OUT = join(
  dirname(fileURLToPath(import.meta.url)),
  '../data-notes/patterns-extracted.json',
)

interface Extracted {
  id: number
  name: string
  stars: 0 | 1 | 2
  section: string
  subsection: string
  /** ids this pattern's preamble names as larger (they point down to it) */
  up: number[]
  /** ids this pattern's closing names as smaller (it points down to them) */
  down: number[]
}

const CONFIDENCE = { low: 0, medium: 1, high: 2 } as const

async function fetchJson(url: string): Promise<unknown> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.json()
}

async function fetchText(url: string): Promise<string> {
  const res = await fetch(url)
  if (!res.ok) throw new Error(`${res.status} ${url}`)
  return res.text()
}

function parse(id: number, name: string, text: string): Extracted {
  const conf = text.match(/#APL\/confidence\/(\w+)/)
  if (!conf || !(conf[1]! in CONFIDENCE)) {
    throw new Error(`pattern ${id}: no confidence tag`)
  }
  const tag = text.match(/#APL\/([\w-]+)-Patterns\/([\w-]+)/)
  if (!tag) throw new Error(`pattern ${id}: no section tag`)
  const subsection = tag[2]!
    .split('---')
    .map((part) => part.replace(/-/g, ' '))
    .join(' — ')

  // Related Patterns: first link-bearing paragraph is the preamble (upward),
  // later ones the closing (downward). Pattern 253 has none; edges reach it
  // from other files.
  const up = new Set<number>()
  const down = new Set<number>()
  const related = text.split('### Related Patterns')[1]?.split('\n---')[0]
  if (related) {
    const paras = related.split('\n\n').filter((p) => p.includes('[['))
    const ids = (p: string): number[] =>
      [...p.matchAll(/\((\d+)\)\]\]/g)].map((m) => Number(m[1]))
    if (paras[0]) for (const n of ids(paras[0])) up.add(n)
    for (const p of paras.slice(1)) for (const n of ids(p)) down.add(n)
  }
  up.delete(id)
  down.delete(id)

  return {
    id,
    name,
    stars: CONFIDENCE[conf[1] as keyof typeof CONFIDENCE],
    section: tag[1]!.toUpperCase(),
    subsection,
    up: [...up].sort((a, b) => a - b),
    down: [...down].sort((a, b) => a - b),
  }
}

const tree = (await fetchJson(
  `https://api.github.com/repos/${REPO}/git/trees/${COMMIT}?recursive=1`,
)) as { tree: { path: string }[] }

const files = tree.tree
  .map((t) => t.path)
  .filter((p) => /^Patterns\/.*\((\d+)\)\.md$/.test(p))
if (files.length !== 253) {
  throw new Error(`expected 253 pattern files, found ${files.length}`)
}

const results: Extracted[] = []
const queue = [...files]
await Promise.all(
  Array.from({ length: 10 }, async () => {
    for (let path = queue.shift(); path; path = queue.shift()) {
      const m = path.match(/^Patterns\/(.*) \((\d+)\)\.md$/)!
      const text = await fetchText(
        `https://raw.githubusercontent.com/${REPO}/${COMMIT}/${encodeURIComponent(path)}`,
      )
      results.push(parse(Number(m[2]), m[1]!, text))
    }
  }),
)

results.sort((a, b) => a.id - b.id)
const payload = {
  source: { repo: REPO, commit: COMMIT, note: 'metadata only; no prose' },
  patterns: results,
}
writeFileSync(OUT, JSON.stringify(payload, null, 2) + '\n')
console.log(`wrote ${OUT}: ${results.length} patterns`)
