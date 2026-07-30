import { describe, expect, test } from "bun:test"
import type { LanguageModelV3 } from "@ai-sdk/provider"
import { Effect } from "effect"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { ProviderV2 } from "@opencode-ai/core/provider"
import { ModelV2 } from "@opencode-ai/core/model"
import { ModelNotFoundError, type Provider } from "@/provider/provider"
import { MessageID, PartID, SessionID } from "@/session/schema"
import type { Session } from "@/session/session"
import type { SessionSummary } from "@/session/summary"
import type { Snapshot } from "@/snapshot"
import { MemoryHost } from "@/memory/host"

const pid = ProviderV2.ID.make("test")
const mid = ModelV2.ID.make("fake-memory-model")

function mdl(id = mid): Provider.Model {
  return {
    id,
    providerID: pid,
    api: { id, npm: "test-provider", url: "" },
    limit: { context: 100_000, output: 4_000 },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
  } as unknown as Provider.Model
}

function lang(outputs = ["{}"]): LanguageModelV3 {
  let idx = 0
  return {
    specificationVersion: "v3",
    provider: "test",
    modelId: "fake-memory-model",
    supportedUrls: {},
    doGenerate: async () => {
      const text = outputs[idx++] ?? outputs.at(-1) ?? "{}"
      return {
        content: [{ type: "text", text }],
        finishReason: { unified: "stop", raw: "stop" },
        usage: {
          inputTokens: { total: 12, noCache: 12, cacheRead: 0, cacheWrite: 0 },
          outputTokens: { total: 8, text: 8, reasoning: 0 },
          raw: {},
        },
        warnings: [],
        providerMetadata: {},
        request: {},
        response: {},
      }
    },
  } as unknown as LanguageModelV3
}

function provider(input: { outputs?: string[]; seen?: string[]; language?: LanguageModelV3 } = {}): Provider.Interface {
  const base = mdl()
  const mem = mdl(ModelV2.ID.make("memory-config-model"))
  const info = {
    id: pid,
    name: "Test",
    source: "config",
    env: [],
    options: {},
    models: { [base.id]: base, [mem.id]: mem },
  } as unknown as Provider.Info
  return {
    list: () => Effect.succeed({ [pid]: info }),
    getProvider: () => Effect.succeed(info),
    getModel: (providerID, modelID) => {
      const found = info.models[modelID]
      if (found) return Effect.succeed(found)
      return Effect.fail(new ModelNotFoundError({ providerID, modelID }))
    },
    getLanguage: (model) => {
      input.seen?.push(model.id)
      return Effect.succeed(input.language ?? lang(input.outputs))
    },
    closest: () => Effect.succeed({ providerID: pid, modelID: base.id }),
    getSmallModel: () => Effect.succeed(mem),
    defaultModel: () => Effect.succeed({ providerID: pid, modelID: base.id }),
  }
}

function text(sessionID: SessionID, messageID: MessageID, body: string): SessionV1.TextPart {
  return {
    id: PartID.make(`prt_${messageID}_text`),
    sessionID,
    messageID,
    type: "text",
    text: body,
  }
}

function tool(input: {
  sessionID: SessionID
  messageID: MessageID
  name: string
  command?: string
  meta?: Record<string, unknown>
}): SessionV1.ToolPart {
  return {
    id: PartID.make(`prt_${input.messageID}_tool`),
    sessionID: input.sessionID,
    messageID: input.messageID,
    type: "tool",
    callID: `call_${input.messageID}`,
    tool: input.name,
    state: {
      status: "completed",
      input: input.command ? { command: input.command } : {},
      output: "",
      title: input.name,
      metadata: input.meta ?? {},
      time: { start: 1, end: 2 },
    },
  }
}

function user(input: { sessionID: SessionID; id: MessageID; body: string }): SessionV1.WithParts {
  return {
    info: {
      id: input.id,
      sessionID: input.sessionID,
      role: "user",
      time: { created: 1 },
      agent: "code",
      model: { providerID: pid, modelID: mid },
    },
    parts: [text(input.sessionID, input.id, input.body)],
  }
}

function assistant(input: {
  sessionID: SessionID
  id: MessageID
  parentID: MessageID
  parts: SessionV1.Part[]
  time: number
  finish?: string
}): SessionV1.WithParts {
  return {
    info: {
      id: input.id,
      sessionID: input.sessionID,
      role: "assistant",
      time: { created: input.time, completed: input.time + 1 },
      parentID: input.parentID,
      modelID: mid,
      providerID: pid,
      mode: "build",
      agent: "code",
      path: { cwd: "/repo", root: "/repo" },
      cost: 0,
      tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
      finish: input.finish ?? "stop",
    },
    parts: input.parts,
  }
}

function sessions(messages: SessionV1.WithParts[]): Session.Interface {
  return {
    get: () => Effect.succeed({ parentID: undefined }),
    messages: (input?: { limit?: number }) => Effect.succeed(input?.limit ? messages.slice(-input.limit) : messages),
  } as unknown as Session.Interface
}

function summary(input: { seen: string[]; diffs: Snapshot.FileDiff[] }): SessionSummary.Interface {
  return {
    summarize: () => Effect.void,
    diff: () => Effect.succeed([]),
    computeDiff: (current: { messages: SessionV1.WithParts[] }) => {
      input.seen.push(...current.messages.map((item) => item.info.id))
      return Effect.succeed(input.diffs)
    },
  } as SessionSummary.Interface
}

const ref = { providerID: "test", modelID: "fake-memory-model" }

describe("memory host", () => {
  test("session port extracts the latest turn, recall markers, and all assistant steps", async () => {
    const sessionID = SessionID.make("ses_memory_adapter")
    const uid = MessageID.make("msg_user")
    const recall = MessageID.make("msg_recall")
    const shell = MessageID.make("msg_shell")
    const final = MessageID.make("msg_final")
    const diffs = [
      {
        file: "packages/opencode/src/memory/host.ts",
        additions: 4,
        deletions: 1,
        status: "modified" as const,
      },
    ] satisfies Snapshot.FileDiff[]
    const seen: string[] = []
    const messages = [
      user({
        sessionID,
        id: uid,
        body: "remember the package test command with OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
      }),
      assistant({
        sessionID,
        id: recall,
        parentID: uid,
        time: 2,
        finish: "tool-calls",
        parts: [
          tool({
            sessionID,
            messageID: recall,
            name: "memory_recall",
            meta: { count: 2, bytes: 120, tokens: 30, files: ["project.md"] },
          }),
        ],
      }),
      assistant({
        sessionID,
        id: shell,
        parentID: uid,
        time: 4,
        finish: "tool-calls",
        parts: [
          tool({
            sessionID,
            messageID: shell,
            name: "bash",
            command: "OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890 bun test",
          }),
        ],
      }),
      assistant({
        sessionID,
        id: final,
        parentID: uid,
        time: 6,
        parts: [
          text(
            sessionID,
            final,
            "Run bun test from packages/opencode for CLI memory tests. The key was OPENAI_API_KEY=sk-proj-abcdefghijklmnopqrstuvwxyz1234567890",
          ),
        ],
      }),
    ]

    const view = await Effect.runPromise(
      MemoryHost.sessionPort({ sessions: sessions(messages), summary: summary({ seen, diffs }) }).readTurn({
        sessionID,
        window: 24,
      }),
    )

    expect(view).toMatchObject({
      user: "remember the package test command with [redacted]",
      assistant: "Run bun test from packages/opencode for CLI memory tests. The key was [redacted]",
      lastAssistantID: final,
      sessionModel: ref,
      recalledMemory: true,
      diffs,
    })
    expect(view?.recent).toContain("Tool memory_recall completed")
    expect(view?.recent).toContain("command=[redacted]")
    expect(view?.recent).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890")
    expect(view?.user).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890")
    expect(view?.assistant).not.toContain("sk-proj-abcdefghijklmnopqrstuvwxyz1234567890")
    expect(seen).toEqual([uid, recall, shell, final])
  })

  test("session port returns undefined when no finished assistant turn exists", async () => {
    const sessionID = SessionID.make("ses_memory_empty")
    const uid = MessageID.make("msg_user_only")
    const seen: string[] = []
    const view = await Effect.runPromise(
      MemoryHost.sessionPort({
        sessions: sessions([user({ sessionID, id: uid, body: "hello" })]),
        summary: summary({ seen, diffs: [] }),
      }).readTurn({ sessionID, window: 24 }),
    )
    expect(view).toBeUndefined()
    expect(seen).toEqual([])
  })

  test("model port resolves configured models and falls back to the session model", async () => {
    const seen: string[] = []
    const port = MemoryHost.modelPort({ provider: provider({ seen }) })

    const configured = await Effect.runPromise(port.resolve({ configured: "test/memory-config-model", session: ref }))
    const fallback = await Effect.runPromise(port.resolve({ configured: "test/missing-memory-model", session: ref }))

    expect(configured.fallback).toBeUndefined()
    expect(fallback.fallback).toEqual({ reason: "model unavailable" })
    expect(seen).toEqual(["memory-config-model", "fake-memory-model"])
  })

  test("model port returns output within the timeout and fails hung models with the capture timeout", async () => {
    const port = MemoryHost.modelPort({ provider: provider({ outputs: ["{}"] }) })
    const resolved = await Effect.runPromise(port.resolve({ session: ref }))
    const result = await port.run({
      handle: resolved.handle,
      system: "system",
      prompt: "prompt",
      timeoutMs: 30_000,
    })
    expect(result.text).toBe("{}")

    const hanging = { ...(lang() as object), doGenerate: () => new Promise(() => {}) } as unknown as LanguageModelV3
    const hung = MemoryHost.modelPort({ provider: provider({ language: hanging }) })
    const stalled = await Effect.runPromise(hung.resolve({ session: ref }))
    await expect(
      hung.run({ handle: stalled.handle, system: "system", prompt: "prompt", timeoutMs: 25 }),
    ).rejects.toThrow("memory model timed out")
  })
})
