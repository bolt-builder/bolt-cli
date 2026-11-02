import path from "node:path"
import fs from "node:fs/promises"
import { Effect, Option, Schema } from "effect"
import { applyEdits, modify, parse, type ParseError } from "jsonc-parser"
import { Config } from "@opencode/schema/config"
import { Global } from "@opencode/util/global"
import { Flock } from "@opencode/util/flock"
import { isRecord } from "@opencode/util/record"
import { connect } from "../worktree"
import type { ConfigGetOutput } from "@opencode/client/promise"

export const names = ["opencode.json", "opencode.jsonc", "bolt.json", "bolt.jsonc"]
export function segments(dotted: string) {
  const parts = dotted.split(".")
  if (parts.some((part) => !part || ["__proto__", "prototype", "constructor"].includes(part)))
    throw new Error("Invalid configuration path")
  return parts.map((part) => (/^\d+$/.test(part) ? Number(part) : part))
}
export function value(text: string): unknown {
  const decoded = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(text)
  return Option.isSome(decoded) ? decoded.value : text
}
export function edit(text: string, dotted: string, next: unknown) {
  return applyEdits(
    text,
    modify(text, segments(dotted), next, { formattingOptions: { insertSpaces: true, tabSize: 2 } }),
  )
}
export function select(config: unknown, dotted: string) {
  return segments(dotted).reduce((current: unknown, part) => {
    if (Array.isArray(current)) return current[Number(part)]
    if (isRecord(current) && Object.hasOwn(current, part)) return current[part]
    return undefined
  }, config)
}
export function document(text: string, file: string): Record<string, unknown> {
  const errors: ParseError[] = []
  const input: unknown = parse(text, errors, { allowTrailingComma: true })
  if (errors.length || !isRecord(input)) throw new Error(`Invalid JSONC configuration: ${file}`)
  return input
}
export function leaves(input: unknown, prefix = ""): string[] {
  if (!isRecord(input) || !Object.keys(input).length) return prefix ? [prefix] : []
  return Object.entries(input).flatMap(([key, child]) => leaves(child, prefix ? `${prefix}.${key}` : key))
}

/** Mirrors document precedence: maps merge and ordered instruction/permission contributions accumulate. */
export function resolved(entries: ConfigGetOutput) {
  const merge = (base: Record<string, unknown>, next: Record<string, unknown>, prefix = ""): Record<string, unknown> =>
    Object.fromEntries(
      [...new Set([...Object.keys(base), ...Object.keys(next)])].map((key) => {
        const before = base[key]
        const after = next[key]
        const field = prefix ? `${prefix}.${key}` : key
        const atomic =
          field === "model" ||
          /^agents\.[^.]+\.model$/.test(field) ||
          /^mcp\.servers\.[^.]+$/.test(field) ||
          /^commands\.[^.]+$/.test(field)
        const accumulate =
          ["permissions", "policies", "instructions", "plugins", "skills"].includes(field) ||
          /^agents\.[^.]+\.permissions$/.test(field)
        return [
          key,
          after === undefined
            ? before
            : accumulate && Array.isArray(before) && Array.isArray(after)
              ? [...before, ...after]
              : !atomic && isRecord(before) && isRecord(after)
                ? merge(before, after, field)
                : after,
        ]
      }),
    )
  return entries.reduce<Record<string, unknown>>((result, entry) => {
    if (entry.type !== "document") return result
    return merge(result, entry.info)
  }, {})
}

export const entries = Effect.fn("cli.config.entries")(function* () {
  const connection = yield* connect()
  return yield* Effect.tryPromise({
    try: () => connection.client.config.get({ location: { directory: process.cwd() } }),
    catch: (cause) => cause,
  })
})

export const target = Effect.fn("cli.config.target")(function* (globalScope: boolean) {
  const global = yield* Global.Service
  if (globalScope) {
    const files = yield* Effect.promise(() =>
      Promise.all(
        names.map(async (name) => {
          const file = path.join(global.config, name)
          return (await Bun.file(file).exists()) ? file : undefined
        }),
      ),
    )
    return files.filter((file) => file !== undefined).at(-1) ?? path.join(global.config, "bolt.jsonc")
  }
  const connection = yield* connect()
  const root = path.resolve(connection.location.project.directory)
  const directories: string[] = []
  for (let directory = path.resolve(process.cwd()); ; directory = path.dirname(directory)) {
    directories.push(directory)
    if (directory === root || path.dirname(directory) === directory) break
  }
  // Project directories rank above every direct project file in Core discovery.
  const candidates = [
    ...directories.flatMap((dir) => [path.join(dir, ".bolt"), path.join(dir, ".opencode")]),
    ...directories,
  ].flatMap((dir) => names.toReversed().map((name) => path.join(dir, name)))
  for (const file of candidates) if (yield* Effect.promise(() => Bun.file(file).exists())) return file
  return path.join(root, "bolt.jsonc")
})

export const update = Effect.fn("cli.config.update")(function* (file: string, key: string, textValue?: string) {
  const global = yield* Global.Service
  return yield* Effect.tryPromise({
    try: async () => {
      const lock = await Flock.acquire(file, { dir: path.join(global.state, "locks") })
      try {
        const text = await fs.readFile(file, "utf8").catch((error) => {
          if (error.code === "ENOENT") return "{}"
          throw error
        })
        const current = document(text, file)
        if (textValue === undefined && select(current, key) === undefined)
          throw new Error(`Nothing set at "${key}" in ${file}`)
        const candidates = textValue === undefined ? [undefined] : [value(textValue), textValue]
        const top = String(segments(key)[0])
        const updated = candidates
          .map((candidate) => ({ candidate, text: edit(text, key, candidate) }))
          .find((candidate) => {
            if (textValue === undefined) return true
            const edited = document(candidate.text, file)
            return Option.isSome(
              Schema.decodeUnknownOption(Config.Info, { onExcessProperty: "error" })({ [top]: edited[top] }),
            )
          })
        if (!updated) throw new Error(`Invalid V2 configuration value for "${key}"; no changes written`)
        const temporary = file + `.${crypto.randomUUID()}.tmp`
        await fs.mkdir(path.dirname(file), { recursive: true })
        try {
          await fs.writeFile(temporary, updated.text.endsWith("\n") ? updated.text : updated.text + "\n", {
            mode: 0o600,
          })
          await fs.rename(temporary, file)
        } finally {
          await fs.rm(temporary, { force: true })
        }
        return updated.candidate
      } finally {
        await lock.release()
      }
    },
    catch: (cause) => cause,
  })
})
