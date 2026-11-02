import path from "node:path"
import { existsSync } from "node:fs"
import { Effect } from "effect"
import { sql } from "drizzle-orm"
import { Global } from "@opencode/util/global"
import type { EffectDrizzleSqlite } from "./drizzle.js"
import { importLegacyCredentials } from "./migration/20260805200742_import_legacy_credentials.js"

const key = "migration.credentials.bolt.v1"

/** Import once without replacing V2 accounts or editing the original V1 credential file. */
export const importBoltCredentials = Effect.fn("Database.importBoltCredentials")(function* (
  db: EffectDrizzleSqlite.EffectSQLiteDatabase,
) {
  const global = yield* Global.Service
  const legacy = Global.boltDirectory(global.data)
  if (!legacy) return
  const file = path.join(legacy, "auth.json")
  if (!existsSync(file)) return
  yield* db
    .transaction((tx) =>
      Effect.gen(function* () {
        if (yield* tx.get(sql`SELECT key FROM kv WHERE key = ${key}`)) return
        // A fresh V2 database must prefer any credentials already saved in its own auth.json.
        yield* importLegacyCredentials(tx, path.join(global.data, "auth.json"))
        yield* importLegacyCredentials(tx, file)
        const now = Date.now()
        yield* tx.run(sql`INSERT INTO kv (key, value, time_created, time_updated)
      VALUES (${key}, 'true', ${now}, ${now})`)
      }),
    )
    .pipe(
      Effect.catch(() => Effect.logWarning("Unable to import V1 Bolt credentials; source retained", { path: file })),
    )
})
