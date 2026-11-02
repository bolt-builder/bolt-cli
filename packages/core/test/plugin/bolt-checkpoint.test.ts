import { expect } from "bun:test"
import { Effect } from "effect"
import path from "node:path"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Bus } from "@opencode/core/bus"
import { Database } from "@opencode/core/database/database"
import { Location } from "@opencode/core/location"
import { LocationServiceMap } from "@opencode/core/location-service-map"
import { Plugin } from "@opencode/core/plugin"
import { Rpc } from "@opencode/core/rpc"
import { Session } from "@opencode/core/session"
import { SessionExecution } from "@opencode/core/session/execution"
import { SessionInbox } from "@opencode/core/session/inbox"
import { SessionProjector } from "@opencode/core/session/projector"
import { Snapshot } from "@opencode/core/snapshot"
import { AbsolutePath } from "@opencode/core/schema"
import { BoltCheckpoint } from "@opencode/schema/bolt-checkpoint"
import { Global } from "@opencode/util/global"
import { FSUtil } from "@opencode/util/fs-util"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { tempGlobalLayer } from "../fixture/global"
import { initRepo, git } from "../fixture/git"
import { offlineModels } from "../fixture/models"
import { tmpdirScoped } from "../fixture/tmpdir"
import { testEffect } from "../lib/effect"

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([
      Database.node,
      Bus.node,
      SessionProjector.node,
      Session.node,
      LocationServiceMap.node,
      FSUtil.node,
      Global.node,
    ]),
    [
      Bus.node.replace(Bus.configured({ persist: true })),
      Global.node.replace(tempGlobalLayer),
      SessionExecution.node.replace(SessionExecution.noopLayer),
      offlineModels,
    ],
  ),
)

it.live(
  "saves full-project checkpoints, rewinds files and conversation, migrates V1 records without resurrection",
  () =>
    Effect.gen(function* () {
      const tmp = yield* tmpdirScoped()
      const directory = AbsolutePath.make(path.join(tmp.path, "project"))
      const fs = yield* FSUtil.Service
      yield* fs.makeDirectory(path.join(directory, "sub"), { recursive: true })
      yield* fs.writeFileString(path.join(directory, "root.txt"), "original\n")
      yield* fs.writeFileString(path.join(directory, "sub", "inside.txt"), "inside\n")
      yield* Effect.promise(async () => {
        await initRepo(directory)
        await git(directory, "add", ".")
        await git(directory, "commit", "-m", "files")
      })
      const sessions = yield* Session.Service
      const database = yield* Database.Service
      const bus = yield* Bus.Service
      const created = yield* sessions.create({ location: { directory } })
      const prompt = yield* sessions.prompt({ sessionID: created.id, text: "Before checkpoint", resume: false })
      yield* SessionInbox.promote(database.db, bus, created.id, "steer")
      yield* Effect.gen(function* () {
        const plugins = yield* Plugin.Service
        yield* plugins.awaitActivation
        const rpc = (yield* Rpc.Service).client(BoltCheckpoint.Definition)
        const snapshot = yield* Snapshot.Service
        const global = yield* Global.Service
        const location = yield* Location.Service
        const original = yield* snapshot.capture({ scope: "project" })
        expect(original).toBeDefined()
        const legacy = path.join(global.data, "storage", "checkpoint", location.project.id, "legacy.json")
        const raw = JSON.stringify({ name: "legacy", time: 1, snapshot: original })
        yield* fs.writeWithDirs(legacy, raw)
        expect((yield* rpc.list({})).map((item) => item.name)).toEqual(["legacy"])
        const info = yield* rpc.save({ name: "before", sessionID: created.id })
        expect(info.messageID).toBe(prompt.id)
        const later = yield* sessions.prompt({ sessionID: created.id, text: "After checkpoint", resume: false })
        yield* SessionInbox.promote(database.db, bus, created.id, "steer")
        yield* fs.writeFileString(path.join(directory, "root.txt"), "changed\n")
        yield* fs.writeFileString(path.join(directory, "sub", "inside.txt"), "changed inside\n")
        yield* fs.writeFileString(path.join(directory, "added.txt"), "new\n")
        yield* rpc.rewind({ name: "before" })
        expect(yield* fs.readFileString(path.join(directory, "root.txt"))).toBe("original\n")
        expect(yield* fs.readFileString(path.join(directory, "sub", "inside.txt"))).toBe("inside\n")
        expect(yield* fs.existsSafe(path.join(directory, "added.txt"))).toBe(false)
        expect((yield* sessions.get(created.id)).revert?.messageID).toBe(later.id)
        yield* rpc.remove({ name: "legacy" })
        expect((yield* rpc.list({})).map((item) => item.name)).toEqual(["before"])
        expect(yield* fs.readFileString(legacy)).toBe(raw)
        expect((yield* rpc.rewind({ name: "missing" }).pipe(Effect.flip)).message).toContain("No checkpoint")
        yield* snapshot.transform((editor) => editor.configure(false))
        expect((yield* rpc.save({ name: "disabled" }).pipe(Effect.flip)).message).toContain("enabled Git snapshot")
        yield* snapshot.transform((editor) => editor.configure(true))
        yield* sessions.revert.commit(created.id)
        // Deleting the saved marker must not make a rewind claim that history was restored.
        yield* sessions.remove(created.id)
        yield* fs.writeFileString(path.join(directory, "root.txt"), "keep current\n")
        yield* rpc.rewind({ name: "before" }).pipe(Effect.flip)
        expect(yield* fs.readFileString(path.join(directory, "root.txt"))).toBe("keep current\n")
      }).pipe(
        Effect.provide(LocationServiceMap.Service.get({ directory: AbsolutePath.make(path.join(directory, "sub")) })),
      )
    }),
  { timeout: 30_000 },
)
