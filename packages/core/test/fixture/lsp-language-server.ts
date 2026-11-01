// Independent protocol fixture for document synchronization and diagnostics.
import { pathToFileURL } from "node:url"
let buffer = Buffer.alloc(0)
const documents = new Map<string, { text: string; version: number }>()
let configuration: unknown
let initialized = false
let documentRequest: unknown
let workspaceRequest: unknown
const send = (value: unknown) => {
  const body = Buffer.from(JSON.stringify(value))
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`)
  process.stdout.write(body)
}
const diagnostic = (text: string) =>
  text.includes("broken")
    ? [
        {
          range: { start: { line: 1, character: 2 }, end: { line: 1, character: 4 } },
          message: "fixture error",
          severity: 1,
          source: process.env.FIXTURE_SOURCE ?? "fixture",
        },
      ]
    : []
const root = process.cwd()
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  while (true) {
    const end = buffer.indexOf("\r\n\r\n")
    if (end < 0) return
    const length = Number(/Content-Length: (\d+)/i.exec(buffer.subarray(0, end).toString())?.[1])
    if (buffer.length < end + 4 + length) return
    const message = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString())
    buffer = buffer.subarray(end + 4 + length)
    const { method, params } = message
    if (method === undefined) continue
    const reply = (result: unknown) => send({ jsonrpc: "2.0", id: message.id, result })
    if (method === "initialize") {
      reply({ capabilities: process.env.FIXTURE_PULL === "1" ? { diagnosticProvider: {} } : {} })
      continue
    }
    if (method === "initialized") {
      initialized = true
      if (process.env.FIXTURE_PULL === "dynamic")
        send({
          jsonrpc: "2.0",
          id: 900,
          method: "client/registerCapability",
          params: {
            registrations: [
              {
                id: "fixture-diagnostics",
                method: "textDocument/diagnostic",
                registerOptions: { identifier: "fixture", workspaceDiagnostics: true },
              },
            ],
          },
        })
      continue
    }
    if (method === "workspace/didChangeConfiguration") {
      configuration = params.settings
      continue
    }
    if (method === "textDocument/didOpen") documents.set(params.textDocument.uri, params.textDocument)
    if (method === "textDocument/didChange")
      documents.set(params.textDocument.uri, {
        text: params.contentChanges[0].text,
        version: params.textDocument.version,
      })
    if (["textDocument/didOpen", "textDocument/didChange", "textDocument/didSave"].includes(method)) {
      const document = documents.get(params.textDocument.uri)!
      if (!process.env.FIXTURE_PULL || process.env.FIXTURE_PULL === "0")
        send({
          jsonrpc: "2.0",
          method: "textDocument/publishDiagnostics",
          params: { uri: params.textDocument.uri, version: document.version, diagnostics: diagnostic(document.text) },
        })
      continue
    }
    if (method === "textDocument/diagnostic") {
      documentRequest = params
      if (process.env.FIXTURE_PULL === "dynamic" && params.identifier !== "fixture") {
        send({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: "identifier required" } })
        continue
      }
      reply(
        params.previousResultId === `doc-${documents.get(params.textDocument.uri)!.version}`
          ? { kind: "unchanged", resultId: params.previousResultId }
          : {
              kind: "full",
              items: diagnostic(documents.get(params.textDocument.uri)!.text),
              resultId: `doc-${documents.get(params.textDocument.uri)!.version}`,
              ...(process.env.FIXTURE_PULL === "dynamic"
                ? {
                    relatedDocuments: {
                      [pathToFileURL(root + "/related.fixture").href]: { kind: "full", items: diagnostic("broken") },
                    },
                  }
                : {}),
            },
      )
      continue
    }
    if (method === "workspace/diagnostic") {
      workspaceRequest = params
      reply({
        items: [
          {
            uri: pathToFileURL(root + "/workspace.fixture").href,
            kind: "full",
            items: diagnostic("broken"),
            resultId: "workspace-1",
          },
        ],
      })
      continue
    }
    if (method === "textDocument/prepareCallHierarchy") {
      reply([
        {
          name: "fixture",
          data: { owner: process.env.FIXTURE_SOURCE ?? "fixture" },
          kind: 12,
          uri: pathToFileURL(root + "/source.fixture").href,
          range: { start: { line: 0, character: 0 }, end: { line: 2, character: 0 } },
          selectionRange: { start: { line: 1, character: 2 }, end: { line: 1, character: 4 } },
        },
      ])
      continue
    }
    if (method === "textDocument/references") {
      reply(
        [...documents.keys()].map((uri) => ({
          uri,
          range: { start: { line: 0, character: 0 }, end: { line: 0, character: 6 } },
        })),
      )
      continue
    }
    if (method === "textDocument/rename") {
      const newName = params.newName
      const changes = Object.fromEntries(
        [...documents]
          .filter(([, document]) => document.text.includes("symbol"))
          .map(([uri, document]) => [
            uri,
            [
              {
                range: {
                  start: { line: 0, character: document.text.indexOf("symbol") },
                  end: { line: 0, character: document.text.indexOf("symbol") + 6 },
                },
                newText: newName,
              },
            ],
          ]),
      )
      if (newName === "outside")
        changes[pathToFileURL(root + "/../outside.fixture").href] = changes[params.textDocument.uri]
      reply({ changes })
      continue
    }
    if (
      (method === "callHierarchy/incomingCalls" || method === "callHierarchy/outgoingCalls") &&
      params.item.data.owner !== (process.env.FIXTURE_SOURCE ?? "fixture")
    ) {
      send({ jsonrpc: "2.0", id: message.id, error: { code: -32602, message: "foreign hierarchy item" } })
      continue
    }
    if (method === "fixture/stale") {
      send({
        jsonrpc: "2.0",
        method: "textDocument/publishDiagnostics",
        params: { uri: params.uri, version: 0, diagnostics: diagnostic("broken") },
      })
      reply(null)
      continue
    }
    reply({
      method,
      params,
      documents: [...documents],
      configuration,
      initialized,
      documentRequest,
      workspaceRequest,
      root,
      pid: process.pid,
      environment: process.env.FIXTURE_VALUE,
    })
  }
})
