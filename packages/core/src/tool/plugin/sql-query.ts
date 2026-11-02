export * as SqlTool from "./sql-query.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { Effect, Option, Schema } from "effect"
import path from "node:path"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { Permission } from "../../permission.js"
import DESCRIPTION from "./sql.txt"
import { sqlite, remote } from "#sql-driver"

const MAX_ROWS = 100
const DEFAULT_ROWS = 50
export const Input = Schema.Struct({
  query: Schema.optionalKey(Schema.String),
  schema: Schema.optionalKey(Schema.Boolean),
  target: Schema.optionalKey(Schema.String),
  limit: Schema.optionalKey(Schema.Int.check(Schema.isBetween({ minimum: 1, maximum: MAX_ROWS }))),
})
const Output = Schema.Struct({
  kind: Schema.Literals(["sqlite", "postgres", "mysql"]),
  tables: Schema.Boolean,
  rows: Schema.Number,
  capped: Schema.Boolean,
  output: Schema.String,
})

type Row = Record<string, unknown>

const FORBIDDEN =
  /\b(insert|update|delete|drop|create|alter|attach|detach|replace|truncate|grant|revoke|vacuum|reindex|merge|call|exec|execute|copy|set|lock|rename|import|load|into)\b/i

/**
 * Read-only statement validator. Strips comments and literals first so
 * injection payloads hidden inside strings do not trip (or dodge) the checks,
 * then requires a single SELECT/WITH/EXPLAIN/PRAGMA statement with no
 * write-capable keyword anywhere in it.
 */
export function validate(query: string): { ok: true } | { ok: false; reason: string } {
  const stripped = strip(query)
  if (stripped === undefined) return { ok: false, reason: "unterminated string literal or comment" }
  const body = stripped.trim().replace(/;\s*$/, "").trim()
  if (!body) return { ok: false, reason: "empty query" }
  if (body.includes(";")) return { ok: false, reason: "only a single statement is allowed" }
  const head = body.match(/^[a-z]+/i)?.[0]?.toUpperCase()
  if (head === "PRAGMA") {
    if (body.includes("=")) return { ok: false, reason: "PRAGMA assignments are not allowed" }
    return { ok: true }
  }
  if (head !== "SELECT" && head !== "WITH" && head !== "EXPLAIN") {
    return { ok: false, reason: "query must start with SELECT, WITH, EXPLAIN, or PRAGMA" }
  }
  const match = body.match(FORBIDDEN)
  if (match) return { ok: false, reason: `write-capable keyword is not allowed: ${match[0].toUpperCase()}` }
  return { ok: true }
}

/**
 * Replace string literals, quoted identifiers, dollar-quoted strings, and
 * comments with spaces. Returns undefined when a construct is unterminated so
 * the validator can reject instead of guessing.
 */
function strip(query: string): string | undefined {
  let out = ""
  let i = 0
  while (i < query.length) {
    const ch = query[i]
    if (ch === "-" && query[i + 1] === "-") {
      const end = query.indexOf("\n", i)
      if (end === -1) return out + " "
      out += " "
      i = end + 1
      continue
    }
    if (ch === "/" && query[i + 1] === "*") {
      const end = query.indexOf("*/", i + 2)
      if (end === -1) return undefined
      out += " "
      i = end + 2
      continue
    }
    if (ch === "'" || ch === '"' || ch === "`") {
      const end = closing(query, i, ch)
      if (end === -1) return undefined
      out += " "
      i = end + 1
      continue
    }
    if (ch === "$") {
      const tag = query.slice(i).match(/^\$[a-zA-Z_]*\$/)?.[0]
      if (tag) {
        const end = query.indexOf(tag, i + tag.length)
        if (end === -1) return undefined
        out += " "
        i = end + tag.length
        continue
      }
    }
    out += ch
    i++
  }
  return out
}

/** Find the index of the quote closing the literal opened at `start`, honoring doubled-quote and backslash escapes. */
function closing(query: string, start: number, quote: string): number {
  let i = start + 1
  while (i < query.length) {
    if (query[i] === "\\") {
      i += 2
      continue
    }
    if (query[i] !== quote) {
      i++
      continue
    }
    if (query[i + 1] === quote) {
      i += 2
      continue
    }
    return i
  }
  return -1
}

export function classify(target: string): "sqlite" | "postgres" | "mysql" {
  if (/^postgres(ql)?:\/\//i.test(target)) return "postgres"
  if (/^(mysql|mariadb):\/\//i.test(target)) return "mysql"
  return "sqlite"
}

/** Strip credentials from a connection target so it is safe to echo back. */
export function sanitize(target: string): string {
  if (classify(target) === "sqlite") return target.replace(/^sqlite:\/\//, "").replace(/^sqlite:/, "")
  if (!URL.canParse(target)) return "database"
  const url = new URL(target)
  if (url.password) url.password = "redacted"
  return url.toString()
}

export function render(rows: Row[], total: number, limit: number): string {
  if (total === 0) return "no rows"
  const lines = rows.map((row) =>
    JSON.stringify(row, (_key, value) => (typeof value === "bigint" ? value.toString() : value)),
  )
  if (total > limit) lines.push(`(showing first ${limit} of ${total} fetched rows)`)
  return lines.join("\n")
}

/** Group flat information-schema style rows into a per-table column listing. */
export function tables(rows: Row[]): string {
  if (rows.length === 0) return "no tables found"
  const grouped = new Map<string, string[]>()
  for (const row of rows) {
    const table = String(row.table_name)
    const columns = grouped.get(table) ?? []
    columns.push(`  ${String(row.column_name)} ${String(row.data_type)}`)
    grouped.set(table, columns)
  }
  return [...grouped.entries()].map((entry) => [entry[0], ...entry[1]].join("\n")).join("\n\n")
}

const SCHEMA_QUERY = {
  sqlite:
    "SELECT m.name AS table_name, p.name AS column_name, p.type AS data_type FROM sqlite_master m JOIN pragma_table_info(m.name) p WHERE m.type IN ('table', 'view') AND m.name NOT LIKE 'sqlite_%' ORDER BY m.name, p.cid",
  postgres:
    "SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_schema NOT IN ('pg_catalog', 'information_schema') ORDER BY table_name, ordinal_position",
  mysql:
    "SELECT table_name AS table_name, column_name AS column_name, data_type AS data_type FROM information_schema.columns WHERE table_schema = DATABASE() ORDER BY table_name, ordinal_position",
}

export const Plugin = {
  id: "bolt.tool.sql",
  effect: Effect.fn("SqlTool.Plugin")(function* (ctx: Context) {
    const environment = yield* Environment.Service
    const access = yield* FileAccess.Service
    const location = yield* Location.Service
    const permission = yield* Permission.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "sql",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const query = input.query?.trim()
              if (!input.schema && !query)
                return yield* Effect.fail(new Error("query is required unless schema is true"))
              if (!input.schema && query) {
                const checked = validate(query)
                if (!checked.ok) return yield* Effect.fail(new Error(`query rejected: ${checked.reason}`))
              }
              const configured = yield* Effect.gen(function* () {
                if (input.target !== undefined) return undefined
                const file = path.join(location.directory, ".bolt", "sql.json")
                if (!(yield* Environment.exists(environment.files, file))) return undefined
                const target = yield* access.authorizeRead(file, context)
                const data = yield* environment.files.read(target.absolute, { offset: 0, length: 1_000_001 })
                if (data.info.size > 1_000_000) return yield* Effect.fail(new Error(".bolt/sql.json exceeds 1 MB"))
                const parsed = Schema.decodeUnknownOption(
                  Schema.fromJsonString(Schema.Struct({ url: Schema.optionalKey(Schema.String) })),
                )(new TextDecoder().decode(data.bytes))
                if (Option.isNone(parsed))
                  return yield* Effect.fail(new Error(".bolt/sql.json must be a JSON object with a string url"))
                return parsed.value.url
              })
              const target = input.target ?? configured ?? process.env.BOLT_SQL_URL ?? process.env.DATABASE_URL
              if (!target)
                return yield* Effect.fail(
                  new Error(
                    "no database target configured: pass target, add a url to .bolt/sql.json, or set BOLT_SQL_URL / DATABASE_URL",
                  ),
                )
              const kind = classify(target)
              yield* permission.assert({
                action: "sql",
                resources: [input.schema ? "schema" : query!],
                save: ["*"],
                metadata: { target: sanitize(target), kind, schema: input.schema ?? false },
                sessionID: context.sessionID,
                agent: context.agent,
                source: { type: "tool", messageID: context.messageID, id: context.id },
              })
              const statement = input.schema ? SCHEMA_QUERY[kind] : query!
              const limit = input.schema ? 1000 : (input.limit ?? DEFAULT_ROWS)
              const rows = yield* Effect.gen(function* () {
                if (kind !== "sqlite") {
                  // Bound SELECT/WITH before the driver collects rows; schema/EXPLAIN keep their original form.
                  const bounded = /^(?:SELECT|WITH)\b/i.test(strip(statement)?.trim() ?? "")
                    ? `SELECT * FROM (\n${statement.trim().replace(/;\s*$/, "")}\n) AS bolt_readonly_result LIMIT ${limit + 1}`
                    : statement
                  return yield* Effect.tryPromise((signal) => remote(target, bounded, signal))
                }
                if (location.workspaceID)
                  return yield* Effect.fail(
                    new Error(
                      "SQLite inspection currently requires a local workspace; use a remote database URL for remote workspaces",
                    ),
                  )
                const file = yield* access.authorizeRead(
                  target.replace(/^sqlite:\/\//, "").replace(/^sqlite:/, ""),
                  context,
                )
                yield* environment.files.read(file.absolute, { offset: 0, length: 0 })
                return yield* Effect.tryPromise(() => sqlite(file.absolute, statement, limit))
              }).pipe(
                Effect.mapError((error) => {
                  // Driver errors can include the URL or password; never retain that raw cause in a tool result.
                  const secret = kind === "sqlite" || !URL.canParse(target) ? "" : new URL(target).password
                  const message = error instanceof Error ? error.message : "Database request failed"
                  return new Error(
                    message.replaceAll(target, sanitize(target)).replaceAll(secret ? secret : "\u0000", "[redacted]"),
                  )
                }),
              )
              const capped = rows.length > limit
              const selected = rows.slice(0, limit)
              const text = input.schema ? tables(selected) : render(selected, rows.length, limit)
              const output = text.length > 1_000_000 ? `${text.slice(0, 1_000_000)}\n(output truncated at 1 MB)` : text
              const result = {
                kind,
                tables: input.schema ?? false,
                rows: selected.length,
                capped: capped || text.length > 1_000_000,
                output: capped && input.schema ? `${output}\n(schema truncated at ${limit} rows)` : output,
              }
              return {
                output: result,
                content: result.output,
                metadata: { kind, tables: result.tables, rows: result.rows, capped: result.capped },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "Unable to query database", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
