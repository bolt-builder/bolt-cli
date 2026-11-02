import { NodeFileSystem } from "@effect/platform-node"
import { Global } from "@opencode/util/global"
import { Effect, Option } from "effect"
import { expect, mock, test } from "bun:test"
import { mkdir, rm } from "node:fs/promises"
import path from "node:path"
import { Config } from "../src/config"
import { Server } from "../src/commands/commands"
import type { MiniCommandInput } from "../src/mini"
import { OPENCODE_VERSION } from "../src/version"

test("mini handler passes resolved CLI keybinds to the runtime", async () => {
  const root = await Bun.$`mktemp -d`.text().then((value) => value.trim())
  const configDirectory = path.join(root, "config")
  const stateDirectory = path.join(root, "state")
  await mkdir(configDirectory, { recursive: true })
  await Bun.write(
    path.join(configDirectory, "cli.json"),
    JSON.stringify({
      keybinds: { "composer.subagent.interrupt": "ctrl+i" },
      leader: { timeout: 321 },
    }),
  )
  const received: { value?: MiniCommandInput["tuiConfig"] } = {}
  const captured = () => received.value
  let forwarded: Partial<MiniCommandInput> | undefined
  let session: string | undefined
  const mini = await import("../src/mini")
  mock.module("../src/mini", () => ({
    ...mini,
    validateMiniTerminal() {},
    runMini(input: MiniCommandInput) {
      forwarded = input
      session = input.session
      received.value = input.tuiConfig
      return Promise.resolve()
    },
  }))
  const handler = (await import("../src/commands/handlers/mini")).default
  const server = Bun.serve({
    port: 0,
    fetch: () => Response.json({ version: OPENCODE_VERSION, pid: process.pid, urls: [] }),
  })

  try {
    await Effect.runPromise(
      handler({
        thinking: Option.some(true),
        auto: true,
        yolo: false,
        dangerouslySkipPermissions: false,
        file: ["example.ts"],
        variant: Option.some("high"),
        title: Option.some("Bolt Mini test"),
        continue: false,
        session: Option.none(),
        fork: false,
        replay: Option.some(false),
        replayLimit: Option.some(12),
        model: Option.none(),
        agent: Option.none(),
        prompt: Option.none(),
        demo: false,
      }).pipe(
        Effect.provideService(Server, Option.some(server.url.toString())),
        Effect.provide(Config.layer),
        Effect.provide(Global.layerWith({ config: configDirectory, state: stateDirectory })),
        Effect.provide(NodeFileSystem.layer),
        Effect.scoped,
      ),
    )

    const config = await received.value
    expect(forwarded).toMatchObject({
      auto: true,
      file: ["example.ts"],
      variant: "high",
      title: "Bolt Mini test",
      replay: false,
      replayLimit: 12,
    })
    expect(config?.mini?.thinking).toBe("show")
    expect(config?.leader.timeout).toBe(321)
    expect(config?.keybinds.get("composer.subagent.interrupt")).toMatchObject([{ key: "ctrl+i" }])

    const { InteractiveSession } = await import("../src/services/interactive-session")
    received.value = undefined
    await Effect.runPromise(
      InteractiveSession.resume({ endpoint: { url: server.url.toString() } }, "ses_fixture").pipe(
        Effect.provide(Config.layer),
        Effect.provide(Global.layerWith({ config: configDirectory, state: stateDirectory })),
        Effect.provide(NodeFileSystem.layer),
        Effect.scoped,
      ),
    )
    expect(session).toBe("ses_fixture")
    expect((await captured())?.leader.timeout).toBe(321)
    expect((await captured())?.keybinds.get("composer.subagent.interrupt")).toMatchObject([{ key: "ctrl+i" }])
  } finally {
    server.stop(true)
    mock.restore()
    await rm(root, { recursive: true, force: true })
  }
})
