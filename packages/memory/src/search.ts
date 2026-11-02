import { MemoryFiles } from "./storage/store"
import { MemorySchema } from "./schema"
import { MemoryTopics } from "./recall/topics"

/** Full-text search over everything learned: typed facts and session digests, ranked by a pure
 * BM25-style scorer with the package's suffix-tolerant term matching. Lexical by design in this
 * v1; an embedding backend can slot in behind `rank` later without changing callers. */
export type Doc = {
  id: string
  source: string
  section?: string
  key?: string
  text: string
  updatedAt?: number
}

export type Hit = { doc: Doc; score: number }

const K1 = 1.2
const B = 0.75

function matches(term: string, token: string) {
  return term === token || MemoryTopics.related(term, token)
}

function found(term: string, tokens: string[]) {
  return tokens.some((token) => matches(term, token))
}

export function rank(input: { docs: Doc[]; query: string; limit?: number }): Hit[] {
  const limit = Math.max(1, input.limit ?? 10)
  const terms = [...new Set(MemoryTopics.words(input.query))]
  if (terms.length === 0 || input.docs.length === 0) return []
  const bodies = input.docs.map((doc) => ({
    doc,
    body: MemoryTopics.words(doc.text),
    keys: MemoryTopics.words(doc.key ?? ""),
  }))
  const average = bodies.reduce((sum, item) => sum + item.body.length, 0) / bodies.length || 1
  const frequency = new Map(
    terms.map((term) => [term, bodies.filter((item) => found(term, item.body) || found(term, item.keys)).length]),
  )
  const scored = bodies.map((item) => {
    const score = terms.reduce((sum, term) => {
      const count = item.body.filter((token) => matches(term, token)).length
      const keyed = found(term, item.keys)
      if (count === 0 && !keyed) return sum
      const df = frequency.get(term) ?? 0
      const idf = Math.log(1 + (bodies.length - df + 0.5) / (df + 0.5))
      const freq = count + (keyed ? 1 : 0)
      const norm = (freq * (K1 + 1)) / (freq + K1 * (1 - B + (B * item.body.length) / average))
      // A key hit is a deliberate name match, worth more than a passing mention in the body.
      return sum + idf * norm * (keyed ? 1.25 : 1)
    }, 0)
    return { doc: item.doc, score }
  })
  return scored
    .filter((hit) => hit.score > 0)
    .sort(
      (a, b) =>
        b.score - a.score || (b.doc.updatedAt ?? 0) - (a.doc.updatedAt ?? 0) || a.doc.id.localeCompare(b.doc.id),
    )
    .slice(0, limit)
}

export async function search(input: { root: string; query: string; limit?: number }) {
  const state = await MemoryFiles.readState(input.root)
  if (!state.enabled) return { enabled: false as const, hits: [] as Hit[] }
  const inventory = await MemoryFiles.deriveInventory(input.root)
  const facts = Object.entries(inventory.items).map(([id, item]) => ({
    id,
    source: item.file,
    section: item.section,
    key: item.key,
    text: item.text,
    updatedAt: item.updatedAt,
  }))
  const digests = await MemoryFiles.recentSessions(
    input.root,
    state.limits.maxSessionFiles,
    MemorySchema.maxStoredDigestSummary,
  )
  const sessions = digests.map((item) => ({
    id: `session:${item.id}`,
    source: "sessions",
    section: item.topic,
    key: item.id,
    text: item.summary,
    updatedAt: Date.parse(item.time) || undefined,
  }))
  return {
    enabled: true as const,
    hits: rank({ docs: [...facts, ...sessions], query: input.query, limit: input.limit }),
  }
}

export * as MemorySearch from "./search"
