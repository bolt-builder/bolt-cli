import fs from "node:fs"
import path from "node:path"
import { spawn } from "node:child_process"
import { Effect } from "effect"
import { Global } from "@opencode-ai/core/global"
import { UI } from "../ui"
import { effectCmd, fail } from "../effect-cmd"

const DIR = path.join(Global.Path.state, "jobs")

export type Job = {
  id: string
  pid: number
  command: string
  log: string
  cwd: string
  started: number
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

/**
 * Kill a detached job and its descendants. Jobs are spawned as their own
 * process-group leader (see spawnJob), and `bolt run` spawns tool subprocesses
 * (sh -c ...) into that group, so signal the whole group. Falls back to the
 * lone pid when the group signal is unsupported (Windows) or already gone.
 */
export function killJob(pid: number, signal: NodeJS.Signals | number = "SIGTERM") {
  if (process.platform === "win32") {
    process.kill(pid, signal)
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
 * appending output to a log file under the global state directory.
 */
export function spawnJob(argv: string[], cwd: string): Job {
  fs.mkdirSync(DIR, { recursive: true })
  const id = Date.now().toString(36) + Math.random().toString(36).slice(2, 6)
  const log = path.join(DIR, `${id}.log`)
  const fd = fs.openSync(log, "a")
  // In dev, argv[1] is a real script path that must be forwarded to the
  // runtime; in a compiled binary it is a virtual bundle path that must not.
  const entry = process.argv[1] && fs.existsSync(process.argv[1]) ? [process.argv[1]] : []
  const child = spawn(process.execPath, [...entry, ...argv], {
    cwd,
    detached: true,
    stdio: ["ignore", fd, fd],
  })
  fs.closeSync(fd)
  child.unref()
  const job: Job = {
    id,
    pid: child.pid ?? 0,
    command: argv.join(" "),
    log,
    cwd,
    started: Date.now(),
  }
  fs.writeFileSync(path.join(DIR, `${id}.json`), JSON.stringify(job, null, 2))
  return job
}

export function jobs(): Job[] {
  if (!fs.existsSync(DIR)) return []
  return fs
    .readdirSync(DIR)
    .filter((file) => file.endsWith(".json"))
    .flatMap((file) => {
      const parsed = (() => {
        try {
          return JSON.parse(fs.readFileSync(path.join(DIR, file), "utf8")) as Job
        } catch {
          return undefined
        }
      })()
      return parsed ? [parsed] : []
    })
    .sort((a, b) => b.started - a.started)
}

function find(id: string) {
  return jobs().find((job) => job.id === id || job.id.startsWith(id))
}

export const JobsCommand = effectCmd({
  command: "jobs <action> [id]",
  describe: "manage background jobs started with run --background",
  instance: false,
  builder: (yargs) =>
    yargs
      .positional("action", {
        type: "string",
        choices: ["list", "tail", "kill"] as const,
        demandOption: true,
        describe: "list jobs, tail a job's output, or kill a running job",
      })
      .positional("id", {
        type: "string",
        describe: "job id (prefix match)",
      })
      .option("follow", {
        alias: "f",
        type: "boolean",
        default: false,
        describe: "with tail, stream new output as it is written",
      }),
  handler: Effect.fn("Cli.jobs")(function* (args) {
    if (args.action === "list") {
      const all = jobs()
      if (all.length === 0) {
        UI.println('No background jobs. Start one with: bolt run --background "..."')
        return
      }
      for (const job of all) {
        const status = alive(job.pid) ? "running" : "stopped"
        const when = new Date(job.started).toLocaleString()
        UI.println(`${job.id}  ${status.padEnd(7)}  pid ${String(job.pid).padEnd(6)}  ${when}  ${job.command}`)
      }
      return
    }

    if (!args.id) return yield* fail(`pass a job id: bolt jobs ${args.action} <id>`)
    const job = find(args.id)
    if (!job) return yield* fail(`no job matching "${args.id}". Run: bolt jobs list`)

    if (args.action === "kill") {
      if (!alive(job.pid)) {
        UI.println(`Job ${job.id} is not running.`)
        return
      }
      killJob(job.pid)
      UI.println(`Killed job ${job.id} (pid ${job.pid}).`)
      return
    }

    if (!fs.existsSync(job.log)) return yield* fail(`no log file for job ${job.id}`)
    const text = yield* Effect.promise(() => Bun.file(job.log).text())
    if (text) process.stdout.write(text.endsWith("\n") ? text : `${text}\n`)
    if (!args.follow) return
    let offset = Buffer.byteLength(text)
    yield* Effect.callback<void>(() => {
      const watcher = fs.watch(path.dirname(job.log), (_, name) => {
        if (name !== path.basename(job.log)) return
        const size = fs.statSync(job.log, { throwIfNoEntry: false })?.size ?? 0
        if (size <= offset) {
          offset = size
          return
        }
        const stream = fs.createReadStream(job.log, { start: offset, end: size - 1, encoding: "utf8" })
        stream.on("data", (chunk) => process.stdout.write(chunk))
        offset = size
      })
      return Effect.sync(() => watcher.close())
    })
  }),
})
