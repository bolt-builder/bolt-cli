export * as TestRunTool from "./testrun.js"

import path from "node:path"
import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { Effect, Option, Schema } from "effect"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { Tool } from "../../tool.js"
import DESCRIPTION from "./testrun.txt"

export type Failure = {
  name: string
  file?: string
  message?: string
}

type Matcher = {
  pattern: RegExp
  failure: (match: RegExpExecArray) => Failure
}

// One matcher per test-runner output dialect. Each yields the failing test's name and,
// when the dialect carries it, the file and message.
const matchers: Matcher[] = [
  // pytest: FAILED tests/test_x.py::test_name - AssertionError: boom
  {
    pattern: /^FAILED (\S+?)::(\S+?)(?: - (.*))?$/gm,
    failure: (m) => ({ name: m[2], file: m[1], ...(m[3] ? { message: m[3] } : {}) }),
  },
  // go: --- FAIL: TestName (0.00s)
  { pattern: /^--- FAIL: (\S+)/gm, failure: (m) => ({ name: m[1] }) },
  // cargo: test module::case ... FAILED
  { pattern: /^test (\S+) \.\.\. FAILED$/gm, failure: (m) => ({ name: m[1] }) },
  // bun test: (fail) suite > case
  { pattern: /^\(fail\) (.+?)(?: \[[\d.]+m?s\])?$/gm, failure: (m) => ({ name: m[1] }) },
  // jest/vitest/mocha glyphs: ✕ case, ✗ case, × case
  { pattern: /^\s*[✕✗×] (.+?)(?: \(\d+ ?m?s\))?$/gm, failure: (m) => ({ name: m[1] }) },
  // TAP: not ok 3 - case name
  { pattern: /^not ok \d+ (?:- )?(.+)$/gm, failure: (m) => ({ name: m[1] }) },
]

const counters = [
  // bun/vitest style: "3 pass" / "1 fail", pytest style: "1 failed, 3 passed"
  /(?<fail>\d+) fail(?:ed)?(?:,| |$)/m,
  /(?<pass>\d+) pass(?:ed)?(?:,| |$)/m,
]

/** Extract structured failures and pass/fail counts from raw test-runner output. */
export function parse(text: string) {
  text = text.replace(/\x1b\[[0-?]*[ -/]*[@-~]/g, "").replaceAll("\r\n", "\n")
  const seen = new Set<string>()
  const failures: Failure[] = []
  for (const matcher of matchers) {
    matcher.pattern.lastIndex = 0
    for (const match of text.matchAll(matcher.pattern)) {
      const failure = matcher.failure(match as unknown as RegExpExecArray)
      const key = `${failure.file ?? ""}::${failure.name}`
      if (seen.has(key)) continue
      seen.add(key)
      failures.push(failure)
    }
  }
  const counts: { pass?: number; fail?: number } = {}
  for (const counter of counters) {
    const match = text.match(counter)
    if (!match?.groups) continue
    if (match.groups.fail !== undefined) counts.fail = Number(match.groups.fail)
    if (match.groups.pass !== undefined) counts.pass = Number(match.groups.pass)
  }
  return { failures, counts }
}

export const detect = Effect.fn("TestRunTool.detect")(function* (files: Environment.Files, directory: string) {
  const exists = (name: string) => Environment.exists(files, path.join(directory, name))
  if (yield* exists("package.json")) {
    const raw = yield* files.read(path.join(directory, "package.json"), { offset: 0, length: 1_000_001 })
    if (raw.info.size > 1_000_000)
      return yield* Effect.fail(new Error("package.json exceeds 1 MB; pass command explicitly"))
    const manifest = Schema.decodeUnknownOption(
      Schema.fromJsonString(
        Schema.Struct({ scripts: Schema.optional(Schema.Struct({ test: Schema.optional(Schema.String) })) }),
      ),
    )(new TextDecoder().decode(raw.bytes))
    if (Option.isSome(manifest) && manifest.value.scripts?.test) {
      if ((yield* exists("bun.lock")) || (yield* exists("bun.lockb"))) return "bun run test"
      if (yield* exists("pnpm-lock.yaml")) return "pnpm test"
      if (yield* exists("yarn.lock")) return "yarn test"
      return "npm test"
    }
  }
  if (yield* exists("Cargo.toml")) return "cargo test"
  if (yield* exists("go.mod")) return "go test ./..."
  if ((yield* exists("pytest.ini")) || (yield* exists("pyproject.toml"))) return "pytest"
})

export const Input = Schema.Struct({
  command: Schema.optionalKey(Schema.String),
  workdir: Schema.optionalKey(Schema.String),
  timeout: Schema.optionalKey(Schema.Number.check(Schema.isGreaterThan(0), Schema.isFinite())),
})
const FailureSchema = Schema.Struct({
  name: Schema.String,
  file: Schema.optionalKey(Schema.String),
  message: Schema.optionalKey(Schema.String),
})
const Output = Schema.Struct({
  command: Schema.String,
  status: Schema.Literals(["pass", "fail", "timeout", "running"]),
  passed: Schema.Boolean,
  exit: Schema.optionalKey(Schema.Number),
  failures: Schema.Array(FailureSchema),
  counts: Schema.Struct({ pass: Schema.optionalKey(Schema.Number), fail: Schema.optionalKey(Schema.Number) }),
  output: Schema.String,
  truncated: Schema.Boolean,
})
const ShellOutput = Schema.Struct({
  output: Schema.String,
  exit: Schema.optionalKey(Schema.Number),
  timeout: Schema.optionalKey(Schema.Boolean),
  status: Schema.optionalKey(Schema.Literals(["completed", "running"])),
  truncated: Schema.Boolean,
})

export const Plugin = {
  id: "bolt.tool.test-run",
  effect: Effect.fn("TestRunTool.Plugin")(function* (ctx: Context) {
    const environment = yield* Environment.Service
    const access = yield* FileAccess.Service
    const location = yield* Location.Service
    const registry = yield* Tool.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "test_run",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const target = yield* access.resolve({ path: input.workdir ?? location.directory, kind: "directory" })
              yield* access.authorizeExternal([target], context)
              const command = input.command ?? (yield* detect(environment.files, target.absolute))
              if (!command?.trim())
                return yield* Effect.fail(
                  new Error("Could not detect a test command for this project. Pass the command parameter explicitly."),
                )
              // Invoke the registered shell implementation so its approvals, hooks, job lifecycle,
              // cancellation and sandbox boundary remain identical to an ordinary shell call.
              const tools = yield* registry.snapshot()
              if (!tools.definitions.some((tool) => tool.name === "shell"))
                return yield* Effect.fail(new Error("The shell tool is unavailable; test_run cannot execute commands."))
              const result = yield* tools.execute({
                sessionID: context.sessionID,
                agent: context.agent,
                messageID: context.messageID,
                call: {
                  type: "tool-call",
                  id: context.id,
                  name: "shell",
                  input: { command, workdir: target.absolute, timeout: input.timeout ?? 600_000 },
                },
                progress: context.progress,
              })
              const captured = yield* Schema.decodeUnknownEffect(ShellOutput)(result.output)
              const parsed = parse(captured.output)
              const status: typeof Output.Type.status =
                captured.status === "running"
                  ? "running"
                  : captured.timeout
                    ? "timeout"
                    : captured.exit === 0
                      ? "pass"
                      : "fail"
              const passed = status === "pass"
              const lines = [
                `status=${status}`,
                `command=${command}`,
                ...(captured.exit === undefined ? [] : [`exit=${captured.exit}`]),
              ]
              if (parsed.counts.pass !== undefined || parsed.counts.fail !== undefined)
                lines.push(`passed=${parsed.counts.pass ?? "?"} failed=${parsed.counts.fail ?? "?"}`)
              if (!passed && parsed.failures.length)
                lines.push(
                  "",
                  "Failures:",
                  ...parsed.failures
                    .slice(0, 50)
                    .map(
                      (failure) =>
                        `- ${failure.name}${failure.file ? ` (${failure.file})` : ""}${failure.message ? `: ${failure.message}` : ""}`,
                    ),
                  ...(parsed.failures.length > 50 ? [`...and ${parsed.failures.length - 50} more`] : []),
                )
              if (!passed) lines.push("", "Output tail:", captured.output.trimEnd() || "(no output)")
              return {
                output: {
                  command,
                  status,
                  passed,
                  ...(captured.exit === undefined ? {} : { exit: captured.exit }),
                  ...parsed,
                  output: passed ? "" : captured.output,
                  truncated: captured.truncated,
                },
                content: [{ type: "text" as const, text: lines.join("\n") }],
                metadata: {
                  ...result.metadata,
                  command,
                  passed,
                  failureCount: parsed.failures.length,
                  ...(parsed.counts.pass === undefined ? {} : { passCount: parsed.counts.pass }),
                  ...(parsed.counts.fail === undefined ? {} : { failCount: parsed.counts.fail }),
                },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "Unable to run tests", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
