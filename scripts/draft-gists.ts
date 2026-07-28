// Drafts original one-line gists for all 253 patterns via the Claude API,
// writing them into data-notes/gists.json with reviewed: false.
//
// Safety rules (AD-7 / CLAUDE.md):
// - NEVER touches an entry with reviewed: true — skips it and says so.
// - Only fills entries that are missing or unreviewed.
// - Prompts instruct paraphrase-from-general-knowledge; never quotes the book.
// - Gists over 140 chars are retried once, then truncated at a word boundary.
//
// Run once (needs ANTHROPIC_API_KEY or an `ant auth login` profile):
//   npm run data:gists
// Then hand-review each entry (see data-notes/validation.md → gist review
// workflow) and flip reviewed: true with a reviewedHash.

import { readFileSync, writeFileSync, existsSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'
import Anthropic from '@anthropic-ai/sdk'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const GISTS_PATH = join(root, 'data-notes/gists.json')
const EXTRACTED_PATH = join(root, 'data-notes/patterns-extracted.json')

interface GistEntry {
  id: number
  gist: string
  reviewed: boolean
  reviewedHash?: string
}

const { patterns } = JSON.parse(readFileSync(EXTRACTED_PATH, 'utf8')) as {
  patterns: { id: number; name: string; section: string; subsection: string }[]
}

const existing: GistEntry[] = existsSync(GISTS_PATH)
  ? (JSON.parse(readFileSync(GISTS_PATH, 'utf8')) as GistEntry[])
  : []
const byId = new Map(existing.map((e) => [e.id, e]))

const todo = patterns.filter((p) => !byId.get(p.id)?.reviewed)
const skipped = patterns.length - todo.length
if (skipped > 0) console.log(`skipping ${skipped} reviewed gists (never overwritten)`)
if (todo.length === 0) {
  console.log('nothing to draft')
  process.exit(0)
}

const client = new Anthropic()

const SYSTEM = `You write one-line gists for the 253 patterns in Christopher \
Alexander's "A Pattern Language" (1977), for an atlas that maps the patterns \
as a graph. Each gist states, in your own words, the tension the pattern \
addresses and the move it makes.

Hard rules:
- ORIGINAL PROSE ONLY. Paraphrase from your general knowledge of the pattern's \
idea. Never quote, closely paraphrase, or imitate the book's sentences.
- At most 140 characters per gist. Aim for 80-130.
- Plain declarative prose. No headers, no "Pattern:", no ending ellipsis.
- Two beats where possible: the human problem, then the spatial move. \
Example shape (for Window Place): "People drift to windows, then find no \
reason to stay. Make the window itself a place to inhabit."`

const GIST_SCHEMA = {
  type: 'object',
  properties: {
    gists: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'integer' },
          gist: { type: 'string' },
        },
        required: ['id', 'gist'],
        additionalProperties: false,
      },
    },
  },
  required: ['gists'],
  additionalProperties: false,
} as const

async function draftBatch(
  batch: { id: number; name: string; section: string; subsection: string }[],
): Promise<Map<number, string>> {
  const listing = batch
    .map((p) => `${p.id}. ${p.name} (${p.section.toLowerCase()} / ${p.subsection})`)
    .join('\n')
  const response = await client.messages.create({
    model: 'claude-opus-4-8',
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: SYSTEM,
    output_config: { format: { type: 'json_schema', schema: GIST_SCHEMA } },
    messages: [
      {
        role: 'user',
        content: `Write a gist for each of these patterns:\n\n${listing}`,
      },
    ],
  })
  const text = response.content.find((b) => b.type === 'text')
  if (!text || text.type !== 'text') throw new Error('no text block in response')
  const parsed = JSON.parse(text.text) as { gists: { id: number; gist: string }[] }
  return new Map(parsed.gists.map((g) => [g.id, g.gist.trim()]))
}

const BATCH_SIZE = 25
const drafts = new Map<number, string>()
for (let i = 0; i < todo.length; i += BATCH_SIZE) {
  const batch = todo.slice(i, i + BATCH_SIZE)
  const result = await draftBatch(batch)
  for (const p of batch) {
    const gist = result.get(p.id)
    if (!gist) throw new Error(`no gist returned for ${p.id}`)
    drafts.set(p.id, gist)
  }
  console.log(`drafted ${Math.min(i + BATCH_SIZE, todo.length)}/${todo.length}`)
}

// Length guard: one retry pass for over-length gists, then truncate at a word.
const over = todo.filter((p) => drafts.get(p.id)!.length > 140)
if (over.length > 0) {
  console.log(`${over.length} gists over 140 chars — retrying`)
  const retried = await draftBatch(over)
  for (const p of over) {
    let gist = retried.get(p.id) ?? drafts.get(p.id)!
    if (gist.length > 140) {
      gist = gist.slice(0, 140).replace(/\s+\S*$/, '')
      console.warn(`  ${p.id}: truncated`)
    }
    drafts.set(p.id, gist)
  }
}

const merged: GistEntry[] = patterns.map((p) => {
  const prior = byId.get(p.id)
  if (prior?.reviewed) return prior
  return { id: p.id, gist: drafts.get(p.id) ?? prior?.gist ?? '', reviewed: false }
})

writeFileSync(GISTS_PATH, JSON.stringify(merged, null, 2) + '\n')
console.log(`wrote ${GISTS_PATH}: ${drafts.size} drafts, ${skipped} reviewed preserved`)

// Convenience: print the hash a reviewer needs when flipping reviewed: true.
console.log(
  'review workflow: read each gist; if approved, set reviewed: true and reviewedHash to',
  'sha256(gist) — e.g. node -e \'console.log(require("crypto").createHash("sha256").update(process.argv[1]).digest("hex"))\' "<gist>"',
)
