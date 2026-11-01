import path from "node:path"
import fs from "node:fs/promises"
import { Effect, Schema } from "effect"
import { runTestCommand } from "../../../services/test-command"

const seconds = Schema.Number.check(Schema.isGreaterThan(0), Schema.isFinite())
export const Check = Schema.Union([
  Schema.Struct({ type: Schema.Literal("file_exists"), path: Schema.String }),
  Schema.Struct({
    type: Schema.Literal("file_contains"),
    path: Schema.String,
    text: Schema.optionalKey(Schema.String),
    pattern: Schema.optionalKey(Schema.String),
  }),
  Schema.Struct({ type: Schema.Literal("command"), run: Schema.String, timeout: Schema.optionalKey(seconds) }),
])
export type Check = typeof Check.Type
export const Info = Schema.Struct({
  name: Schema.String,
  description: Schema.optionalKey(Schema.String),
  model: Schema.optionalKey(Schema.String),
  agent: Schema.optionalKey(Schema.String),
  timeout: Schema.optionalKey(seconds),
  files: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  expect: Schema.Array(Check),
  prompt: Schema.NonEmptyString,
})
export type Info = typeof Info.Type
export type CheckResult = { check: Check; passed: boolean; detail?: string }

export async function discover(targets: readonly string[]) {
  const found: string[] = []
  const missing: string[] = []
  for (const target of targets) {
    const absolute = path.resolve(target)
    const stat = await fs.stat(absolute).catch(() => undefined)
    if (!stat) {
      missing.push(target)
      continue
    }
    if (stat.isDirectory()) {
      for await (const file of new Bun.Glob("**/*.md").scan({
        cwd: absolute,
        absolute: true,
        dot: true,
        followSymlinks: true,
      }))
        found.push(file)
      continue
    }
    found.push(absolute)
  }
  return { files: [...new Set(found)].sort(), missing }
}

export async function load(file: string): Promise<Info> {
  const handle = await fs.open(file, "r")
  const content = await (async () => {
    try {
      const buffer = Buffer.alloc(1_000_001)
      const result = await handle.read(buffer, 0, buffer.length, 0)
      if (result.bytesRead > 1_000_000) throw new Error(`Eval case exceeds 1 MB: ${file}`)
      return buffer.subarray(0, result.bytesRead).toString()
    } finally {
      await handle.close()
    }
  })()
  const match = /^\uFEFF?---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)([\s\S]*)$/.exec(content)
  if (!match) throw new Error(`Eval case requires YAML frontmatter: ${file}`)
  const data = Schema.decodeUnknownSync(Schema.Record(Schema.String, Schema.Unknown))(Bun.YAML.parse(match[1]))
  const item = Schema.decodeUnknownSync(Info)({ name: path.basename(file, ".md"), ...data, prompt: match[2].trim() })
  for (const name of Object.keys(item.files ?? {})) workspacePath("/eval-workspace", name)
  return item
}

export function workspacePath(workspace: string, relative: string) {
  const target = path.resolve(workspace, relative)
  const remainder = path.relative(workspace, target)
  if (remainder === ".." || remainder.startsWith(`..${path.sep}`) || path.isAbsolute(remainder))
    throw new Error(`Eval path escapes its workspace: ${relative}`)
  return target
}
export function describeCheck(check: Check) {
  if (check.type === "file_exists") return `file_exists ${check.path}`
  if (check.type === "file_contains")
    return `file_contains ${check.path} · ${check.pattern ?? check.text ?? "(no matcher)"}`
  return `command ${check.run}`
}

const checkCase = Effect.fn("cli.eval.check")(function* (check: Check, workspace: string) {
  if (check.type === "command") {
    const run = yield* runTestCommand(check.run, workspace).pipe(
      Effect.timeoutOrElse({
        duration: (check.timeout ?? 120) * 1000,
        orElse: () => Effect.succeed({ exitCode: 124, stdout: "", stderr: "Timed out" }),
      }),
    )
    return {
      check,
      passed: run.exitCode === 0,
      ...(run.exitCode === 0
        ? {}
        : { detail: `exit ${run.exitCode}: ${(run.stdout + run.stderr).trim().slice(0, 400)}` }),
    }
  }
  return yield* Effect.tryPromise(async () => {
    const target = workspacePath(workspace, check.path)
    const real = await fs.realpath(target).catch(() => undefined)
    if (!real) return { check, passed: false, detail: "file not found" }
    workspacePath(workspace, path.relative(workspace, real))
    if (check.type === "file_exists") return { check, passed: true }
    if (check.text === undefined && check.pattern === undefined)
      return { check, passed: false, detail: "file_contains requires text or pattern" }
    const handle = await fs.open(real, "r")
    try {
      const bytes = Buffer.alloc(1_000_001)
      const result = await handle.read(bytes, 0, bytes.length, 0)
      if (result.bytesRead > 1_000_000)
        return { check, passed: false, detail: "file exceeds 1 MB; use a command check to grade it" }
      const content = bytes.subarray(0, result.bytesRead).toString()
      const passed =
        check.pattern !== undefined ? new RegExp(check.pattern, "m").test(content) : content.includes(check.text!)
      return { check, passed, ...(passed ? {} : { detail: "no match" }) }
    } finally {
      await handle.close()
    }
  })
})

export const runCheck = (check: Check, workspace: string) =>
  checkCase(check, workspace).pipe(
    Effect.catch((error) =>
      Effect.succeed({ check, passed: false, detail: error instanceof Error ? error.message : String(error) }),
    ),
  )
