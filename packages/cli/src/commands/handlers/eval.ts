import path from "node:path"
import os from "node:os"
import fs from "node:fs/promises"
import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { execute } from "../../services/answer"
import { parseSessionTargetModel } from "../../session-target"
import { errorMessage } from "../../util/error"
import { discover, load, runCheck, describeCheck, workspacePath } from "./eval/case"

export default Runtime.handler(Commands.commands.eval, (input) =>
  Effect.gen(function* () {
    if (!Number.isFinite(input.timeout) || input.timeout <= 0)
      return yield* Effect.fail(new Error("--timeout must be a positive number of seconds"))
    const defaults = Option.getOrUndefined(input.model)
    if (defaults !== undefined) parseSessionTargetModel(defaults)
    const targets = input.paths.length ? input.paths : ["evals"]
    const found = yield* Effect.tryPromise(() => discover(targets))
    if (found.missing.length)
      return yield* Effect.fail(new Error(`No such file or directory: ${found.missing.join(", ")}`))
    if (!found.files.length) return yield* Effect.fail(new Error(`No eval cases found in: ${targets.join(", ")}`))
    const cases = yield* Effect.tryPromise(() => Promise.all(found.files.map(load)))
    for (const item of cases) if (item.model !== undefined) parseSessionTargetModel(item.model)
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const json = input.format === "json"
    const emit = (type: string, data: Record<string, unknown>) => {
      if (json) process.stdout.write(JSON.stringify({ type, timestamp: Date.now(), ...data }) + "\n")
    }
    const results: { passed: boolean; timedOut: boolean; durationMs: number; cost: number }[] = []
    for (const [index, item] of cases.entries()) {
      const start = Date.now()
      const timeout = (item.timeout ?? input.timeout) * 1000
      const errors: string[] = []
      const checks: { check: (typeof item.expect)[number]; passed: boolean; detail?: string }[] = []
      let sessionID: string | undefined
      let timedOut = false
      let cost = 0
      let tokens: unknown
      const workspace = yield* Effect.acquireRelease(
        Effect.tryPromise(() => fs.mkdtemp(path.join(os.tmpdir(), "bolt-eval-"))),
        (directory) =>
          input.keep
            ? Effect.void
            : Effect.tryPromise(() => fs.rm(directory, { recursive: true, force: true })).pipe(
                Effect.catch((error) =>
                  Effect.sync(() => {
                    process.stderr.write(`Could not remove eval workspace ${directory}: ${errorMessage(error)}\n`)
                    process.exitCode ||= 1
                  }),
                ),
              ),
      )
      if (!json)
        process.stdout.write(
          `● ${item.name} running${(item.model ?? defaults) ? ` on ${item.model ?? defaults}` : ""}…\n`,
        )
      yield* Effect.tryPromise(async () => {
        for (const [relative, content] of Object.entries(item.files ?? {})) {
          const target = workspacePath(workspace, relative)
          await fs.mkdir(path.dirname(target), { recursive: true })
          await fs.writeFile(target, content)
        }
      })
      yield* Effect.tryPromise(async (signal) => {
        const limited = OpenCode.make({
          baseUrl: server.endpoint.url,
          headers: Service.headers(server.endpoint),
          fetch: Object.assign(
            (request: Parameters<typeof fetch>[0], options?: RequestInit) => {
              const active = options?.signal ?? (request instanceof Request ? request.signal : undefined)
              return noTimeoutFetch(request, {
                ...options,
                signal: active ? AbortSignal.any([active, signal]) : signal,
              })
            },
            { preconnect: fetch.preconnect },
          ),
        })
        const session = await limited.session.create({
          title: `eval: ${item.name}`,
          agent: item.agent ?? Option.getOrUndefined(input.agent) ?? "build",
          model: (item.model ?? defaults) ? parseSessionTargetModel((item.model ?? defaults)!) : undefined,
          location: { directory: workspace },
          permissions: [{ action: "question", resource: "*", effect: "deny" }],
        })
        sessionID = session.id
        await execute({
          client: limited,
          sessionID,
          retain: true,
          directory: workspace,
          agent: item.agent ?? Option.getOrUndefined(input.agent) ?? "build",
          title: `eval: ${item.name}`,
          text: item.prompt,
          model: item.model ?? defaults,
          auto: true,
        })
      }).pipe(
        Effect.timeoutOrElse({
          duration: timeout,
          orElse: () =>
            Effect.sync(() => {
              timedOut = true
              errors.push(`timed out after ${timeout / 1000}s`)
            }),
        }),
        Effect.catch((error) =>
          Effect.sync(() => {
            errors.push(errorMessage(error))
          }),
        ),
      )
      const id = sessionID
      if (timedOut && id)
        yield* Effect.tryPromise(() =>
          client.session.interrupt({ sessionID: id }, { signal: AbortSignal.timeout(5000) }),
        ).pipe(
          Effect.catch((error) =>
            Effect.sync(() => {
              errors.push(`could not interrupt timed-out case: ${errorMessage(error)}`)
            }),
          ),
        )
      if (id) {
        const info = yield* Effect.tryPromise(() =>
          client.session.get({ sessionID: id }, { signal: AbortSignal.timeout(5000) }),
        ).pipe(Effect.orElseSucceed(() => undefined))
        cost = info?.cost ?? 0
        tokens = info?.tokens
      }
      for (const check of item.expect) checks.push(yield* runCheck(check, workspace))
      const result = {
        passed: !errors.length && checks.every((check) => check.passed),
        timedOut,
        durationMs: Date.now() - start,
        cost,
      }
      results.push(result)
      emit("eval_case", {
        name: item.name,
        file: found.files[index],
        sessionID,
        passed: result.passed,
        checks: checks.map((check) => ({ ...check.check, passed: check.passed, detail: check.detail })),
        errors,
        durationMs: result.durationMs,
        cost,
        tokens,
        ...(input.keep ? { workspace } : {}),
      })
      if (!json) {
        process.stdout.write(
          `${result.passed ? "✓" : "✗"} ${item.name} ${(result.durationMs / 1000).toFixed(1)}s${cost ? ` · $${cost.toFixed(4)}` : ""}\n`,
        )
        for (const check of checks.filter((check) => !check.passed))
          process.stdout.write(`  ✗ ${describeCheck(check.check)}${check.detail ? ` — ${check.detail}` : ""}\n`)
        for (const error of errors) process.stdout.write(`  ! ${error}\n`)
        if (input.keep) process.stdout.write(`  workspace: ${workspace}\n`)
      }
    }
    const summary = {
      total: results.length,
      passed: results.filter((result) => result.passed).length,
      failed: results.filter((result) => !result.passed).length,
      durationMs: results.reduce((sum, result) => sum + result.durationMs, 0),
      cost: results.reduce((sum, result) => sum + result.cost, 0),
    }
    emit("eval_summary", summary)
    if (!json)
      process.stdout.write(
        `\n${summary.passed}/${summary.total} passed ${(summary.durationMs / 1000).toFixed(1)}s${summary.cost ? ` · $${summary.cost.toFixed(4)}` : ""}\n`,
      )
    if (summary.failed) process.exitCode = results.some((result) => result.timedOut) ? 5 : 1
  }).pipe(Effect.provide(LayerNode.compile(AppProcess.node))),
)
