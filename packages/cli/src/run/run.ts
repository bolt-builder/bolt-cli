import { Service, type Endpoint } from "@opencode/client/effect/service"
import { OpenCode, type OpenCodeClient, type SessionMessageAssistantTool } from "@opencode/client/promise"
import { prepareFile, type FilePart } from "../services/attachment"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { open } from "node:fs/promises"
import path from "node:path"
import { readStdin } from "../util/io"
import { ServerConnection } from "../services/server-connection"
import { createWorktreeLocation, parseSessionTargetModel, resolveSessionTarget } from "../session-target"
import { toolInlineInfo } from "@opencode/tui/mini/tool"
import { runNonInteractivePrompt } from "./noninteractive"
import { UI } from "./ui"
import { Env } from "../env"
import { errorMessage } from "../util/error"
import { Envelope } from "../util/envelope"
import { Porcelain } from "../util/porcelain"
import { active, controlled, invalid, type Controls } from "./controls"
import { route, explain } from "./route"

export type RunCommandInput = Controls & {
  server: ServerConnection.Resolved
  message: string[]
  continue?: boolean
  session?: string
  fork?: boolean
  worktree?: string | true
  model?: string
  bestOf?: string
  judge?: string
  variant?: string
  agent?: string
  format: "default" | "json"
  file: string[]
  title?: string
  archived?: boolean
  thinking?: boolean
  auto?: boolean
}

type Prepared = {
  directory?: string
  message: string
  files: FilePart[]
  schema?: unknown
}

type ExecutionOptions = {
  root?: string
  directory?: string
  useServerDirectory?: boolean
  variant?: string
  attached?: boolean
  compatibility?: "v1"
}

class RunTargetError extends Error {
  constructor(
    message: string,
    readonly sessionID?: string,
  ) {
    super(message)
  }
}

export function runNonInteractive(input: RunCommandInput) {
  return runNonInteractiveWithOptions(input, {})
}

/** @internal Used only by the V1 command boundary. */
export function runNonInteractiveWithOptions(input: RunCommandInput, options: ExecutionOptions) {
  return run(input, options).catch((error) => reportRunError(input, errorMessage(error)))
}

async function run(input: RunCommandInput, options: ExecutionOptions) {
  const issue = invalid(input)
  if (issue) fail(issue)
  if (input.bestOf && (input.continue || input.session || input.fork || input.worktree !== undefined || input.model))
    fail(
      "--best-of starts independent sessions and cannot be combined with --continue, --session, --fork, --worktree or --model",
    )
  if (input.judge !== undefined && input.bestOf === undefined) fail("--judge requires --best-of")
  if (input.fork && !input.continue && !input.session) fail("--fork requires --continue or --session")
  if (input.worktree !== undefined && (input.continue || input.session))
    fail("--worktree starts a new session and cannot be combined with --continue or --session")
  const root = options.root ?? process.env.PWD ?? process.cwd()
  const local = localDirectory(root)
  const directory = options.useServerDirectory ? undefined : (options.directory ?? local)
  const message = mergeInput(formatMessage(input.message), process.stdin.isTTY ? undefined : await readStdin())
  if (!message?.trim()) fail("You must provide a message")
  const files = await Promise.all(input.file.map((file) => prepareFile(file, root, options)))
  const schema = input.outputSchema === undefined ? undefined : await readSchema(path.resolve(root, input.outputSchema))
  const prepared = { directory, message, files, schema }
  return execute(input, prepared, input.server.endpoint, options)
}

async function execute(input: RunCommandInput, prepared: Prepared, endpoint: Endpoint, options: ExecutionOptions) {
  const client = OpenCode.make({
    baseUrl: endpoint.url,
    headers: Service.headers(endpoint),
    // Bun's default five-minute deadline terminates the event stream used by long-running sessions.
    fetch: noTimeoutFetch,
  })
  if (input.bestOf !== undefined) {
    const { tournament } = await import("../services/tournament")
    const result = await tournament({
      client,
      models: input.bestOf,
      judge: input.judge,
      variant: input.variant,
      directory: prepared.directory ?? process.cwd(),
      message: prepared.message,
      files: prepared.files.map((file) => ({ uri: file.url, filename: file.filename, mime: file.mime })),
      agent: input.agent,
      auto: input.auto,
    })
    process.stdout.write(input.format === "json" ? JSON.stringify(result) + "\n" : (result.winner?.text ?? "") + "\n")
    if (!result.winner) process.exitCode ||= 1
    return
  }
  const explicit = parseRunModel(input.model)
  const location = prepared.directory ? { directory: prepared.directory } : undefined
  const worktree =
    input.worktree === undefined
      ? undefined
      : await createWorktreeLocation({
          client,
          location,
          name: input.worktree === true ? undefined : input.worktree,
        })
  if (worktree) UI.println(UI.Style.TEXT_DIM + "worktree " + worktree.root + UI.Style.TEXT_NORMAL)
  const target = await resolveSessionTarget({
    client,
    location: worktree ? { directory: worktree.directory } : location,
    continue: input.continue,
    session: input.session,
    fork: input.fork,
    model: explicit
      ? { providerID: explicit.model.providerID, id: explicit.model.modelID, variant: explicit.variant }
      : undefined,
    agent: input.agent,
    environment: input.server.service ? Env.session() : undefined,
    prepare: async (next) => {
      const selected =
        next.model ??
        ((input.variant ?? options.variant)
          ? await client.model
              .default({ location: { directory: next.location.directory } })
              .then((result) => result.data)
          : undefined)
      const model = selected
        ? {
            providerID: selected.providerID,
            id: selected.id,
            variant: input.variant ?? options.variant ?? ("variant" in selected ? selected.variant : undefined),
          }
        : undefined
      if ((input.variant ?? options.variant ?? explicit?.variant) && !model)
        throw new RunTargetError("Cannot select a variant before selecting a model", next.session?.id)
      const agent = input.autoAgent ? await selectAgent(client, next.location.directory, prepared.message) : next.agent
      return { model, agent }
    },
  }).catch((error) => {
    if (!(error instanceof RunTargetError)) throw error
    reportRunError(input, error.message, error.sessionID)
    return undefined
  })
  if (!target) return
  const model = target.model ? { providerID: target.model.providerID, modelID: target.model.id } : undefined
  const variant = target.model?.variant
  const title =
    !target.resume && input.title !== undefined
      ? input.title || prepared.message.slice(0, 50) + (prepared.message.length > 50 ? "..." : "")
      : undefined
  // Archive before the first prompt is admitted, so the run never reaches an inbox as working or finished.
  const archived = input.archived && (!target.resume || input.fork) ? true : undefined
  if (title !== undefined || archived) {
    await client.session.update({ sessionID: target.session.id, title, archived })
  }

  const prompt = {
    client,
    sessionID: target.session.id,
    location: target.location,
    message: prepared.message,
    files: prepared.files,
    agent: target.agent,
    model,
    variant,
    thinking: input.thinking ?? false,
    format: input.format,
    auto: input.auto ?? false,
    attached: options.attached ?? true,
    compatibility: options.compatibility,
    renderTool: (part: SessionMessageAssistantTool) => renderTool(part, target.location.directory),
    renderToolError: (part: SessionMessageAssistantTool) => renderToolError(part, target.location.directory),
  }
  if (!active(input)) {
    await runNonInteractivePrompt(prompt).catch((error) =>
      reportRunError(input, errorMessage(error), target.session.id),
    )
    return
  }
  await controlled({
    controls: input,
    format: input.format,
    sessionID: target.session.id,
    message: prepared.message,
    schema: prepared.schema,
    run: (next) =>
      runNonInteractivePrompt({
        ...prompt,
        client: OpenCode.make({
          baseUrl: endpoint.url,
          headers: Service.headers(endpoint),
          fetch: Object.assign(
            (request: Parameters<typeof fetch>[0], init?: RequestInit) => {
              const signal = init?.signal ?? (request instanceof Request ? request.signal : undefined)
              return noTimeoutFetch(request, {
                ...init,
                signal: signal ? AbortSignal.any([signal, next.signal]) : next.signal,
              })
            },
            { preconnect: fetch.preconnect },
          ),
        }),
        message: next.message,
        files: next.first ? prepared.files : [],
        quiet: next.quiet,
        observer: next.observer,
      }),
    stop: async () => {
      await client.session.interrupt({ sessionID: target.session.id }, { signal: AbortSignal.timeout(5000) })
      await client.experimental.session.wait({ sessionID: target.session.id }, { signal: AbortSignal.timeout(5000) })
    },
  })
}

export function mergeInput(message: string | undefined, piped: string | undefined) {
  if (!message) return piped || undefined
  if (!piped) return message
  return message + "\n" + piped
}

function formatMessage(message: string[]) {
  const value = message.map((part) => (part.includes(" ") ? `"${part.replace(/"/g, '\\"')}"` : part)).join(" ")
  return value || undefined
}

function localDirectory(root: string) {
  try {
    process.chdir(root)
    return process.cwd()
  } catch {
    fail(`Failed to change directory to ${root}`)
  }
}

export function parseRunModel(value?: string) {
  const ref = parseSessionTargetModel(value)
  if (!ref) return
  return {
    model: { providerID: ref.providerID, modelID: ref.id },
    variant: ref.variant,
  }
}

async function renderTool(part: SessionMessageAssistantTool, directory: string) {
  const info = toolInlineInfo(part, directory)
  if (info.mode === "block") {
    UI.empty()
    UI.println(UI.Style.TEXT_NORMAL + info.icon, UI.Style.TEXT_NORMAL + info.title)
    if (info.body?.trim()) UI.println(info.body)
    UI.empty()
    return
  }
  UI.println(
    UI.Style.TEXT_NORMAL + info.icon,
    UI.Style.TEXT_NORMAL + info.title,
    info.description ? UI.Style.TEXT_DIM + info.description + UI.Style.TEXT_NORMAL : "",
  )
}

async function renderToolError(part: SessionMessageAssistantTool, directory: string) {
  const info = toolInlineInfo(part, directory)
  UI.println(UI.Style.TEXT_NORMAL + "✗", UI.Style.TEXT_NORMAL + `${info.title} failed`)
}

/** @internal Used by the V1 command boundary before a Session exists. */
export function reportRunError(
  input: Pick<RunCommandInput, "format" | "json" | "porcelain">,
  message: string,
  sessionID?: string,
) {
  process.exitCode = 1
  if (input.json) return Envelope.printError("RunError", message)
  if (input.porcelain) return Porcelain.print("error", message)
  if (input.format === "json") {
    process.stdout.write(
      JSON.stringify({
        type: "error",
        timestamp: Date.now(),
        sessionID: sessionID ?? "",
        error: { type: "unknown", message },
      }) + "\n",
    )
    return
  }
  UI.error(message)
}

function fail(message: string): never {
  throw new Error(message)
}

async function readSchema(file: string) {
  const handle = await open(file, "r").catch(() => fail(`Schema file not found: ${file}`))
  try {
    const content = Buffer.alloc(1024 * 1024 + 1)
    let size = 0
    while (size < content.length) {
      const next = await handle.read(content, size, content.length - size, size)
      if (!next.bytesRead) break
      size += next.bytesRead
    }
    if (size === content.length) fail("Output schema exceeds 1 MiB")
    const text = content.subarray(0, size).toString()
    const { Schema, Option } = await import("effect")
    const value = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(text)
    if (Option.isNone(value)) fail(`Schema file is not valid JSON: ${file}`)
    if (
      typeof value.value !== "boolean" &&
      (!value.value || typeof value.value !== "object" || Array.isArray(value.value))
    )
      fail("Output schema must be a JSON Schema object or boolean")
    return value.value
  } finally {
    await handle.close()
  }
}

async function selectAgent(client: OpenCodeClient, directory: string, message: string) {
  const [agents, config] = await Promise.all([
    client.agent.list({ location: { directory } }),
    client.config.get({ location: { directory } }),
  ])
  const candidates = agents.data.filter((agent) => !agent.hidden && agent.mode !== "subagent")
  const configured = config
    .toReversed()
    .flatMap((entry) => (entry.type === "document" && entry.info.default_agent ? [entry.info.default_agent] : []))[0]
  const fallback =
    candidates.find((agent) => agent.id === configured)?.id ??
    candidates.find((agent) => agent.id === "build")?.id ??
    candidates[0]?.id
  if (!fallback) fail("No selectable primary agent is available")
  const choice = route(
    message,
    candidates
      .filter((agent) => agent.id !== fallback)
      .map((agent) => ({ name: agent.id, description: `${agent.name} ${agent.description ?? ""}` })),
  )
  UI.println(explain(choice, fallback))
  return choice?.agent ?? fallback
}
