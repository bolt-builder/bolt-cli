import { expect } from "bun:test"
import path from "node:path"
import { DateTime, Effect, Schedule, Stream } from "effect"
import { BoltMemory } from "@bolt-ai/memory/effect"
import { Agent } from "@opencode/schema/agent"
import { Event } from "@opencode/schema/event"
import { Model } from "@opencode/schema/model"
import { SessionEvent } from "@opencode/schema/session-event"
import { SessionMessage } from "@opencode/schema/session-message"
import { Session } from "@opencode/core/session"
import { Location } from "@opencode/core/location"
import { Snapshot } from "@opencode/core/snapshot"
import { attachCapture } from "@opencode/core/plugin/memory/capture"
import { tmpdirScoped } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"
import { host } from "./host"

const it = testEffect(PluginTestLayer)

it.live("captures a completed V2 turn with the original pipeline and redacts its model input", () =>
  Effect.gen(function* () {
    const temporary = yield* tmpdirScoped()
    const root = path.join(temporary.path, "memory")
    yield* Effect.promise(() => BoltMemory.enable({ root }))
    yield* Effect.promise(() => BoltMemory.configure({ root, settings: { autoConsolidate: true } }))
    const sessions = yield* Session.Service
    const location = yield* Location.Service
    const session = yield* sessions.create({
      location: { directory: location.directory },
      agent: Agent.ID.make("build"),
    })
    const time = DateTime.nowUnsafe()
    const secret = "sk-abcdefghijklmnopqrstuvwxyz123456"
    const messages = [
      SessionMessage.User.make({
        type: "user",
        id: SessionMessage.ID.create(),
        time: { created: time },
        text: `What command runs tests? API key: ${secret}`,
      }),
      SessionMessage.Assistant.make({
        type: "assistant",
        id: SessionMessage.ID.create(),
        time: { created: time, completed: time },
        agent: Agent.ID.make("build"),
        model: Model.Ref.parse("test/model"),
        finish: "stop",
        content: [{ type: "text", text: "Run bun test in packages/cli for CLI integration checks." }],
      }),
    ]
    const event: SessionEvent.Execution.Succeeded = {
      id: Event.ID.create(),
      created: Date.now(),
      type: "session.execution.succeeded",
      durable: { aggregateID: session.id, seq: Event.Seq.make(1), version: Event.Version.make(1) },
      data: { sessionID: session.id },
    }
    const prompts: string[] = []
    yield* attachCapture(
      host({
        session: { get: () => Effect.succeed(session), context: () => Effect.succeed(messages) },
        event: { subscribe: () => Stream.make(event) },
        experimental: {
          artifact: { transform: () => Effect.die("unused"), reload: () => Effect.die("unused") },
          terminal: { read: () => Effect.die("unused") },
          generate: {
            text: ({ prompt }) =>
              Effect.sync(() => {
                prompts.push(prompt)
                return {
                  text: prompt.startsWith("You are Bolt's session digest updater")
                    ? '{"topic":"CLI checks","summary":"Identified the CLI integration test command; next verify it."}'
                    : '{"operations":[{"op":"upsert_environment_fact","section":"Commands","key":"cli_checks","value":"Run bun test in packages/cli."}],"skipped":[]}',
                }
              }),
            image: () => Effect.die("unused"),
            decisions: () => Effect.die("unused"),
          },
        },
      }),
      root,
      () => Effect.succeed(true),
    ).pipe(Effect.provide(Snapshot.noopLayer))
    const stored = yield* Effect.promise(() => BoltMemory.show({ root })).pipe(
      Effect.repeat({
        until: (result) => result.sources.environment.includes("cli_checks"),
        schedule: Schedule.spaced("10 millis"),
      }),
      Effect.timeout("5 seconds"),
    )
    expect(stored.sources.environment).toContain("Run bun test in packages/cli.")
    expect(prompts.length).toBeGreaterThan(0)
    expect(prompts.join("\n")).not.toContain(secret)
  }),
)
