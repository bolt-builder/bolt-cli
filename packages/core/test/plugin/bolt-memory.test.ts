import { expect } from "bun:test"
import { Context, Effect, Schema } from "effect"
import { Command } from "@opencode/core/command"
import { Agent } from "@opencode/core/agent"
import { Job } from "@opencode/core/job"
import { Location } from "@opencode/core/location"
import { Global } from "@opencode/util/global"
import { Permission } from "@opencode/core/permission"
import { Snapshot } from "@opencode/core/snapshot"
import { Plugin } from "@opencode/core/plugin"
import { MemoryPlugin } from "@opencode/core/plugin/memory"
import { ProcessPlugin } from "@opencode/core/plugin/process"
import { Rpc } from "@opencode/core/rpc"
import { Session } from "@opencode/core/session"
import { SessionMessage } from "@opencode/core/session/message"
import { Tool } from "@opencode/core/tool"
import { BoltMemory } from "@opencode/schema/bolt-memory"
import { BoltProcess } from "@opencode/schema/bolt-process"
import { testEffect } from "../lib/effect"
import { PluginTestLayer } from "./fixture"

const it = testEffect(PluginTestLayer)

it.live("ports memory RPC, commands and full V1 tool actions with session controls", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const rpc = yield* Rpc.Service
    const sessions = yield* Session.Service
    const location = yield* Location.Service
    const tools = yield* Tool.Service
    const services = Context.pick(
      Global.Service,
      Permission.Service,
    )(yield* Effect.context<Global.Service | Permission.Service>())
    yield* plugins.activate([
      {
        id: MemoryPlugin.Plugin.id,
        revision: "1",
        effect: (ctx) =>
          MemoryPlugin.Plugin.effect(ctx).pipe(Effect.provide(services), Effect.provide(Snapshot.noopLayer)),
      },
    ])
    yield* plugins.awaitActivation
    expect(yield* plugins.list()).toMatchObject([{ state: { status: "active" } }])
    const session = yield* sessions.create({
      location: { directory: location.directory },
      agent: Agent.ID.make("build"),
    })
    const client = rpc.client(BoltMemory.Definition)
    const command = (text: string) => client.command({ text, sessionID: session.id })
    expect((yield* command("")).text).toContain("purge confirm")
    const enabled = yield* command("on")
    expect(yield* Effect.promise(() => Bun.file(`${enabled.root}/manifest.json`).json())).toMatchObject({
      canonical: location.project.canonical,
    })
    yield* command("remember Use the dragonfruit runner for integration tests.")
    expect((yield* command("show")).text).toContain("dragonfruit")
    expect((yield* command("purge")).text).toContain("requires confirmation")
    expect((yield* command("show")).text).toContain("dragonfruit")
    const snapshot = yield* tools.snapshot()
    const run = (name: string, input: unknown) =>
      snapshot.execute({
        sessionID: session.id,
        agent: Agent.ID.make("build"),
        messageID: SessionMessage.ID.create(),
        call: { type: "tool-call", id: crypto.randomUUID(), name, input },
      })
    const recalled = yield* run("memory_recall", { mode: "typed", query: "dragonfruit" })
    expect(recalled.metadata?.count).toBeGreaterThan(0)
    yield* command("use off")
    expect(JSON.stringify(yield* run("memory_recall", { mode: "catalog" }))).toContain("disabled for this session")
    yield* command("contribute off")
    expect(
      JSON.stringify(yield* run("memory_save", { action: "remember", text: "Use moonberry for releases." })),
    ).toContain("disabled for this session")
    expect((yield* command("show")).text).not.toContain("moonberry")
    const exported = yield* client.manage({ action: "export" })
    expect(exported.count).toBeGreaterThan(0)
    expect((yield* client.manage({ action: "diff", apply: true, discard: true }).pipe(Effect.flip)).message).toContain(
      "Pass only one",
    )
    expect(exported.text).toContain("dragonfruit")
    expect((yield* client.manage({ action: "review", enabled: true })).text).toContain("Review mode on")
    expect((yield* client.manage({ action: "diff", apply: false, discard: false })).text).toContain("No staged memory")
    expect((yield* client.manage({ action: "search", query: "dragonfruit", limit: 2 })).text).toContain("dragonfruit")
    expect((yield* client.manage({ action: "conflicts", fix: false })).text).toContain("No conflicting facts")
    expect((yield* client.manage({ action: "dossier" })).text).toContain("dragonfruit")
    expect((yield* client.manage({ action: "team", operation: "init" })).text).toContain(".bolt/memory.md")
    expect((yield* client.manage({ action: "team", operation: "init" })).text).toContain("already exists")
    yield* command("purge confirm")
    yield* command("on")
    expect((yield* client.manage({ action: "import", text: exported.text })).text).toContain("Imported")
    expect((yield* command("show")).text).toContain("dragonfruit")
    yield* command("contribute on")
    yield* run("memory_save", { action: "remember", text: "Use moonberry for releases.", key: "release_runner" })
    expect((yield* command("show")).text).toContain("moonberry")
    expect((yield* client.manage({ action: "team", operation: "share", query: "release_runner" })).text).toContain(
      "Shared 1 fact",
    )
    yield* run("memory_save", { action: "forget", query: "release_runner" })
    expect((yield* command("show")).text).not.toContain("moonberry")
    const commands = yield* Command.Service
    yield* commands.execute({
      name: "mem",
      invocation: { sessionID: session.id, prompt: { text: "status" }, delivery: "queue" },
    })
    expect(JSON.stringify(yield* sessions.inbox(session.id))).toContain("Project memory enabled")
    yield* command("use on")
    yield* command("off")
    expect(JSON.stringify(yield* run("memory_recall", { mode: "catalog" }))).toContain("disabled for this project")
    yield* command("purge confirm")
    yield* Effect.promise(() =>
      Bun.write(`${location.project.canonical}/package.json`, JSON.stringify({ scripts: { test: "bun test" } })),
    )
    yield* Effect.promise(() => Bun.write(`${location.project.canonical}/bun.lock`, ""))
    const learned = yield* client.manage({ action: "learn" })
    expect(learned.count).toBeGreaterThan(0)
    expect(learned.text).toContain("bun run test")
    expect((yield* command("show")).text).toContain("test_command")
    yield* command("purge confirm")
  }),
)

it.live("lists and cancels untitled jobs through the validated RPC boundary", () =>
  Effect.gen(function* () {
    const plugins = yield* Plugin.Service
    const jobs = yield* Job.Service
    const rpc = yield* Rpc.Service
    yield* plugins.activate([
      {
        id: ProcessPlugin.Plugin.id,
        revision: "1",
        effect: (ctx) => ProcessPlugin.Plugin.effect(ctx).pipe(Effect.provideService(Job.Service, jobs)),
      },
    ])
    yield* plugins.awaitActivation
    expect(yield* plugins.list()).toMatchObject([{ state: { status: "active" } }])
    yield* jobs.start({ id: "untitled", type: "test", run: Effect.never })
    const client = rpc.client(BoltProcess.Definition)
    const listed = yield* client.list({})
    expect(listed.find((item) => item.id === "untitled")).toMatchObject({ status: "running" })
    expect(Object.hasOwn(listed.find((item) => item.id === "untitled")!, "title")).toBe(false)
    expect(yield* client.cancel({ id: "untitled" })).toMatchObject({ status: "cancelled" })
    expect(Schema.is(BoltProcess.Info)(yield* client.cancel({ id: "untitled" }))).toBe(true)
  }),
)
