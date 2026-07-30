import { Context, Effect, Layer, Semaphore } from "effect"
import { skipLine, type CaptureSkip } from "../capture/capture"
import type { Memory } from "../memory"
import type { MemoryOperations } from "../capture/operations"
import { MemoryRecall } from "../recall/recall"
import { MemorySchema } from "../schema"
import { MemoryFiles } from "../storage/store"
import { MemoryToken } from "../recall/token"
import { BoltMemory } from "./index"
import { MemoryEvents } from "./events"
import { MemoryInstance } from "./instance"
import { MemoryError, type MemoryError as Failure } from "./errors"

type SessionID = string

const IDLE_SETTLE_MS = 30_000

type ConfigureInput = BoltMemory.Input & {
  settings: Partial<Pick<MemorySchema.State, "autoConsolidate" | "verbose">>
}

type ApplyInput = BoltMemory.Input & {
  ops: MemoryOperations.Op[]
  trigger?: Memory.Trigger
  cost?: number
  tokens?: number
}

type RememberInput = BoltMemory.Input & {
  text: string
  key?: string
  file?: MemorySchema.Source
  section?: string
}

type CorrectInput = BoltMemory.Input & {
  text: string
  key?: string
}

type ForgetInput = BoltMemory.Input & {
  query: string
}

type RecallInput = BoltMemory.Input & {
  query: string
  sessionID?: string
}

type SearchInput = Parameters<typeof MemoryRecall.search>[0]

type RecordInput = BoltMemory.Input & {
  sessionID: string
  topic?: string
  summary: string
  time?: number
  tokens?: number
  fallback?: boolean
}

type DecideInput = {
  root: string
  decision: MemoryFiles.Decision
}

type ReadSourceInput = {
  root: string
  file: MemorySchema.Source
}

type RootInput = {
  root: string
}

type SessionInput = RootInput & {
  sessionID: string
  max: number
}

type RecentInput = RootInput & {
  limit: number
  max: number
}

type AppendInput = RootInput & {
  text: string
}

type Sources = Record<MemorySchema.Source, string>

type Index = {
  bytes: number
  tokens: number
  truncated: false
}

type CommitInput = RootInput & {
  now: number
  messageID: string
  tokens: number
  count: number
  digest: boolean
  // Whether a typed consolidation was actually attempted this commit. Only a typed attempt advances the
  // shared typed-interval clock (lastTypedConsolidationAt); a digest-only commit must leave it untouched so a
  // digest in one session cannot throttle another session's typed capture.
  typed: boolean
  skipped: CaptureSkip[]
  cost?: number
}

type RecordRecallInput = RootInput & {
  now: number
  sessionID: string
  count: number
}

function bridge<A>(fn: () => Promise<A>) {
  return Effect.tryPromise({
    try: MemoryInstance.bind(fn),
    catch: MemoryError.from,
  })
}

export namespace MemoryService {
  export type Timing = { settleMs: number }

  export interface Interface {
    readonly prepare: (input: BoltMemory.Input) => Effect.Effect<string, Failure>
    readonly status: (input: BoltMemory.Input) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.status>>, Failure>
    readonly show: (input: BoltMemory.Input) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.show>>, Failure>
    readonly enable: (input: BoltMemory.Input) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.enable>>, Failure>
    readonly disable: (
      input: BoltMemory.Input,
    ) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.disable>>, Failure>
    readonly rebuild: (
      input: BoltMemory.Input,
    ) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.rebuild>>, Failure>
    readonly configure: (
      input: ConfigureInput,
    ) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.configure>>, Failure>
    readonly apply: (input: ApplyInput) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.apply>>, Failure>
    readonly remember: (input: RememberInput) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.remember>>, Failure>
    readonly correct: (input: CorrectInput) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.correct>>, Failure>
    readonly forget: (input: ForgetInput) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.forget>>, Failure>
    readonly purge: (input: BoltMemory.Input) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.purge>>, Failure>
    readonly recall: (input: RecallInput) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.recall>>, Failure>
    readonly search: (input: SearchInput) => Effect.Effect<Awaited<ReturnType<typeof MemoryRecall.search>>, Failure>
    readonly recordSession: (
      input: RecordInput,
    ) => Effect.Effect<Awaited<ReturnType<typeof BoltMemory.recordSession>>, Failure>
    readonly state: (input: RootInput) => Effect.Effect<MemorySchema.State, Failure>
    readonly session: (
      input: SessionInput,
    ) => Effect.Effect<Awaited<ReturnType<typeof MemoryFiles.readSession>>, Failure>
    readonly sources: (input: RootInput) => Effect.Effect<Sources, Failure>
    readonly recent: (
      input: RecentInput,
    ) => Effect.Effect<Awaited<ReturnType<typeof MemoryFiles.recentSessions>>, Failure>
    readonly append: (input: AppendInput) => Effect.Effect<void, Failure>
    readonly index: (input: RootInput) => Effect.Effect<Index, Failure>
    readonly commit: (input: CommitInput) => Effect.Effect<void, Failure>
    readonly recordRecall: (input: RecordRecallInput) => Effect.Effect<void, Failure>
    readonly decide: (input: DecideInput) => Effect.Effect<void, Failure>
    readonly readSource: (input: ReadSourceInput) => Effect.Effect<string, Failure>
    readonly turnLock: (sessionID: SessionID) => Semaphore.Semaphore
    readonly dropLock: (sessionID: SessionID) => void
    readonly idleSettle: () => number
    readonly setIdleSettle: (ms: number) => Timing
  }

  export class Service extends Context.Service<Service, Interface>()("@opencode-ai/MemoryService") {}

  export function make() {
    const locks = new Map<SessionID, { sema: Semaphore.Semaphore; holders: number }>()
    let settle = IDLE_SETTLE_MS
    return Service.of({
      prepare: (input) => bridge(() => BoltMemory.prepare(input)),
      status: (input) => bridge(() => BoltMemory.status(input)),
      show: (input) => bridge(() => BoltMemory.show(input)),
      enable: (input) => bridge(() => BoltMemory.enable(input)),
      disable: (input) => bridge(() => BoltMemory.disable(input)),
      rebuild: (input) => bridge(() => BoltMemory.rebuild(input)),
      configure: (input) => bridge(() => BoltMemory.configure(input)),
      apply: (input) => bridge(() => BoltMemory.apply(input)),
      remember: (input) => bridge(() => BoltMemory.remember(input)),
      correct: (input) => bridge(() => BoltMemory.correct(input)),
      forget: (input) => bridge(() => BoltMemory.forget(input)),
      purge: (input) => bridge(() => BoltMemory.purge(input)),
      recall: (input) => bridge(() => BoltMemory.recall(input)),
      search: (input) => bridge(() => MemoryRecall.search(input)),
      recordSession: (input) => bridge(() => BoltMemory.recordSession(input)),
      state: (input) => bridge(() => MemoryFiles.readState(input.root)),
      session: (input) =>
        bridge(() => MemoryFiles.readSession(input.root, { sessionID: input.sessionID, max: input.max })),
      sources: (input) =>
        bridge(async () => {
          const entries = await Promise.all(
            MemorySchema.Sources.map(async (file) => [file, await MemoryFiles.readSource(input.root, file)] as const),
          )
          return Object.fromEntries(entries) as Sources
        }),
      recent: (input) => bridge(() => MemoryFiles.recentSessions(input.root, input.limit, input.max)),
      append: (input) => bridge(() => MemoryFiles.append(input.root, input.text)),
      index: (input) =>
        bridge(async () => {
          const text = await MemoryFiles.readIndex(input.root)
          return { bytes: Buffer.byteLength(text), tokens: MemoryToken.estimate(text), truncated: false }
        }),
      commit: (input) =>
        bridge(() =>
          MemoryFiles.queue(input.root, async () => {
            const state = await MemoryFiles.readState(input.root)
            await MemoryFiles.writeState(input.root, {
              ...state,
              stats: {
                ...state.stats,
                // Digest-only commits leave the typed-interval clock where it was.
                lastTypedConsolidationAt: input.typed ? input.now : state.stats.lastTypedConsolidationAt,
                lastSessionSavedAt: input.digest ? input.now : state.stats.lastSessionSavedAt,
                lastConsolidatedMessageID: input.messageID,
                lastConsolidationCost: input.cost ?? state.stats.lastConsolidationCost,
                lastConsolidationTokens: input.tokens,
                lastOperationCount: input.count,
              },
            })
            const skip = skipLine(input.skipped)
            await MemoryFiles.append(
              input.root,
              [
                `consolidate trigger=turn-close digest=${input.digest ? 1 : 0} ops=${input.count} tokens=${input.tokens}`,
                skip,
              ]
                .filter(Boolean)
                .join(" "),
            )
          }),
        ),
      recordRecall: (input) =>
        bridge(async () => {
          const saved = await MemoryFiles.queue(input.root, async () => {
            const state = await MemoryFiles.readState(input.root)
            const next = {
              ...state,
              stats: {
                ...state.stats,
                lastRecallAt: input.now,
                lastRecallCount: input.count,
                lastRecallSessionID: input.sessionID,
              },
            }
            await MemoryFiles.writeState(input.root, next)
            return next
          })
          await MemoryEvents.publish({
            event: "status",
            payload: MemoryEvents.status({
              root: input.root,
              state: saved,
              phase: "injecting",
              sessionID: input.sessionID,
              detail: {
                type: "recalled",
                message: `Memory recalled · ${input.count} ${input.count === 1 ? "item" : "items"}`,
                operationCount: input.count,
              },
            }),
          })
        }),
      decide: (input) => bridge(() => MemoryFiles.decide(input.root, input.decision)),
      readSource: (input) => bridge(() => MemoryFiles.readSource(input.root, input.file)),
      // Ref-counted so every acquirer — in-flight or queued behind `withPermits` — shares one
      // semaphore. Each call must be balanced by exactly one `dropLock`.
      turnLock: (sessionID) => {
        const prior = locks.get(sessionID)
        if (prior) {
          prior.holders += 1
          return prior.sema
        }
        const sema = Semaphore.makeUnsafe(1)
        locks.set(sessionID, { sema, holders: 1 })
        return sema
      },
      // Release one holder. The entry is dropped only when the last holder leaves, so a queued
      // close() can never be handed a different semaphore than the peer it is waiting on — while the
      // map still stops growing unbounded in a long-lived shared backend.
      dropLock: (sessionID) => {
        const item = locks.get(sessionID)
        if (!item) return
        item.holders -= 1
        if (item.holders <= 0) locks.delete(sessionID)
      },
      idleSettle: () => settle,
      setIdleSettle: (ms) => {
        const prev = { settleMs: settle }
        settle = Math.max(1, ms)
        return prev
      },
    })
  }

  export const layer = Layer.sync(Service)(make)
}
