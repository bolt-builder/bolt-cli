import path from "node:path"
import fs from "node:fs/promises"
import { Effect } from "effect"
import pc from "picocolors"
import { Global } from "@opencode/util/global"
import { Logging } from "@opencode/util/observability/logging"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Updater } from "../../services/updater"
import { createClient, loadIntegrations, request } from "./auth/shared"
import { OPENCODE_CHANNEL, OPENCODE_LOCAL, OPENCODE_VERSION } from "../../version"
import { errorMessage } from "../../util/error"

export type Result = { name: string; ok: boolean; detail: string; fix?: string }

export function render(results: Result[]) {
  return results
    .map((result) => {
      const line = `${result.ok ? pc.green("✓") : pc.red(pc.bold("✗"))} ${result.name}: ${result.detail}`
      return result.ok || !result.fix ? line : `${line}\n  ${pc.dim(`fix: ${result.fix}`)}`
    })
    .join("\n")
}

export default Runtime.handler(Commands.commands.doctor, () =>
  Effect.gen(function* () {
    const global = yield* Global.Service
    const updater = yield* Updater.Service
    const method = yield* updater.method()
    const results: Result[] = [
      {
        name: "binary",
        ok: method !== undefined,
        detail: `${OPENCODE_VERSION} via ${method ?? "unknown"} at ${process.execPath}`,
        fix: "install method not detected; upgrades need a manual reinstall (see bolt upgrade --method)",
      },
    ]
    const connection = yield* createClient().pipe(
      Effect.map((client) => ({ client, error: undefined })),
      Effect.catch((error) => Effect.succeed({ client: undefined, error: errorMessage(error) })),
    )
    const client = connection.client
    const keys = Object.keys(process.env).filter((name) => name.endsWith("_API_KEY") && process.env[name])
    if (!client) {
      results.push({
        name: "config",
        ok: false,
        detail: connection.error ?? "server unavailable",
        fix: "run bolt serve and check its startup errors",
      })
      results.push({
        name: "credentials",
        ok: false,
        detail: "cannot inspect stored integrations while the server is unavailable",
        fix: "restore server connectivity, then run bolt auth list",
      })
    }
    if (client) {
      results.push(
        yield* request(() => client.config.get({ location: { directory: process.cwd() } })).pipe(
          Effect.map(() => ({ name: "config", ok: true, detail: `loaded from ${global.config} and project sources` })),
          Effect.catch((error) =>
            Effect.succeed({
              name: "config",
              ok: false,
              detail: errorMessage(error),
              fix: `check JSON syntax under ${global.config}; run bolt config doctor`,
            }),
          ),
        ),
      )
      results.push(
        yield* loadIntegrations(client).pipe(
          Effect.map((integrations) => {
            const stored = integrations.filter((integration) =>
              integration.connections.some((item) => item.type === "credential"),
            )
            const environment = integrations.filter((integration) =>
              integration.connections.some((item) => item.type === "env"),
            )
            const parts = [
              stored.length ? `${stored.length} stored: ${stored.map((item) => item.id).join(", ")}` : "",
              environment.length ? `${environment.length} environment integration(s)` : "",
              keys.length ? `${keys.length} env key(s): ${keys.join(", ")}` : "",
            ].filter(Boolean)
            return {
              name: "credentials",
              ok: integrations.length > 0 || keys.length > 0,
              detail: parts.join("; ") || "none stored and no *_API_KEY in the environment",
              fix: "run bolt auth login (or set a provider API key in the environment)",
            }
          }),
          Effect.catch((error) =>
            Effect.succeed({
              name: "credentials",
              ok: false,
              detail: errorMessage(error),
              fix: "auth storage is unreadable; run bolt auth list",
            }),
          ),
        ),
      )
    }
    const gateway = process.env.OPENCODE_MODELS_URL || "https://models.opencode.ai"
    const reachable = yield* Effect.promise(() =>
      fetch(gateway, { method: "HEAD", signal: AbortSignal.timeout(5000) })
        .then((response) => response.ok || response.status < 500)
        .catch(() => false),
    )
    results.push({
      name: "gateway",
      ok: reachable,
      detail: `${gateway} ${reachable ? "reachable" : "unreachable"}`,
      fix: "check your network, proxy settings and BOLT_MODELS_URL",
    })
    for (const [label, directory] of [
      ["data dir", global.data],
      ["cache dir", global.cache],
      ["config dir", global.config],
      ["state dir", global.state],
    ] as const) {
      const writable = yield* Effect.tryPromise({
        try: async () => {
          await fs.mkdir(directory, { recursive: true })
          const probe = path.join(directory, `.doctor-${crypto.randomUUID()}`)
          await fs.writeFile(probe, "ok", { flag: "wx", mode: 0o600 })
          await fs.rm(probe)
          return true
        },
        catch: () => false,
      }).pipe(Effect.orElseSucceed(() => false))
      results.push({
        name: label,
        ok: writable,
        detail: `${directory} ${writable ? "writable" : "not writable"}`,
        fix: `create the directory or fix its permissions: ${directory}`,
      })
    }
    const log = Logging.file(OPENCODE_LOCAL, OPENCODE_CHANNEL)
    const size = yield* Effect.tryPromise({
      try: () => fs.stat(log).then((item) => item.size),
      catch: (error) => error,
    }).pipe(Effect.orElseSucceed(() => 0))
    results.push({
      name: "log file",
      ok: size < 100 * 1024 * 1024,
      detail: size ? `${(size / 1024 / 1024).toFixed(1)} MB at ${log}` : "no log file yet",
      fix: `log file is very large; inspect and truncate it: ${log}`,
    })
    process.stdout.write(render(results) + "\n\n")
    const failed = results.filter((result) => !result.ok)
    process.stdout.write(failed.length ? `${failed.length} check(s) failed\n` : "all checks passed\n")
    if (failed.length) process.exitCode ||= 1
  }),
)
