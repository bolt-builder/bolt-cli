export * as LSP from "./lsp.js"

import { Context, Deferred, Effect, Layer, Option, Schema, Scope, Semaphore } from "effect"
import path from "node:path"
import { fileURLToPath, pathToFileURL } from "node:url"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { Npm } from "@opencode/util/npm"
import { Config } from "./config.js"
import { Environment } from "./environment/index.js"
import { Location } from "./location.js"
import { LspStdio } from "./lsp/stdio.js"
import { LspServers } from "./lsp/servers.js"
import { which } from "./util/which.js"

export const Position = Schema.Struct({
  line: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
  character: Schema.Int.check(Schema.isGreaterThanOrEqualTo(0)),
})
export const Range = Schema.Struct({ start: Position, end: Position })
export const Diagnostic = Schema.Struct({
  range: Range,
  message: Schema.String,
  severity: Schema.optionalKey(Schema.Number),
  source: Schema.optionalKey(Schema.String),
  code: Schema.optionalKey(Schema.Union([Schema.String, Schema.Number])),
})
export type Diagnostic = typeof Diagnostic.Type
const PublishDiagnostics = Schema.Struct({
  uri: Schema.String,
  version: Schema.optionalKey(Schema.Number),
  diagnostics: Schema.Array(Diagnostic),
})
const Initialize = Schema.Struct({ capabilities: Schema.Record(Schema.String, Schema.Unknown) })
const PullDiagnostics = Schema.Union([
  Schema.Struct({
    kind: Schema.Literal("full"),
    items: Schema.Array(Diagnostic),
    resultId: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({ kind: Schema.Literal("unchanged") }),
])
const DiagnosticOptions = Schema.Struct({
  identifier: Schema.optionalKey(Schema.String),
  workspaceDiagnostics: Schema.optionalKey(Schema.Boolean),
})
const DocumentReport = Schema.Struct({
  kind: Schema.Literals(["full", "unchanged"]),
  items: Schema.optionalKey(Schema.Array(Diagnostic)),
  resultId: Schema.optionalKey(Schema.String),
  relatedDocuments: Schema.optionalKey(Schema.Record(Schema.String, PullDiagnostics)),
})
const WorkspaceReport = Schema.Struct({
  items: Schema.Array(
    Schema.Struct({
      uri: Schema.String,
      kind: Schema.Literals(["full", "unchanged"]),
      items: Schema.optionalKey(Schema.Array(Diagnostic)),
      resultId: Schema.optionalKey(Schema.String),
    }),
  ),
})
export const operations = [
  "goToDefinition",
  "findReferences",
  "hover",
  "documentSymbol",
  "workspaceSymbol",
  "goToImplementation",
  "prepareCallHierarchy",
  "incomingCalls",
  "outgoingCalls",
] as const
export type Operation = (typeof operations)[number]
const methods = {
  goToDefinition: "textDocument/definition",
  findReferences: "textDocument/references",
  hover: "textDocument/hover",
  documentSymbol: "textDocument/documentSymbol",
  workspaceSymbol: "workspace/symbol",
  goToImplementation: "textDocument/implementation",
  prepareCallHierarchy: "textDocument/prepareCallHierarchy",
  incomingCalls: "callHierarchy/incomingCalls",
  outgoingCalls: "callHierarchy/outgoingCalls",
}
export type Mode = "document" | "full"
export interface Interface {
  readonly rename: (
    file: string,
    position: typeof Position.Type,
    newName: string,
  ) => Effect.Effect<{ edit: unknown; documents: Record<string, { text: string; version: number }> }[], Error>
  readonly closeFile: (file: string) => Effect.Effect<void, Error>
  readonly touchFile: (file: string, mode?: Mode) => Effect.Effect<number, Error>
  readonly query: (
    file: string,
    operation: Operation,
    position: typeof Position.Type,
    query?: string,
  ) => Effect.Effect<unknown[], Error>
  readonly request: (file: string, method: string, params: unknown) => Effect.Effect<unknown[], Error>
  readonly diagnostics: () => Effect.Effect<Record<string, Diagnostic[]>>
  readonly status: () => Effect.Effect<{ id: string; root: string; closed: boolean }[]>
}
export class Service extends Context.Service<Service, Interface>()("@opencode/LSP") {}

type Client = {
  connection: LspStdio.Connection
  id: string
  root: string
  capabilities: Record<string, unknown>
  diagnostics: Map<string, Diagnostic[]>
  documents: Map<string, { text: string; version: number }>
  updates: Map<string, Deferred.Deferred<void>>
  publications: Map<string, number>
  providers: Map<string, typeof DiagnosticOptions.Type>
  registration: { next: Deferred.Deferred<void> }
  pull: Map<string, { uri: string; items: Diagnostic[]; resultId?: string }>
}
const language = (file: string) =>
  ({
    ".ts": "typescript",
    ".tsx": "typescriptreact",
    ".js": "javascript",
    ".jsx": "javascriptreact",
    ".mts": "typescript",
    ".cts": "typescript",
    ".mjs": "javascript",
    ".cjs": "javascript",
    ".py": "python",
    ".pyi": "python",
    ".rs": "rust",
    ".go": "go",
    ".cpp": "cpp",
    ".hpp": "cpp",
  })[path.extname(file)] ?? path.extname(file).slice(1)

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const environment = yield* Environment.Service
    const location = yield* Location.Service
    const config = yield* Config.Service
    const npm = yield* Npm.Service
    const scope = yield* Effect.scope
    const lock = yield* Semaphore.make(1)
    const clients = new Map<string, Client>()
    const problems = new Map<string, Error>()
    let configured = ""

    const start = Effect.fn("LSP.start")(
      function* (server: LspServers.Server, root: string) {
        let command = server.command
        let initialization = server.initialization ?? {}
        if (!server.custom && server.id === "typescript") {
          let directory = path.dirname(root)
          let tsserver: string | undefined
          for (let current = root; ; current = directory) {
            const candidate = path.join(current, "node_modules/typescript/lib/tsserver.js")
            if (yield* Environment.exists(environment.files, candidate)) {
              tsserver = candidate
              break
            }
            directory = path.dirname(current)
            if (directory === current) break
          }
          if (!tsserver) return undefined
          initialization = { ...initialization, tsserver: { path: tsserver } }
        }
        if (!location.workspaceID && !server.custom && !which(command[0]) && !server.npm) return undefined
        if (!location.workspaceID && server.npm && !which(command[0])) {
          const disabled = process.env.BOLT_DISABLE_LSP_DOWNLOAD ?? process.env.OPENCODE_DISABLE_LSP_DOWNLOAD
          if (disabled === "true" || disabled === "1") return undefined
          const binary = yield* npm.which(server.npm.package, server.npm.bin)
          if (!binary) return yield* Effect.fail(new Error(`LSP server ${server.id} could not be installed`))
          command = [binary, ...command.slice(1)]
        }
        const diagnostics = new Map<string, Diagnostic[]>()
        const documents: Client["documents"] = new Map()
        const updates: Client["updates"] = new Map()
        const publications: Client["publications"] = new Map()
        const providers: Client["providers"] = new Map()
        const pull: Client["pull"] = new Map()
        const registration = { next: yield* Deferred.make<void>() }
        const publish = (uri: string, items: readonly Diagnostic[], version?: number) =>
          Effect.gen(function* () {
            const file = yield* Effect.try(() => fileURLToPath(uri))
            const expected = documents.get(uri)?.version
            if (version !== undefined && expected !== undefined && version !== expected) return
            diagnostics.set(file, [...items])
            publications.set(uri, (publications.get(uri) ?? 0) + 1)
            const update = updates.get(uri)
            if (update) yield* Deferred.succeed(update, undefined)
          })
        const connection = yield* LspStdio.make({
          command,
          directory: root,
          environment: server.env,
          notification: (method, params) =>
            Effect.gen(function* () {
              if (method !== "textDocument/publishDiagnostics") return
              const value = yield* Schema.decodeUnknownEffect(PublishDiagnostics)(params).pipe(
                Effect.mapError((error) => new Error(`Invalid diagnostics from ${server.id}: ${error.message}`)),
              )
              yield* publish(value.uri, value.diagnostics, value.version)
            }),
          request: (method, params) => {
            if (method === "client/registerCapability")
              return Effect.gen(function* () {
                const value = yield* Schema.decodeUnknownEffect(
                  Schema.Struct({
                    registrations: Schema.Array(
                      Schema.Struct({
                        id: Schema.String,
                        method: Schema.String,
                        registerOptions: Schema.optionalKey(DiagnosticOptions),
                      }),
                    ),
                  }),
                )(params)
                for (const entry of value.registrations)
                  if (entry.method === "textDocument/diagnostic") providers.set(entry.id, entry.registerOptions ?? {})
                const previous = registration.next
                registration.next = yield* Deferred.make<void>()
                yield* Deferred.succeed(previous, undefined)
                return null
              }).pipe(Effect.mapError((error) => new Error(String(error))))
            if (method === "client/unregisterCapability")
              return Effect.gen(function* () {
                // The LSP wire spelling is historically 'unregisterations'.
                const value = yield* Schema.decodeUnknownEffect(
                  Schema.Struct({
                    unregisterations: Schema.Array(Schema.Struct({ id: Schema.String, method: Schema.String })),
                  }),
                )(params)
                for (const entry of value.unregisterations)
                  if (entry.method === "textDocument/diagnostic") providers.delete(entry.id)
                const previous = registration.next
                registration.next = yield* Deferred.make<void>()
                yield* Deferred.succeed(previous, undefined)
                return null
              }).pipe(Effect.mapError((error) => new Error(String(error))))
            if (
              ["window/workDoneProgress/create", "window/showMessageRequest", "workspace/diagnostic/refresh"].includes(
                method,
              )
            )
              return Effect.succeed(null)
            if (method === "workspace/workspaceFolders")
              return Effect.succeed([{ uri: pathToFileURL(root).href, name: path.basename(root) }])
            if (method === "workspace/applyEdit")
              return Effect.succeed({
                applied: false,
                failureReason: "Use Bolt's approved editing tools to apply workspace edits.",
              })
            if (method === "workspace/configuration")
              return Effect.gen(function* () {
                const value = yield* Schema.decodeUnknownEffect(
                  Schema.Struct({ items: Schema.Array(Schema.Struct({ section: Schema.optionalKey(Schema.String) })) }),
                )(params).pipe(Effect.mapError(() => new Error("Invalid workspace/configuration request")))
                return value.items.map((item) =>
                  item.section
                    ? item.section
                        .split(".")
                        .reduce<unknown>(
                          (result, key) =>
                            result && typeof result === "object" && Object.hasOwn(result, key)
                              ? (result as Record<string, unknown>)[key]
                              : null,
                          initialization,
                        )
                    : initialization,
                )
              })
            return Effect.fail(new Error(`Unsupported LSP client method: ${method}`))
          },
        }).pipe(
          Scope.provide(scope),
          Effect.provideService(Environment.Service, environment),
          Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
        )
        const initialized = yield* connection
          .request(
            "initialize",
            {
              processId: null,
              rootUri: pathToFileURL(root).href,
              workspaceFolders: [{ uri: pathToFileURL(root).href, name: path.basename(root) }],
              capabilities: {
                workspace: {
                  configuration: true,
                  workspaceFolders: true,
                  applyEdit: false,
                  diagnostics: { refreshSupport: true },
                },
                textDocument: {
                  publishDiagnostics: { versionSupport: true },
                  diagnostic: { dynamicRegistration: true, relatedDocumentSupport: true },
                  synchronization: { didSave: true },
                },
              },
              initializationOptions: initialization,
            },
            "45 seconds",
          )
          .pipe(
            Effect.flatMap(Schema.decodeUnknownEffect(Initialize)),
            Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
            Effect.onError(() => connection.close()),
          )
        yield* Effect.all(
          [
            connection.notify("initialized", {}),
            connection.notify("workspace/didChangeConfiguration", { settings: initialization }),
          ],
          { concurrency: 1 },
        ).pipe(
          Effect.mapError((error) => new Error(String(error))),
          Effect.onError(() => connection.close()),
        )
        if (initialized.capabilities.diagnosticProvider)
          providers.set(
            "$static",
            Schema.decodeUnknownOption(DiagnosticOptions)(initialized.capabilities.diagnosticProvider).pipe(
              Option.getOrElse(() => ({})),
            ),
          )
        return {
          connection,
          id: server.id,
          root,
          capabilities: initialized.capabilities,
          diagnostics,
          documents,
          updates,
          publications,
          providers,
          registration,
          pull,
        } satisfies Client
      },
      (effect) => effect.pipe(Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error))))),
    )
    const getClients = Effect.fn("LSP.clients")(function* (file: string) {
      const servers = LspServers.resolve(yield* config.entries())
      const signature = JSON.stringify(servers)
      if (configured !== signature) {
        yield* Effect.forEach(clients.values(), (client) => client.connection.close(), { discard: true })
        clients.clear()
        problems.clear()
        configured = signature
      }
      const found: Client[] = []
      for (const server of servers) {
        if (
          server.extensions.length &&
          !server.extensions.includes(path.extname(file)) &&
          !server.extensions.includes(path.basename(file))
        )
          continue
        const root = yield* LspServers.root(environment.files, file, location.project.directory, server).pipe(
          Effect.mapError((error) => new Error(String(error))),
        )
        if (!root) continue
        const key = `${server.id}\u0000${root}`
        if (problems.has(key)) return yield* Effect.fail(problems.get(key)!)
        const existing = clients.get(key)
        if (existing && !existing.connection.closed()) {
          found.push(existing)
          continue
        }
        const client = yield* start(server, root).pipe(
          Effect.tapError((error) => Effect.sync(() => problems.set(key, error))),
        )
        if (!client) continue
        clients.set(key, client)
        found.push(client)
      }
      return found
    })

    const touchFile = Effect.fn("LSP.touchFile")(
      function* (file: string, mode: Mode = "document") {
        const connections = yield* getClients(file)
        if (!connections.length) return 0
        const input = yield* environment.files
          .read(file, { offset: 0, length: 4 * 1024 * 1024 + 1 })
          .pipe(Effect.mapError((error) => new Error(String(error))))
        if (input.info.size > 4 * 1024 * 1024) return yield* Effect.fail(new Error("LSP document exceeds 4 MiB"))
        const text = new TextDecoder().decode(input.bytes)
        const uri = pathToFileURL(file).href
        yield* Effect.forEach(
          connections,
          (client) =>
            Effect.gen(function* () {
              const previous = client.documents.get(uri)
              const version = (previous?.version ?? 0) + Number(previous?.text !== text)
              const update = yield* Deferred.make<void>()
              client.updates.set(uri, update)
              if (previous?.text === text && client.publications.has(uri)) yield* Deferred.succeed(update, undefined)
              const document = { uri, languageId: language(file), version, text }
              client.documents.set(uri, { text, version })
              if (!previous) yield* client.connection.notify("textDocument/didOpen", { textDocument: document })
              else if (previous.text !== text)
                yield* client.connection.notify("textDocument/didChange", {
                  textDocument: { uri, version },
                  contentChanges: [{ text }],
                })
              if (mode === "full")
                yield* client.connection.notify("textDocument/didSave", { textDocument: { uri }, text })
              const refresh = Effect.gen(function* () {
                while (true) {
                  const registered = client.registration.next
                  const providers = new Map(
                    [...client.providers.values()].map((value) => [value.identifier ?? "", value]),
                  )
                  const requests = [...providers].flatMap(([identifier, options]) => [
                    { method: "textDocument/diagnostic", identifier, workspace: false },
                    ...(mode === "full" && options.workspaceDiagnostics
                      ? [{ method: "workspace/diagnostic", identifier, workspace: true }]
                      : []),
                  ])
                  const results = yield* Effect.forEach(
                    requests,
                    (request) =>
                      Effect.gen(function* () {
                        const prefix = `${request.identifier}\u0000`
                        const previous = client.pull.get(prefix + uri)
                        const params = request.workspace
                          ? {
                              previousResultIds: [...client.pull]
                                .filter(([key, value]) => key.startsWith(prefix) && value.resultId)
                                .map(([, value]) => ({ uri: value.uri, value: value.resultId })),
                            }
                          : {
                              textDocument: { uri },
                              ...(previous?.resultId ? { previousResultId: previous.resultId } : {}),
                            }
                        const response = yield* client.connection.request(
                          request.method,
                          { ...params, ...(request.identifier ? { identifier: request.identifier } : {}) },
                          "3 seconds",
                        )
                        const reports: {
                          uri: string
                          kind: "full" | "unchanged"
                          items?: readonly Diagnostic[]
                          resultId?: string
                        }[] = []
                        if (request.workspace)
                          reports.push(...(yield* Schema.decodeUnknownEffect(WorkspaceReport)(response)).items)
                        else {
                          const report = yield* Schema.decodeUnknownEffect(DocumentReport)(response)
                          reports.push({ ...report, uri })
                          for (const [relatedUri, related] of Object.entries(report.relatedDocuments ?? {}))
                            reports.push({ ...related, uri: relatedUri })
                        }
                        for (const report of reports) {
                          if (!report.uri.startsWith("file:")) continue
                          const key = prefix + report.uri
                          if (report.kind === "full") {
                            if (!report.items)
                              return yield* Effect.fail(new Error("LSP diagnostic report omitted its items"))
                            client.pull.set(key, {
                              uri: report.uri,
                              items: [...report.items],
                              resultId: report.resultId,
                            })
                          } else if (!client.pull.has(key))
                            return yield* Effect.fail(
                              new Error("LSP returned unchanged diagnostics without a previous report"),
                            )
                        }
                        return true
                      }).pipe(Effect.orElseSucceed(() => false)),
                    { concurrency: "unbounded" },
                  )
                  if (results.some(Boolean)) return
                  const next = yield* Effect.raceAll([
                    Deferred.await(update).pipe(Effect.as("push" as const)),
                    Deferred.await(registered).pipe(Effect.as("registration" as const)),
                  ])
                  if (next === "registration") continue
                  let sequence = client.publications.get(uri)
                  while (true) {
                    yield* Effect.sleep("150 millis")
                    const current = client.publications.get(uri)
                    if (sequence === current) return
                    sequence = current
                  }
                }
              })
              const received = yield* refresh.pipe(Effect.timeoutOption(mode === "full" ? "10 seconds" : "5 seconds"))
              if (Option.isNone(received))
                return yield* Effect.fail(
                  new Error(`LSP server ${client.id} did not provide refreshed diagnostics for ${file}`),
                )
            }).pipe(
              Effect.ensuring(Effect.sync(() => client.updates.delete(uri))),
              Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
            ),
          { concurrency: "unbounded", discard: true },
        )
        return connections.length
      },
      (effect) => lock.withPermit(effect),
    )
    return Service.of({
      touchFile,
      rename: (file, position, newName) =>
        getClients(file).pipe(
          Effect.flatMap((clients) =>
            Effect.forEach(clients, (client) =>
              Effect.gen(function* () {
                const documents = Object.fromEntries(
                  [...client.documents].map(([uri, document]) => [uri, { ...document }]),
                )
                const edit = yield* client.connection.request("textDocument/rename", {
                  textDocument: { uri: pathToFileURL(file).href },
                  position,
                  newName,
                })
                return { edit, documents }
              }),
            ),
          ),
          Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
          (effect) => lock.withPermit(effect),
        ),
      closeFile: (file) =>
        Effect.gen(function* () {
          const uri = pathToFileURL(file).href
          for (const client of clients.values())
            if (client.documents.has(uri)) {
              yield* client.connection.notify("textDocument/didClose", { textDocument: { uri } })
              client.documents.delete(uri)
              client.updates.delete(uri)
              client.diagnostics.delete(file)
              client.publications.delete(uri)
              for (const [key, report] of client.pull) if (report.uri === uri) client.pull.delete(key)
            }
        }).pipe(
          Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
          (effect) => lock.withPermit(effect),
        ),
      query: (file, operation, position, query = "") =>
        getClients(file).pipe(
          Effect.flatMap((clients) =>
            Effect.forEach(clients, (client) =>
              Effect.gen(function* () {
                const textDocument = { uri: pathToFileURL(file).href }
                if (operation === "incomingCalls" || operation === "outgoingCalls") {
                  const prepared = yield* client.connection.request("textDocument/prepareCallHierarchy", {
                    textDocument,
                    position,
                  })
                  if (prepared === null) return []
                  const items = yield* Schema.decodeUnknownEffect(
                    Schema.Array(Schema.Record(Schema.String, Schema.Unknown)),
                  )(prepared)
                  if (items.length > 100)
                    return yield* Effect.fail(new Error("Call hierarchy exceeds 100 roots; select a narrower symbol"))
                  return yield* Effect.forEach(items, (item) => client.connection.request(methods[operation], { item }))
                }
                return yield* client.connection.request(
                  methods[operation],
                  operation === "workspaceSymbol"
                    ? { query }
                    : operation === "documentSymbol"
                      ? { textDocument }
                      : operation === "findReferences"
                        ? { textDocument, position, context: { includeDeclaration: true } }
                        : { textDocument, position },
                )
              }),
            ),
          ),
          Effect.map((results) => results.flat(2).filter((item) => item !== null && item !== undefined)),
          Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error)))),
          (effect) => lock.withPermit(effect),
        ),
      request: (file, method, params) =>
        getClients(file).pipe(
          Effect.flatMap((clients) =>
            Effect.forEach(clients, (client) =>
              client.connection
                .request(method, params)
                .pipe(Effect.mapError((error) => (error instanceof Error ? error : new Error(String(error))))),
            ),
          ),
          (effect) => lock.withPermit(effect),
        ),
      diagnostics: () =>
        Effect.sync(() => {
          const result: Record<string, Diagnostic[]> = {}
          for (const client of clients.values()) {
            for (const [file, items] of client.diagnostics) (result[file] ??= []).push(...items)
            for (const report of client.pull.values()) {
              const file = fileURLToPath(report.uri)
              ;(result[file] ??= []).push(...report.items)
            }
          }
          return Object.fromEntries(
            Object.entries(result).map(([file, items]) => [
              file,
              [...new Map(items.map((item) => [JSON.stringify(item), item])).values()],
            ]),
          )
        }),
      status: () =>
        Effect.sync(() =>
          [...clients.values()].map((client) => ({
            id: client.id,
            root: client.root,
            closed: client.connection.closed(),
          })),
        ),
    })
  }),
)
export const node = makeLocationNode({
  service: Service,
  layer,
  deps: [Environment.node, Location.node, Config.node, Npm.node],
})
