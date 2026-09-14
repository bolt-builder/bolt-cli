export * as Database from "./database"

import { EffectDrizzleSqlite } from "@bolt-ai/effect-drizzle-sqlite"
import { layer as sqliteLayer } from "#sqlite"
import { Context, Effect, Layer } from "effect"
import { Global } from "../global"
import { Flag } from "../flag/flag"
import { existsSync, copyFileSync } from "fs"
import { isAbsolute, join } from "path"
import { DatabaseMigration } from "./migration"
import { InstallationChannel } from "../installation/version"
import { makeGlobalNode } from "../effect/app-node"

const makeDatabase = EffectDrizzleSqlite.makeWithDefaults()
type DatabaseShape = Effect.Success<typeof makeDatabase>

export interface Interface {
  db: DatabaseShape
}

export class Service extends Context.Service<Service, Interface>()("@bolt/v2/storage/Database") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const db = yield* makeDatabase

    yield* db.run("PRAGMA journal_mode = WAL")
    yield* db.run("PRAGMA synchronous = NORMAL")
    yield* db.run("PRAGMA busy_timeout = 5000")
    yield* db.run("PRAGMA cache_size = -64000")
    yield* db.run("PRAGMA foreign_keys = ON")
    yield* db.run("PRAGMA wal_checkpoint(PASSIVE)")
    yield* DatabaseMigration.apply(db)

    return { db }
  }).pipe(Effect.orDie),
)

export function layerFromPath(filename: string) {
  return layer.pipe(Layer.provide(sqliteLayer({ filename })))
}

export function path() {
  if (Flag.BOLT_DB) {
    if (Flag.BOLT_DB === ":memory:" || isAbsolute(Flag.BOLT_DB)) return Flag.BOLT_DB
    return join(Global.Path.data, Flag.BOLT_DB)
  }
  if (
    ["latest", "beta", "prod"].includes(InstallationChannel) ||
    process.env.BOLT_DISABLE_CHANNEL_DB === "1" ||
    process.env.BOLT_DISABLE_CHANNEL_DB === "true"
  )
    return join(Global.Path.data, "bolt.db")
  const next = join(Global.Path.data, `bolt-${InstallationChannel.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
  const legacy = join(Global.Path.data, `opencode-${InstallationChannel.replace(/[^a-zA-Z0-9._-]/g, "-")}.db`)
  if (!existsSync(next) && existsSync(legacy)) {
    try {
      copyFileSync(legacy, next)
    } catch {
      // fall through to opening legacy path via next on next boot
    }
  }
  return next
}

export const node = makeGlobalNode({ service: Service, layer: layerFromPath(path()), deps: [] })
