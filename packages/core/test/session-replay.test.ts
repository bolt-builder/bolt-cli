import { expect } from "bun:test"
import { ai, HttpOptions, ToolDefinition } from "@opencode/ai/effect"
import { OpenAIChat } from "@opencode/ai/protocols"
import { Config } from "@opencode/core/config"
import { SessionReplay } from "@opencode/core/session/replay"
import { Document, Info } from "@opencode/schema/config"
import { ConfigExperimental } from "@opencode/schema/config/experimental"
import { ContextReplay } from "@opencode/util/context-replay"
import { Global } from "@opencode/util/global"
import fs from "node:fs/promises"
import path from "node:path"
import { Effect } from "effect"
import { tmpdirScoped } from "./fixture/tmpdir"
import { testEffect } from "./lib/effect"

const it = testEffect(Config.testLayer())
it.live("records only opted-in final model inputs and keeps HTTP credentials out of private replay files", () =>
  Effect.gen(function* () {
    const temp = yield* tmpdirScoped()
    const config = yield* Config.Test
    const record = yield* SessionReplay.make.pipe(
      Effect.provideService(Global.Service, Global.make({ data: temp.path })),
    )
    const model = OpenAIChat.route.model({ id: "model", provider: "fixture" })
    const request = ai.request({
      model,
      system: "Final system instruction",
      prompt: "Final user input",
      tools: [
        new ToolDefinition({ name: "z", description: "Z", inputSchema: {} }),
        new ToolDefinition({ name: "a", description: "A", inputSchema: {} }),
      ],
      http: new HttpOptions({ headers: { authorization: "fixture-private-secret" } }),
    })
    const input = {
      sessionID: "ses_replay",
      messageID: "msg_replay",
      model: { providerID: "fixture", modelID: "model" },
      request,
    }
    yield* record(input)
    expect(yield* Effect.promise(() => ContextReplay.list(input.sessionID, [temp.path]))).toEqual([])
    yield* config.setEntries([
      new Document({
        type: "document",
        info: new Info({ experimental: new ConfigExperimental.Info({ context_replay: true }) }),
      }),
    ])
    yield* record(input)
    yield* record(input)
    const entries = yield* Effect.promise(() => ContextReplay.list(input.sessionID, [temp.path]))
    expect(entries).toHaveLength(2)
    const data = yield* Effect.promise(() => ContextReplay.load(input.sessionID, entries[0]))
    expect(data).toMatchObject({
      version: 2,
      model: input.model,
      system: request.system,
      messages: JSON.parse(JSON.stringify(request.messages)),
      tools: ["a", "z"],
      toolDefinitions: JSON.parse(JSON.stringify(request.tools)),
    })
    expect(JSON.stringify(data)).not.toContain("fixture-private-secret")
    const stat = yield* Effect.promise(() =>
      fs.stat(path.join(ContextReplay.directory(input.sessionID, temp.path), entries[0].name)),
    )
    if (process.platform !== "win32") expect(stat.mode & 0o777).toBe(0o600)
    yield* config.setEntries([
      new Document({
        type: "document",
        info: new Info({ experimental: new ConfigExperimental.Info({ context_replay: true }) }),
      }),
      new Document({
        type: "document",
        info: new Info({ experimental: new ConfigExperimental.Info({ context_replay: false }) }),
      }),
    ])
    yield* record(input)
    expect(yield* Effect.promise(() => ContextReplay.list(input.sessionID, [temp.path]))).toHaveLength(2)
  }),
)
