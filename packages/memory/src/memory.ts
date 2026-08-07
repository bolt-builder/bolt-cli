import { MemoryConflicts } from "./conflicts"
import { MemoryFiles } from "./storage/store"
import { MemoryIndexer } from "./recall/indexer"
import { MemoryNegative } from "./negative"
import { MemoryNotice } from "./memory-notice"
import { MemoryOperations } from "./capture/operations"
import { MemoryOrigins } from "./storage/origins"
import { MemoryPaths } from "./storage/paths"
import { MemoryPortable } from "./portable"
import { MemoryRecall } from "./recall/recall"
import { MemorySchema } from "./schema"
import { MemoryScopes } from "./scopes"
import { MemoryShared } from "./recall/shared"
import { MemoryStaging } from "./staging"
import { MemoryToken } from "./recall/token"
import { MemorySlug } from "./slug"
import { MemoryRedact } from "./capture/redact"

/** Root-bound package facade. External Bolt surfaces should derive root from workspace context first. */
export namespace Memory {
  export type Block = {
    scope: "project"
    text: string
    bytes: number
    estimatedTokens: number
    truncated: boolean
  }

  export type Trigger = "explicit" | "turn-close" | "rebuild"

  export type Apply = {
    root: string
    state: MemorySchema.State
    result: MemoryOperations.Result
    ok: boolean
    staged?: number
    detail?: {
      type: "saved"
      message: string
      operationCount: number
      added: number
      removed: number
      sources: string[]
      files: string[]
    }
  }

  export function key(text: string) {
    const slug = MemorySlug.safe(text, { max: MemorySlug.max.record, fallback: "", lower: true })
      .split("_")
      .filter(Boolean)
      .slice(0, MemorySlug.max.parts)
      .join("_")
    return slug || MemorySlug.hash(text, "memory")
  }

  async function injected(input: { root: string; index: MemoryIndexer.Result; sessionID?: string }) {
    return MemoryFiles.queue(input.root, async () => {
      const state = await MemoryFiles.readState(input.root)
      const next = {
        ...state,
        stats: {
          ...state.stats,
          lastInjectedAt: Date.now(),
          lastInjectedBytes: input.index.bytes,
          lastInjectedTokens: input.index.tokens,
          lastInjectedSessionID: input.sessionID ?? null,
        },
      }
      await MemoryFiles.writeState(input.root, next)
      return next
    })
  }

  export async function status(input: { root: string }) {
    const state = await MemoryFiles.readState(input.root)
    const paths = MemoryPaths.files(input.root)
    const index = await MemoryFiles.readIndex(input.root)
    return {
      root: input.root,
      state,
      exists: {
        state: await MemoryFiles.exists(paths.state),
        index: await MemoryFiles.exists(paths.index),
      },
      index: {
        bytes: Buffer.byteLength(index),
        estimatedTokens: MemoryToken.estimate(index),
        preview: index,
      },
    }
  }

  export async function enable(input: { root: string; id?: MemoryPaths.Identity }) {
    return MemoryFiles.queue(input.root, async () => {
      const state = await MemoryFiles.scaffold(input.root, input.id)
      const index = await MemoryIndexer.rebuild({ root: input.root, state })
      return { root: input.root, state, index }
    })
  }

  export async function disable(input: { root: string }) {
    return MemoryFiles.queue(input.root, async () => {
      const state = await MemoryFiles.readState(input.root)
      const next = { ...state, enabled: false }
      await MemoryFiles.writeState(input.root, next)
      await MemoryFiles.append(input.root, `disable ${next.scope} source=command`)
      return { root: input.root, state: next }
    })
  }

  export async function show(input: { root: string }) {
    return MemoryFiles.show(input.root)
  }

  export async function rebuild(input: { root: string }) {
    const state = await MemoryFiles.readState(input.root)
    const index = await MemoryIndexer.rebuild({ root: input.root, state })
    return { root: input.root, state, index }
  }

  export async function configure(input: {
    root: string
    settings: Partial<Pick<MemorySchema.State, "autoConsolidate" | "verbose">>
  }) {
    return MemoryFiles.queue(input.root, async () => {
      const state = await MemoryFiles.readState(input.root)
      const next = {
        ...state,
        ...(input.settings.autoConsolidate === undefined ? {} : { autoConsolidate: input.settings.autoConsolidate }),
        ...(input.settings.verbose === undefined ? {} : { verbose: input.settings.verbose }),
      }
      await MemoryFiles.writeState(input.root, next)
      await MemoryFiles.append(
        input.root,
        [
          `settings ${next.scope}`,
          input.settings.autoConsolidate === undefined ? "" : `autoConsolidate=${next.autoConsolidate}`,
          input.settings.verbose === undefined ? "" : `verbose=${next.verbose}`,
        ]
          .filter(Boolean)
          .join(" "),
      )
      return { root: input.root, state: next }
    })
  }

  export async function context(input: { root: string; sessionID?: string; record?: boolean }) {
    const state = await MemoryFiles.readState(input.root)
    const record = input.record ?? true
    if (!state.enabled) {
      return {
        root: input.root,
        state,
        recorded: false,
        blocks: [] as Block[],
        meta: { enabled: state.enabled, estimatedTokens: 0, bytes: 0, truncated: false },
      }
    }

    const paths = MemoryPaths.files(input.root)
    const prior = (await MemoryFiles.exists(paths.index)) ? await MemoryFiles.readIndex(input.root) : undefined
    const expired = prior ? await MemoryFiles.indexExpired(input.root) : true
    const index =
      prior && !MemoryIndexer.stale(prior) && !expired && MemoryIndexer.fresh(prior, state.limits)
        ? prior
        : (await rebuild(input)).index.text
    const capped = MemoryIndexer.cap(index, state.limits.maxProjectIndexBytes)
    const blocks = capped.text.trim()
      ? [
          {
            scope: state.scope,
            text: capped.text,
            bytes: capped.bytes,
            estimatedTokens: capped.tokens,
            truncated: capped.truncated,
          },
        ]
      : []
    const meta = {
      enabled: true,
      estimatedTokens: capped.tokens,
      bytes: capped.bytes,
      truncated: capped.truncated,
    }
    if (!record) return { root: input.root, state, index: capped, recorded: false, blocks, meta }
    const next = await injected({ root: input.root, index: capped, sessionID: input.sessionID })
    return {
      root: input.root,
      state: next,
      index: capped,
      recorded: true,
      blocks,
      meta: blocks.length ? meta : { enabled: true, estimatedTokens: 0, bytes: 0, truncated: false },
    }
  }

  export async function toolEnabled(input: { root: string }) {
    const state = await MemoryFiles.readState(input.root)
    return state.enabled
  }

  export async function apply(input: {
    root: string
    ops: MemoryOperations.Op[]
    trigger?: Trigger
    sessionID?: string
    messageID?: string
    tokens?: number
  }): Promise<Apply> {
    const trigger = input.trigger ?? "explicit"
    const inputOps = trigger === "explicit" ? input.ops : input.ops.filter((item) => item.action !== "remove")
    // Review mode stages auto-captured writes for a human diff; explicit saves are deliberate and land directly.
    if (trigger !== "explicit" && inputOps.length > 0 && (await MemoryStaging.enabled(input.root))) {
      const staged = await MemoryStaging.stage(input.root, {
        ops: inputOps,
        sessionID: input.sessionID,
        now: Date.now(),
      })
      const state = await MemoryFiles.readState(input.root)
      const index = await MemoryFiles.readIndex(input.root)
      return {
        root: input.root,
        state,
        result: {
          operationCount: 0,
          added: 0,
          removed: 0,
          ids: [],
          skipped: [],
          // Staged writes land no facts yet, so there are no inventory ids to attribute.
          ids: [],
          index: {
            text: index,
            bytes: Buffer.byteLength(index),
            tokens: MemoryToken.estimate(index),
            truncated: false,
          },
        },
        ok: false,
        staged: staged.count,
      }
    }
    const accepted = inputOps.filter((item) => item.action !== "add" || !MemoryOperations.secret(item))
    const result = await MemoryOperations.apply({ root: input.root, ops: inputOps })
    // Every written fact links back to the session and message that taught it.
    await MemoryOrigins.record(input.root, {
      ids: result.ids,
      sessionID: input.sessionID,
      messageID: input.messageID,
      at: Date.now(),
    })
    // Auto-capture skips a secret-like op and applies the rest. An explicit save whose only effect
    // was rejecting secret content must fail loudly rather than silently drop it; a mixed explicit
    // batch that still applied something keeps the skip as a record.
    if (
      trigger === "explicit" &&
      result.operationCount === 0 &&
      result.skipped.some((item) => item.reason === "secret")
    ) {
      throw new Error("memory operation rejected secret-like content")
    }
    const state = await MemoryFiles.readState(input.root)
    const ok = MemoryNotice.saved({ added: result.added, removed: result.removed })
    if (trigger === "explicit") {
      await MemoryFiles.decide(input.root, {
        kind: "typed",
        trigger,
        sessionID: input.sessionID,
        result: ok ? "saved" : "skipped",
        llm: false,
        parsed: true,
        fallback: false,
        tokens: input.tokens ?? 0,
        operationCount: result.operationCount,
        skippedCount: result.skipped.length || (ok ? 0 : 1),
        skipped: MemoryNotice.skip(result.skipped),
        operations: MemoryNotice.ops({ ops: accepted, skipped: result.skipped }),
        files: MemoryShared.files(accepted),
        summary: MemoryNotice.summary({ added: result.added, removed: result.removed, count: result.operationCount }),
      })
    }
    return {
      root: input.root,
      state,
      result,
      ok,
      ...(ok
        ? {
            detail: {
              type: "saved" as const,
              message: MemoryNotice.message({
                ops: accepted,
                added: result.added,
                removed: result.removed,
                count: result.operationCount,
              }),
              operationCount: result.operationCount,
              added: result.added,
              removed: result.removed,
              sources: MemoryShared.refs(accepted),
              files: MemoryShared.files(accepted),
            },
          }
        : {}),
    }
  }

  export async function forget(input: { root: string; query: string; sessionID?: string; messageID?: string }) {
    return apply({ ...input, ops: [{ action: "remove", query: input.query }] })
  }

  export async function remember(input: {
    root: string
    text: string
    key?: string
    file?: MemorySchema.Source
    section?: string
    scope?: string
    sessionID?: string
    messageID?: string
  }) {
    // A monorepo scope wins over an explicit section: scoped facts must live in their scope section.
    const scoped = input.scope ? MemoryScopes.clean(input.scope) : ""
    return apply({
      ...input,
      ops: [
        {
          action: "add",
          file: input.file,
          section: scoped ? MemoryScopes.section(scoped) : input.section,
          key: input.key ?? key(input.text),
          text: input.text,
        },
      ],
    })
  }

  export function correct(input: { root: string; text: string; key?: string; sessionID?: string; messageID?: string }) {
    return remember({
      ...input,
      file: "corrections.md",
      section: "Corrections",
    })
  }

  export async function dump(input: { root: string }) {
    const sources: Partial<Record<MemorySchema.Source, string>> = {}
    for (const file of MemorySchema.Sources) {
      sources[file] = await MemoryFiles.readSource(input.root, file)
    }
    const output = MemoryPortable.serialize({ sources })
    return { root: input.root, text: output.text, count: output.count }
  }

  export async function load(input: { root: string; text: string; sessionID?: string }) {
    const parsed = MemoryPortable.parse(input.text)
    if (parsed.ops.length === 0) return { root: input.root, ops: 0, applied: 0, added: 0, skipped: parsed.skipped }
    const state = await MemoryFiles.readState(input.root)
    const size = Math.max(1, state.capture.maxOpsPerRun)
    const chunks = Array.from({ length: Math.ceil(parsed.ops.length / size) }, (item, at) =>
      parsed.ops.slice(at * size, at * size + size),
    )
    const results: Apply[] = []
    for (const chunk of chunks) {
      results.push(await apply({ root: input.root, ops: chunk, sessionID: input.sessionID }))
    }
    return {
      root: input.root,
      ops: parsed.ops.length,
      applied: results.reduce((sum, item) => sum + item.result.operationCount, 0),
      added: results.reduce((sum, item) => sum + item.result.added, 0),
      skipped: parsed.skipped,
    }
  }

  export async function avoid(input: {
    root: string
    text: string
    outcome?: string
    key?: string
    sessionID?: string
  }) {
    return remember({
      root: input.root,
      key: input.key,
      sessionID: input.sessionID,
      text: MemoryNegative.text({ approach: input.text, outcome: input.outcome }),
      file: "project.md",
      section: MemoryNegative.SECTION,
    })
  }

  export async function origins(input: { root: string }) {
    const ledger = await MemoryOrigins.read(input.root)
    return { root: input.root, items: ledger.items }
  }

  export async function pending(input: { root: string }) {
    const store = await MemoryStaging.read(input.root)
    const inventory = await MemoryFiles.deriveInventory(input.root)
    return {
      root: input.root,
      review: store.review,
      items: store.items,
      diff: MemoryStaging.render({ items: store.items, inventory }),
    }
  }

  export async function review(input: { root: string; review: boolean }) {
    const store = await MemoryStaging.configure(input.root, { review: input.review })
    return { root: input.root, review: store.review, staged: store.items.length }
  }

  export async function approve(input: { root: string; sessionID?: string }) {
    const store = await MemoryStaging.read(input.root)
    if (store.items.length === 0) return { root: input.root, applied: 0, added: 0, removed: 0 }
    const state = await MemoryFiles.readState(input.root)
    const size = Math.max(1, state.capture.maxOpsPerRun)
    const ops = store.items.map((item) => item.op)
    const chunks = Array.from({ length: Math.ceil(ops.length / size) }, (item, at) =>
      ops.slice(at * size, at * size + size),
    )
    const results: Apply[] = []
    for (const chunk of chunks) {
      results.push(await apply({ root: input.root, ops: chunk, sessionID: input.sessionID }))
    }
    await MemoryStaging.clear(input.root)
    return {
      root: input.root,
      applied: ops.length,
      added: results.reduce((sum, item) => sum + item.result.added, 0),
      removed: results.reduce((sum, item) => sum + item.result.removed, 0),
    }
  }

  export async function discard(input: { root: string }) {
    const discarded = await MemoryStaging.clear(input.root)
    return { root: input.root, discarded }
  }

  export async function conflicts(input: { root: string; fix?: boolean; sessionID?: string }) {
    const state = await MemoryFiles.readState(input.root)
    const inventory = await MemoryFiles.deriveInventory(input.root)
    const found = MemoryConflicts.detect(
      Object.entries(inventory.items).map(([id, item]) => ({
        id,
        file: item.file,
        section: item.section,
        key: item.key,
        text: item.text,
        updatedAt: item.updatedAt,
      })),
    )
    const plan = MemoryConflicts.resolve(found)
    if (!input.fix || plan.resolutions.length === 0) {
      return { root: input.root, state, conflicts: found, plan, applied: false as const }
    }
    // Cap at the per-run op limit apply enforces; a rerun picks up any remainder.
    const result = await apply({
      root: input.root,
      ops: plan.resolutions.slice(0, state.capture.maxOpsPerRun).map((item) => item.op),
      sessionID: input.sessionID,
    })
    return { root: input.root, state, conflicts: found, plan, applied: true as const, result }
  }

  export async function purge(input: { root: string }) {
    if (!(await MemoryFiles.owned(input.root))) {
      const exists = await MemoryFiles.exists(input.root)
      if (!exists) return { root: input.root, purged: false, state: MemorySchema.missing() }
      throw new Error(`refusing to purge unowned memory root: ${input.root}`)
    }
    return MemoryFiles.queue(input.root, async () => {
      const purged = await MemoryFiles.purge(input.root)
      return { root: input.root, purged, state: MemorySchema.missing() }
    })
  }

  export async function recall(input: {
    root: string
    query: string
    sessionID?: string
    worktree?: string
    scope?: string
  }) {
    const state = await MemoryFiles.readState(input.root)
    if (!state.enabled) return { root: input.root, state }
    const result = await MemoryRecall.search({
      root: input.root,
      query: input.query,
      state,
      currentSessionID: input.sessionID,
      worktree: input.worktree,
      scope: input.scope,
    })
    const hits = result?.hits ?? []
    const files = [...new Set(hits.map((hit) => hit.source))]
    const topics = [...new Set(hits.flatMap((hit) => (hit.topics?.length ? hit.topics : [hit.kind])))]
    await MemoryFiles.decide(input.root, {
      kind: "recall",
      trigger: "targeted-recall",
      sessionID: input.sessionID,
      result: result ? "recalled" : "skipped",
      llm: false,
      parsed: false,
      fallback: false,
      reason: result ? undefined : "no_matches",
      query: MemoryShared.brief(MemoryRedact.text(input.query), 240),
      topics,
      files,
      tokens: result?.tokens ?? 0,
      operationCount: hits.length,
      skippedCount: result ? 0 : 1,
      summary: result ? `targeted recall matched ${hits.length} memories` : "targeted recall found no matches",
    })
    if (result) {
      await MemoryFiles.queue(input.root, async () => {
        await MemoryFiles.append(
          input.root,
          `recall session=${input.sessionID ?? ""} hits=${result.hits.length} tokens=${result.tokens} files=${files.join(",")}`,
        )
      })
    }
    return { root: input.root, state, result, hits, files, topics }
  }

  export async function recordSession(input: {
    root: string
    sessionID: string
    topic?: string
    summary: string
    time?: number
    tokens?: number
    fallback?: boolean
  }) {
    return MemoryFiles.queue(input.root, async () => {
      const state = await MemoryFiles.readState(input.root)
      if (!state.enabled) return { root: input.root, state, skipped: true, reason: "memory_disabled" as const }
      await MemoryFiles.writeSession(input.root, {
        sessionID: input.sessionID,
        topic: input.topic,
        summary: input.summary,
        max: MemorySchema.maxStoredDigestSummary,
        time: input.time,
        fallback: input.fallback,
      })
      await MemoryFiles.pruneSessions(input.root, state.limits.maxSessionFiles)
      const index = await MemoryIndexer.rebuild({ root: input.root, state })
      await MemoryFiles.append(
        input.root,
        `session digest session=${input.sessionID} tokens=${input.tokens ?? 0} indexTokens=${index.tokens}`,
      )
      return { root: input.root, state, skipped: false as const, index }
    })
  }
}
