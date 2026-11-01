import { describe, expect, test } from "bun:test"
import { classify, render, sanitize, tables, validate } from "@opencode/core/tool/plugin/sql"

describe("validate", () => {
  test("accepts a plain select", () => {
    expect(validate("SELECT 1")).toEqual({ ok: true })
    expect(validate("select id, name from users where id = 1")).toEqual({ ok: true })
  })

  test("accepts a trailing semicolon", () => {
    expect(validate("SELECT 1;")).toEqual({ ok: true })
    expect(validate("SELECT 1 ;  ")).toEqual({ ok: true })
  })

  test("accepts WITH, EXPLAIN, and PRAGMA statements", () => {
    expect(validate("WITH t AS (SELECT 1 AS n) SELECT n FROM t")).toEqual({ ok: true })
    expect(validate("EXPLAIN SELECT * FROM users")).toEqual({ ok: true })
    expect(validate("EXPLAIN QUERY PLAN SELECT * FROM users")).toEqual({ ok: true })
    expect(validate("PRAGMA table_info(users)")).toEqual({ ok: true })
  })

  test("rejects stacked statements", () => {
    expect(validate("SELECT 1; DROP TABLE x").ok).toBe(false)
    expect(validate("SELECT 1;;").ok).toBe(false)
    expect(validate("SELECT 1; SELECT 2").ok).toBe(false)
  })

  test("rejects write statements", () => {
    expect(validate("INSERT INTO users VALUES (1)").ok).toBe(false)
    expect(validate("UPDATE users SET name = 'x'").ok).toBe(false)
    expect(validate("DELETE FROM users").ok).toBe(false)
    expect(validate("DROP TABLE users").ok).toBe(false)
    expect(validate("CREATE TABLE t (id int)").ok).toBe(false)
    expect(validate("TRUNCATE users").ok).toBe(false)
  })

  test("rejects writes hidden behind allowed prefixes", () => {
    expect(validate("WITH t AS (SELECT 1) DELETE FROM users").ok).toBe(false)
    expect(validate("WITH t AS (DELETE FROM users RETURNING *) SELECT * FROM t").ok).toBe(false)
    expect(validate("EXPLAIN ANALYZE DELETE FROM users").ok).toBe(false)
    expect(validate("SELECT * FROM users INTO OUTFILE '/tmp/x'").ok).toBe(false)
    expect(validate("SELECT 1 FOR UPDATE").ok).toBe(false)
  })

  test("rejects sqlite side effects", () => {
    expect(validate("ATTACH DATABASE '/tmp/x' AS x").ok).toBe(false)
    expect(validate("VACUUM").ok).toBe(false)
    expect(validate("PRAGMA journal_mode = WAL").ok).toBe(false)
  })

  test("ignores injection payloads inside string literals", () => {
    expect(validate("SELECT '; DROP TABLE users;--'")).toEqual({ ok: true })
    expect(validate("SELECT 'DELETE FROM users'")).toEqual({ ok: true })
    expect(validate(`SELECT 'it''s; fine'`)).toEqual({ ok: true })
    expect(validate(`SELECT 'a\\'; DROP TABLE x;--'`)).toEqual({ ok: true })
  })

  test("ignores semicolons and keywords inside comments", () => {
    expect(validate("SELECT 1 -- ; DROP TABLE users")).toEqual({ ok: true })
    expect(validate("SELECT /* ; DELETE FROM users */ 1")).toEqual({ ok: true })
  })

  test("still sees statements after comments and literals", () => {
    expect(validate("SELECT 1 /* x */; DROP TABLE users").ok).toBe(false)
    expect(validate("SELECT 'x'; DROP TABLE users").ok).toBe(false)
    expect(validate("SELECT 1 -- comment\n; DROP TABLE users").ok).toBe(false)
  })

  test("handles dollar-quoted strings", () => {
    expect(validate("SELECT $$; DROP TABLE users$$")).toEqual({ ok: true })
    expect(validate("SELECT $tag$DELETE FROM users$tag$")).toEqual({ ok: true })
    expect(validate("SELECT $1 FROM users WHERE id = $1")).toEqual({ ok: true })
  })

  test("rejects unterminated constructs", () => {
    expect(validate("SELECT 'abc").ok).toBe(false)
    expect(validate("SELECT /* abc")?.ok).toBe(false)
    expect(validate("SELECT $$abc").ok).toBe(false)
  })

  test("rejects empty input", () => {
    expect(validate("").ok).toBe(false)
    expect(validate("   ;  ").ok).toBe(false)
  })

  test("does not flag identifiers containing keyword substrings", () => {
    expect(validate("SELECT updated_at, created_at FROM insert_log")).toEqual({ ok: true })
    expect(validate("SELECT * FROM t OFFSET 10")).toEqual({ ok: true })
  })

  test("rejects other statement heads outright", () => {
    expect(validate("VALUES (1)").ok).toBe(false)
    expect(validate("SHOW TABLES").ok).toBe(false)
    expect(validate("GRANT ALL ON users TO x").ok).toBe(false)
  })
})

describe("classify", () => {
  test("detects engines from the connection string", () => {
    expect(classify("postgres://u:p@host/db")).toBe("postgres")
    expect(classify("postgresql://host/db")).toBe("postgres")
    expect(classify("mysql://host/db")).toBe("mysql")
    expect(classify("mariadb://host/db")).toBe("mysql")
    expect(classify("./data/app.db")).toBe("sqlite")
    expect(classify("sqlite:///tmp/app.db")).toBe("sqlite")
  })
})

describe("sanitize", () => {
  test("redacts passwords in connection urls", () => {
    expect(sanitize("postgres://user:secret@host:5432/db")).toBe("postgres://user:redacted@host:5432/db")
  })

  test("leaves credential-free targets alone", () => {
    expect(sanitize("postgres://host/db")).toBe("postgres://host/db")
    expect(sanitize("./data/app.db")).toBe("./data/app.db")
    expect(sanitize("sqlite://data/app.db")).toBe("data/app.db")
  })
})

describe("render", () => {
  test("renders one JSON object per row", () => {
    expect(render([{ id: 1 }, { id: 2 }], 2, 50)).toBe('{"id":1}\n{"id":2}')
  })

  test("notes when rows are capped", () => {
    expect(render([{ id: 1 }], 5, 1)).toBe('{"id":1}\n(showing first 1 of 5 fetched rows)')
  })

  test("handles empty results", () => {
    expect(render([], 0, 50)).toBe("no rows")
  })
})

describe("tables", () => {
  test("groups columns by table", () => {
    const rows = [
      { table_name: "users", column_name: "id", data_type: "INTEGER" },
      { table_name: "users", column_name: "name", data_type: "TEXT" },
      { table_name: "posts", column_name: "id", data_type: "INTEGER" },
    ]
    expect(tables(rows)).toBe("users\n  id INTEGER\n  name TEXT\n\nposts\n  id INTEGER")
  })

  test("handles empty schemas", () => {
    expect(tables([])).toBe("no tables found")
  })
})

import { Database } from "bun:sqlite"
import { Effect, Layer } from "effect"
import { SqlTool } from "@opencode/core/tool/plugin/sql"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Environment } from "@opencode/core/environment/index"
import { FileAccess } from "@opencode/core/file-access"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { location } from "./fixture/location"
import { tmpdirScoped } from "./fixture/tmpdir"
import { permissionLayer } from "./lib/permission"
import { testEffect } from "./lib/effect"
import { executeTool, registerToolPlugin, toolIdentity } from "./lib/tool"
import fs from "node:fs/promises"
import path from "node:path"

const sqlNode = makeLocationNode({
  name: "test/bolt-sql",
  layer: Layer.effectDiscard(registerToolPlugin(SqlTool.Plugin)),
  deps: [Tool.node, FileAccess.node, Environment.node, Location.node, Permission.node],
})
const it = testEffect(Layer.empty)
it.live("SQL inspects a real database, preserves its bytes, limits rows and honors configuration and approvals", () =>
  Effect.gen(function* () {
    const temp = yield* tmpdirScoped()
    const file = path.join(temp.path, "fixture.db")
    yield* Effect.promise(async () => {
      const db = new Database(file)
      try {
        db.exec("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT)")
        db.transaction(() => {
          const insert = db.prepare("INSERT INTO users (name) VALUES (?)")
          for (let i = 0; i < 120; i++) insert.run(`name-${i}`)
        })()
      } finally {
        db.close()
      }
      await fs.mkdir(path.join(temp.path, ".bolt"))
      await Bun.write(path.join(temp.path, ".bolt/sql.json"), JSON.stringify({ url: "fixture.db" }))
    })
    const before = yield* Effect.promise(() => Bun.file(file).arrayBuffer())
    let denied = ""
    const actions: string[] = []
    const permission = permissionLayer({
      assert: (input) =>
        Effect.sync(() => actions.push(input.action)).pipe(
          Effect.andThen(
            input.action === denied
              ? Effect.fail(
                  new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
                )
              : Effect.void,
          ),
        ),
    })
    yield* Effect.gen(function* () {
      const registry = yield* Tool.Service
      const run = (input: typeof SqlTool.Input.Type) =>
        executeTool(registry, {
          sessionID: Session.ID.make("ses_sql"),
          ...toolIdentity,
          call: { type: "tool-call", id: "sql", name: "sql", input },
          progress: () => Effect.void,
        })
      const query = yield* run({ query: "SELECT id, name FROM users ORDER BY id", limit: 2 })
      expect(query).toMatchObject({
        status: "completed",
        output: { kind: "sqlite", tables: false, rows: 2, capped: true },
      })
      expect(query.output.output).toBe(
        '{"id":1,"name":"name-0"}\n{"id":2,"name":"name-1"}\n(showing first 2 of 3 fetched rows)',
      )
      expect(actions).toEqual(["read", "sql", "read"])
      const schema = yield* run({ target: "sqlite:fixture.db", schema: true })
      expect(schema).toMatchObject({
        status: "completed",
        output: { kind: "sqlite", tables: true, rows: 2, capped: false },
      })
      expect(schema.output.output).toBe("users\n  id INTEGER\n  name TEXT")
      const pragma = yield* run({ target: file, query: "PRAGMA table_info(users)" })
      expect(pragma).toMatchObject({ status: "completed", output: { rows: 2 } })
      expect((yield* run({ target: file, query: "UPDATE users SET name = 'changed'" })).status).toBe("error")
      expect((yield* run({ target: file, query: "PRAGMA journal_mode(WAL)" })).status).toBe("error")
      expect((yield* run({ target: file, query: "SELECT 1; DELETE FROM users" })).status).toBe("error")
      expect((yield* run({ target: "missing.db", query: "SELECT 1" })).status).toBe("error")
      expect((yield* run({ target: file })).status).toBe("error")
      denied = "sql"
      expect((yield* run({ target: file, query: "SELECT 1" })).status).toBe("error")
      denied = "read"
      expect((yield* run({ target: file, query: "SELECT 1" })).status).toBe("error")
      expect((yield* run({ query: "SELECT 1" })).status).toBe("error")
      expect(yield* Effect.promise(() => Bun.file(file).arrayBuffer())).toEqual(before)
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(LayerNode.group([Tool.node, sqlNode]), [
          Location.node.replace(Layer.succeed(Location.Service, location({ directory: AbsolutePath.make(temp.path) }))),
          Permission.node.replace(permission),
        ]),
      ),
    )
  }),
)
