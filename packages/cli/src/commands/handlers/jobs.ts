import fs from "node:fs"
import path from "node:path"
import { spawn, spawnSync } from "node:child_process"
import { Effect, Option, Schema } from "effect"
import { ChildProcess } from "effect/process"
import { Global } from "@opencode/util/global"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Tail } from "../../util/tail"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { errorMessage } from "../../util/error"
import { restoreState } from "../../services/legacy-state"
const DIR = path.join(Global.Path.state, "jobs")
const println = (text = "") => process.stdout.write(text + "\n")
const fail = (text: string) => Effect.fail(new Error(text))
const JobInfo = Schema.Struct({
  id: Schema.String.check(Schema.isPattern(/^[a-zA-Z0-9_-]+$/)),
  pid: Schema.Int.check(Schema.isGreaterThanOrEqualTo(1)),
  command: Schema.String,
  argv: Schema.optional(Schema.Array(Schema.String)),
  log: Schema.String,
  cwd: Schema.String,
  started: Schema.Number,
  restarts: Schema.optional(Schema.Array(Schema.Struct({ at: Schema.Number, reason: Schema.String }))),
})
export type Restart = {
  at: number
  reason: string
}

const restore = () =>
  restoreState("jobs", (text) =>
    Option.getOrUndefined(Schema.decodeUnknownOption(Schema.fromJsonString(JobInfo))(text)),
  )

export type Job = {
  id: string
  pid: number
  command: string
  argv?: string[]
  log: string
  cwd: string
  started: number
  restarts?: Restart[]
}

export function alive(pid: number) {
  if (!pid) return false
  try {
    process.kill(pid, 0)
    return true
  } catch {
    return false
  }
}

function stop(pid: number) {
  try {
    killJob(pid)
    return true
  } catch {
    return false
  }
}

/**
 * Decide what the supervisor should do after one poll. `failures` counts
 * consecutive failed health checks before this poll; a dead process restarts
 * immediately, an unhealthy one only after `retries` consecutive failures.
 */
export function verdict(
  check: { alive: boolean; healthy: boolean },
  failures: number,
  retries: number,
): { action: "ok" | "wait" | "restart"; failures: number; reason?: "dead" | "unhealthy" } {
  if (!check.alive) return { action: "restart", failures: 0, reason: "dead" }
  if (check.healthy) return { action: "ok", failures: 0 }
  const next = failures + 1
  if (next >= retries) return { action: "restart", failures: 0, reason: "unhealthy" }
  return { action: "wait", failures: next }
}

/** Delay in ms before polling again after the nth restart: exponential, capped at 60s. */
export function backoff(restart: number, interval: number): number {
  return Math.min(interval * 2 ** restart, 60_000)
}

/** Classify a health target as an http(s) URL to fetch or a command to run. */
export function probe(target: string): "url" | "command" {
  return /^https?:\/\//i.test(target.trim()) ? "url" : "command"
}

/**
 * Kill a detached job and its descendants. Jobs are spawned as their own
 * process-group leader (see spawnJob), and `bolt run` spawns tool subprocesses
 * (sh -c ...) into that group, so signal the whole group. Falls back to the
 * lone pid when the group is already gone; Windows uses taskkill for the tree.
 */
export function killJob(pid: number, signal: NodeJS.Signals | number = "SIGTERM") {
  if (process.platform === "win32") {
    const killed = spawnSync("taskkill", ["/pid", String(pid), "/T", "/F"], { windowsHide: true, stdio: "ignore" })
    if (killed.error) throw killed.error
    if (killed.status !== 0) process.kill(pid, signal)
    return
  }
  try {
    process.kill(-pid, signal)
  } catch {
    process.kill(pid, signal)
  }
}

/**
 * Spawn a detached background job that re-runs this CLI with the given argv,
 * appending output to a log file under the global state directory. Pass `meta`
 * to respawn an existing job in place, keeping its id, log, and restart history.
 */
export async function spawnJob(argv: string[], cwd: string, meta?: { id: string; restarts: Restart[] }): Promise<Job> {
  await restore()
  fs.mkdirSync(DIR, { recursive: true })
  const id = meta?.id ?? Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const log = path.join(DIR, `${id}.log`)
  const fd = fs.openSync(log, "a")
  // In dev, argv[1] is a real script path that must be forwarded to the
  // runtime; in a compiled binary it is a virtual bundle path that must not.
  const entry =
    process.argv[1] && fs.existsSync(process.argv[1])
      ? [...(process.argv[1].endsWith(".ts") ? ["--jsx-import-source=@opentui/solid"] : []), process.argv[1]]
      : []
  const child = spawn(process.execPath, [...entry, ...argv], {
    cwd,
    detached: true,
    stdio: ["ignore", fd, fd],
  })
  fs.closeSync(fd)
  await new Promise<void>((resolve, reject) => {
    child.once("spawn", resolve)
    child.once("error", reject)
  })
  child.unref()
  if (!child.pid) throw new Error("Background process did not report a PID")
  const job: Job = {
    id,
    pid: child.pid,
    command: argv.join(" "),
    argv,
    log,
    cwd,
    started: Date.now(),
    ...(meta ? { restarts: meta.restarts } : {}),
  }
  fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(job, null, 2))
  return job
}

export function jobs(): Job[] {
  if (!fs.existsSync(DIR)) return []
  const marker = path.join(DIR, ".bolt-v1-imported")
  const imported = fs.existsSync(marker)
    ? Option.getOrElse(
        Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Array(Schema.String)))(fs.readFileSync(marker, "utf8")),
        () => [],
      )
    : []
  const legacy = Global.boltDirectory(Global.Path.state)
  return fs
    .readdirSync(DIR)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      const current = Schema.decodeUnknownOption(Schema.fromJsonString(JobInfo))(
        fs.readFileSync(path.join(DIR, file), "utf8"),
      )
      // A V1 supervisor can still be running and replace its child's PID. Follow
      // updates only for imported IDs, and never replace an existing V2 collision.
      const source =
        legacy && Option.isSome(current) && imported.includes(current.value.id)
          ? path.join(legacy, "jobs", file)
          : undefined
      const previous =
        source && fs.existsSync(source)
          ? Schema.decodeUnknownOption(Schema.fromJsonString(JobInfo))(fs.readFileSync(source, "utf8"))
          : Option.none()
      const parsed =
        Option.isSome(previous) &&
        Option.isSome(current) &&
        previous.value.id === current.value.id &&
        previous.value.started > current.value.started
          ? previous
          : current
      return Option.isSome(parsed)
        ? [
            {
              ...parsed.value,
              argv: parsed.value.argv ? [...parsed.value.argv] : undefined,
              restarts: parsed.value.restarts?.map((item) => ({ ...item })),
            },
          ]
        : []
    })
    .sort((a, b) => b.started - a.started)
}

export function find(id: string) {
  const all = jobs()
  const exact = all.find((job) => job.id === id)
  if (exact) return exact
  const matches = all.filter((job) => job.id.startsWith(id))
  return matches.length === 1 ? matches[0] : undefined
}

export default Runtime.handler(Commands.commands.jobs, (args) =>
  Effect.gen(function* () {
    yield* Effect.tryPromise({ try: restore, catch: (cause) => cause })
    const processService = yield* AppProcess.Service
    if (args.action === "list") {
      const all = jobs()
      if (all.length === 0) {
        println('No background jobs. Start one with: bolt run --background "..."')
        return
      }
      for (const job of all) {
        const status = alive(job.pid) ? "running" : "stopped"
        const when = new Date(job.started).toLocaleString()
        const restarts = job.restarts?.length ? `  restarts ${job.restarts.length}` : ""
        println(`${job.id}  ${status.padEnd(7)}  pid ${String(job.pid).padEnd(6)}  ${when}  ${job.command}${restarts}`)
      }
      return
    }

    if (Option.isNone(args.id)) return yield* fail(`pass a job id: bolt jobs ${args.action} <id>`)
    const id = args.id.value
    const matches = jobs().filter((job) => job.id.startsWith(id))
    const exact = matches.find((job) => job.id === id)
    if (!exact && matches.length > 1) return yield* fail(`job id "${args.id.value}" is ambiguous. Use a longer prefix.`)
    const job = exact ?? matches[0]
    if (!job) return yield* fail(`no job matching "${args.id.value}". Run: bolt jobs list`)

    if (args.action === "supervise") {
      const interval = Math.max(args.interval, 0.2) * 1000
      const retries = Math.max(Math.floor(args.retries), 1)
      const limit = Math.max(Math.floor(args.limit), 1)
      const target = Option.getOrUndefined(args.health)
      const health = Effect.fnUntraced(function* (check: string) {
        if (probe(check) === "url") {
          return yield* Effect.promise(() =>
            fetch(check, { signal: AbortSignal.timeout(Math.min(interval, 10_000)) })
              .then((res) => res.ok)
              .catch(() => false),
          )
        }
        const proc = yield* processService.run(
          ChildProcess.make(check, { shell: true, stdout: "ignore", stderr: "ignore" }),
        )
        return proc.exitCode === 0
      })
      println(
        `Supervising job ${job.id} every ${interval / 1000}s` +
          (target ? ` (health: ${target}, ${retries} retries)` : "") +
          `, restart cap ${limit}. Press ctrl+c to stop.`,
      )
      let failures = 0
      let restarted = 0
      while (true) {
        const current = find(job.id)
        if (!current) return yield* fail(`job ${job.id} metadata disappeared`)
        const up = alive(current.pid)
        const healthy = up && (target ? yield* health(target) : true)
        const result = verdict({ alive: up, healthy }, failures, retries)
        failures = result.failures
        if (result.action !== "restart") {
          yield* Effect.sleep(`${interval} millis`)
          continue
        }
        if (restarted >= limit) {
          return yield* fail(
            `Job ${job.id} hit the restart cap (${limit}); giving up to avoid a crash loop. Check: bolt jobs tail ${job.id}`,
          )
        }
        const reason = result.reason === "dead" ? "process died" : `health check failed ${retries} times`
        if (up) stop(current.pid)
        // Legacy job records predate the argv field; splitting the joined
        // command is lossy for quoted arguments but the best available.
        const argv = current.argv ?? current.command.split(/\s+/)
        const next = yield* Effect.tryPromise({
          try: () =>
            spawnJob(argv, current.cwd, {
              id: current.id,
              restarts: [...(current.restarts ?? []), { at: Date.now(), reason }],
            }),
          catch: (cause) => cause,
        })
        restarted += 1
        println(`Restarted job ${next.id} (pid ${next.pid}): ${reason}. Restart ${restarted}/${limit}.`)
        yield* Effect.sleep(`${backoff(restarted, interval)} millis`)
      }
    }

    if (args.action === "kill") {
      if (!alive(job.pid)) {
        println(`Job ${job.id} is not running.`)
        return
      }
      killJob(job.pid)
      println(`Killed job ${job.id} (pid ${job.pid}).`)
      return
    }

    if (!fs.existsSync(job.log)) return yield* fail(`no log file for job ${job.id}`)
    const text = yield* Effect.promise(() => Bun.file(job.log).text())
    if (text) process.stdout.write(text.endsWith("\n") ? text : `${text}\n`)
    if (!args.follow) return
    yield* Effect.callback<void>(() => {
      const close = Tail.follow(job.log, Buffer.byteLength(text))
      return Effect.sync(close)
    })
  }).pipe(
    Effect.provide(LayerNode.compile(AppProcess.node)),
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
