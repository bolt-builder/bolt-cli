import { generateText, streamText } from "ai"
import { Effect } from "effect"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { MemoryConfig } from "@opencode-ai/memory/effect/config"
import { MemoryError } from "@opencode-ai/memory/effect/errors"
import type { MemoryPorts } from "@opencode-ai/memory/effect/ports"
import { MemoryPaths } from "@opencode-ai/memory/effect/paths"
import { MemoryService } from "@opencode-ai/memory/effect/service"
import { MemoryTurn } from "@opencode-ai/memory/effect/turn"
import { MemoryRedact } from "@opencode-ai/memory/redact"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { ModelV2 } from "@opencode-ai/core/model"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { Provider } from "@/provider/provider"
import { ProviderTransform } from "@/provider/transform"
import { InstanceState } from "@/effect/instance-state"
import { SessionID } from "@/session/schema"
import type { Session } from "@/session/session"
import type { SessionSummary } from "@/session/summary"
import type { Snapshot } from "@/snapshot"

// --- Transcript extraction (host message model -> port TurnView) ------------------------------

function brief(input: string, max: number) {
  const text = input.trim().replaceAll(/\s+/g, " ")
  if (text.length <= max) return text
  return `${text.slice(0, Math.max(0, max - 3))}...`
}

function text(parts: SessionV1.Part[]) {
  return parts
    .filter((part): part is SessionV1.TextPart => part.type === "text")
    .filter((part) => !part.synthetic && !part.ignored)
    .map((part) => MemoryRedact.text(part.text.trim()))
    .filter(Boolean)
    .join("\n\n")
}

function output(parts: SessionV1.Part[]) {
  return parts
    .flatMap((part) => {
      if (part.type === "text") return [MemoryRedact.text(part.text.trim())]
      if (part.type === "tool") return [toolSummary(part)]
      return []
    })
    .filter(Boolean)
    .join("\n")
}

function hidden(input: string) {
  const flat = input.trim().replaceAll(/\s+/g, " ")
  if (!flat) return ""
  if (MemoryRedact.has(flat)) return "[redacted]"
  return brief(flat, 220)
}

function field(input: Record<string, unknown>, key: string) {
  const value = input[key]
  return typeof value === "string" ? hidden(value) : ""
}

function exit(input: Record<string, unknown> | undefined) {
  const value = input?.exit
  if (typeof value !== "number" && typeof value !== "string") return ""
  return String(value)
}

function toolSummary(part: SessionV1.ToolPart) {
  const state = part.state
  const pieces = [`Tool ${part.tool} ${state.status}`]
  const command = field(state.input, "command")
  const file = field(state.input, "filePath")
  const pattern = field(state.input, "pattern")
  const query = field(state.input, "query")
  if (state.status === "completed" || state.status === "running") {
    const title = state.title ? hidden(state.title) : ""
    if (title) pieces.push(`title=${title}`)
  }
  if (command) pieces.push(`command=${command}`)
  if (file) pieces.push(`file=${file}`)
  if (pattern) pieces.push(`pattern=${pattern}`)
  if (query) pieces.push(`query=${query}`)
  if (state.status === "completed") {
    const code = exit(state.metadata)
    if (code) pieces.push(`exit=${code}`)
  }
  if (state.status === "error") {
    const error = hidden(state.error)
    if (error) pieces.push(`error=${error}`)
  }
  return pieces.join(" | ")
}

type UserTurn = SessionV1.WithParts & { info: SessionV1.User }
type AssistantTurn = SessionV1.WithParts & { info: SessionV1.Assistant }
type Turn = {
  user: UserTurn
  assistant: AssistantTurn
  assistants: AssistantTurn[]
}

function trace(messages: SessionV1.WithParts[], max: number) {
  return messages
    .flatMap((item) => {
      if (item.info.role === "user") {
        const body = text(item.parts)
        return body ? [`User: ${body}`] : []
      }
      if (item.info.role !== "assistant" || item.info.summary === true || item.info.error) return []
      const body = output(item.parts)
      return body ? [`Assistant: ${body}`] : []
    })
    .slice(-max)
    .join("\n\n")
}

function latest(messages: SessionV1.WithParts[]): Turn | undefined {
  const assistant = messages.findLast(
    (item): item is AssistantTurn =>
      item.info.role === "assistant" &&
      Boolean(item.info.finish) &&
      item.info.summary !== true &&
      !item.info.error &&
      Boolean(item.info.parentID),
  )
  if (!assistant) return
  const idx = messages.findIndex((item) => item.info.id === assistant.info.parentID)
  const user = idx >= 0 ? messages[idx] : undefined
  if (!user || user.info.role !== "user") return
  const assistants = messages
    .slice(idx + 1)
    .filter(
      (item): item is AssistantTurn =>
        item.info.role === "assistant" &&
        item.info.parentID === user.info.id &&
        item.info.summary !== true &&
        !item.info.error,
    )
  return { user: user as UserTurn, assistant, assistants }
}

/** True when the turn was answered from memory (targeted recall ran); digesting it would echo memory back into itself. */
function recalled(turn: Turn) {
  return [turn.user, ...turn.assistants]
    .flatMap((item) => item.parts)
    .some(
      (part) =>
        part.type === "tool" &&
        part.tool === "memory_recall" &&
        part.state.status === "completed" &&
        typeof part.state.metadata.count === "number" &&
        part.state.metadata.count > 0,
    )
}

// --- Model resolution + invocation (host provider/`ai` -> port ModelHandle) --------------------

function isOpenAI(model: Provider.Model) {
  return model.providerID === "openai" || model.api.npm === "@ai-sdk/openai"
}

function options(model: Provider.Model) {
  if (isOpenAI(model)) return { store: false }
  return ProviderTransform.smallOptions(model)
}

function params(input: { model: Provider.Model; options: Record<string, unknown>; system: string }) {
  const openai = isOpenAI(input.model)
  const merged = openai ? { ...input.options, instructions: input.system } : input.options
  return {
    providerOptions: ProviderTransform.providerOptions(input.model, merged),
    system: openai ? undefined : input.system,
  }
}

async function invoke(input: {
  source: Provider.Model
  language: LanguageModelV3
  options: Record<string, unknown>
  system: string
  prompt: string
  timeoutMs: number
  temperature?: number
  topP?: number
  topK?: number
  signal?: AbortSignal
}) {
  const ctl = new AbortController()
  const ms = Math.max(1, input.timeoutMs)
  const resolved = params({ model: input.source, options: input.options, system: input.system })
  const openai = isOpenAI(input.source)
  const common = {
    model: input.language,
    ...(resolved.system ? { system: resolved.system } : {}),
    prompt: input.prompt,
    providerOptions: resolved.providerOptions,
    abortSignal: input.signal ? AbortSignal.any([ctl.signal, input.signal]) : ctl.signal,
    temperature: input.temperature,
    topP: input.topP,
    topK: input.topK,
  }
  const work = async () => {
    if (!openai) return generateText(common)

    const result = streamText(common)
    const chunks: string[] = []
    let usage: unknown
    for await (const part of result.fullStream) {
      if (part.type === "text-delta" && part.text) chunks.push(part.text)
      if (part.type === "finish-step") usage = part.usage
      if (part.type === "finish") usage = part.totalUsage
      if (part.type === "error") throw part.error
    }
    return { text: chunks.join(""), usage }
  }
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeout = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      ctl.abort()
      reject(new Error("memory model timed out"))
    }, ms)
  })
  try {
    return await Promise.race([work(), timeout])
  } finally {
    if (timer) clearTimeout(timer)
    ctl.abort()
  }
}

function handle(model: Provider.Model, language: LanguageModelV3) {
  const opts = options(model)
  // No explicit output cap: valid output is already bounded by the compact-JSON prompt, the parser's
  // 64KB guard, and the capture timeout — and some backends reject explicit caps outright.
  const temperature = ProviderTransform.temperature(model)
  const topP = ProviderTransform.topP(model)
  const topK = ProviderTransform.topK(model)
  return { source: model, language, options: opts, temperature, topP, topK }
}

type ModelHandle = ReturnType<typeof handle>

// --- Ports -------------------------------------------------------------------------------------

/** Host SessionPort: extracts a TurnView from the session store + snapshot diffs so the package
 * orchestrator never touches the host message model. */
export function sessionPort(input: {
  sessions: Session.Interface
  summary: SessionSummary.Interface
}): MemoryPorts.SessionPort {
  return {
    readTurn: ({ sessionID, window }) =>
      Effect.gen(function* () {
        const messages = yield* input.sessions.messages({ sessionID: SessionID.make(sessionID), limit: window })
        const turn = latest(messages)
        if (!turn) return undefined
        const diffs = yield* input.summary
          .computeDiff({ messages: [turn.user, ...turn.assistants] })
          .pipe(
            Effect.catch((err) =>
              Effect.logWarning("memory turn diff unavailable", { error: String(err) }).pipe(
                Effect.as([] as Snapshot.FileDiff[]),
              ),
            ),
          )
        return {
          user: text(turn.user.parts),
          assistant: output(turn.assistant.parts),
          recent: trace(messages, 8),
          lastAssistantID: turn.assistant.info.id,
          sessionModel: {
            providerID: turn.user.info.model.providerID,
            modelID: turn.user.info.model.modelID,
          },
          recalledMemory: recalled(turn),
          diffs: [...diffs],
        }
      }).pipe(Effect.mapError(MemoryError.from)),
    get: ({ sessionID }) =>
      input.sessions.get(SessionID.make(sessionID)).pipe(
        Effect.map((info) => ({ parentID: info.parentID })),
        Effect.mapError(MemoryError.from),
      ),
  }
}

/** Host ModelPort: resolves the consolidation model through the provider service and runs it via
 * the `ai` SDK, exposing the resolved model to the package as an opaque handle. */
export function modelPort(input: { provider: Provider.Interface }): MemoryPorts.ModelPort {
  return {
    resolve: ({ configured, session }) =>
      Effect.gen(function* () {
        const parsed = MemoryConfig.parse(configured)
        const fallback = () =>
          input.provider.getModel(ProviderV2.ID.make(session.providerID), ModelV2.ID.make(session.modelID))
        const source = parsed
          ? yield* input.provider.getModel(ProviderV2.ID.make(parsed.providerID), ModelV2.ID.make(parsed.modelID)).pipe(
              Effect.map((model) => ({ model, reason: undefined as string | undefined })),
              Effect.catch(() => Effect.map(fallback(), (model) => ({ model, reason: "model unavailable" }))),
            )
          : { model: yield* fallback(), reason: configured ? "invalid model" : undefined }
        if (source.reason)
          yield* Effect.logWarning("memory model config ignored", { reason: source.reason, model: configured })
        const language = yield* input.provider.getLanguage(source.model)
        return {
          handle: handle(source.model, language),
          ...(source.reason ? { fallback: { reason: source.reason } } : {}),
        }
      }).pipe(Effect.mapError(MemoryError.from)),
    run: ({ handle: opaque, system, prompt, timeoutMs, signal }) => {
      const resolved = opaque as ModelHandle
      return invoke({
        source: resolved.source,
        language: resolved.language,
        options: resolved.options,
        system,
        prompt,
        timeoutMs,
        temperature: resolved.temperature,
        topP: resolved.topP,
        topK: resolved.topK,
        signal,
      })
    },
  }
}

// --- Turn lifecycle ------------------------------------------------------------------------------

export type Reason = MemoryTurn.Reason

const memory = MemoryService.make()

/** Cancel a pending idle flush when a new turn begins on the session. */
export function open(input: { sessionID: SessionID }) {
  MemoryTurn.open({ sessionID: input.sessionID })
}

/** Digest the finished turn into the memory store. Delegates locking and idle-flush scheduling to
 * the memory package; a disabled store makes this a cheap no-op. */
export const close = Effect.fn("MemoryHost.close")(function* (input: {
  sessionID: SessionID
  reason: Reason
  sessions: Session.Interface
  summary: SessionSummary.Interface
  provider: Provider.Interface
}) {
  const ctx = yield* InstanceState.context
  const root = MemoryPaths.root({ ctx })
  return yield* MemoryTurn.close({
    root,
    sessionID: input.sessionID,
    reason: input.reason,
    session: sessionPort({ sessions: input.sessions, summary: input.summary }),
    model: modelPort({ provider: input.provider }),
  }).pipe(Effect.provideService(MemoryService.Service, memory))
})

export * as MemoryHost from "./host"
