import type { Argv } from "yargs"
import { Effect, Option } from "effect"
import { cmd } from "./cmd"
import { effectCmd, fail } from "../effect-cmd"
import type { Session } from "@/session/session"
import { UI } from "../ui"
import { Locale } from "@/util/locale"
import { Flag } from "@opencode-ai/core/flag/flag"
import { Filesystem } from "@/util/filesystem"
import { Process } from "@/util/process"
import { EOL } from "os"
import path from "path"
import { which } from "@opencode-ai/core/util/which"

function pagerCmd(): string[] {
  const lessOptions = ["-R", "-S"]
  if (process.platform !== "win32") {
    return ["less", ...lessOptions]
  }

  // user could have less installed via other options
  const lessOnPath = which("less")
  if (lessOnPath) {
    if (Filesystem.stat(lessOnPath)?.size) return [lessOnPath, ...lessOptions]
  }

  if (Flag.OPENCODE_GIT_BASH_PATH) {
    const less = path.join(Flag.OPENCODE_GIT_BASH_PATH, "..", "..", "usr", "bin", "less.exe")
    if (Filesystem.stat(less)?.size) return [less, ...lessOptions]
  }

  const git = which("git")
  if (git) {
    const less = path.join(git, "..", "..", "usr", "bin", "less.exe")
    if (Filesystem.stat(less)?.size) return [less, ...lessOptions]
  }

  // Fall back to Windows built-in more (via cmd.exe)
  return ["cmd", "/c", "more"]
}

export const SessionCommand = cmd({
  command: "session",
  aliases: ["sessions"],
  describe: "manage sessions",
  builder: (yargs: Argv) =>
    yargs
      .command(SessionListCommand)
      .command(SessionDeleteCommand)
      .command(SessionBranchCommand)
      .command(SessionTagCommand)
      .command(SessionPruneCommand)
      .demandCommand(),
  async handler() {},
})

// Reads the tag list from session metadata, tolerating foreign shapes.
export function tags(metadata: Session.Info["metadata"]): string[] {
  const value = metadata?.["tags"]
  if (!Array.isArray(value)) return []
  return value.filter((item): item is string => typeof item === "string")
}

// Adds or removes tags, deduplicating while preserving order.
export function toggle(current: string[], input: string[], remove: boolean): string[] {
  if (remove) return current.filter((tag) => !input.includes(tag))
  return [...new Set([...current, ...input])]
}

const tagArgs = <T>(yargs: Argv<T>) =>
  yargs
    .positional("sessionID", {
      describe: "session id to tag",
      type: "string",
      demandOption: true,
    })
    .positional("tags", {
      describe: "tags to add; omit to list the session's tags",
      type: "string",
      array: true,
      default: [] as string[],
    })
    .option("remove", {
      describe: "remove the given tags instead of adding them",
      type: "boolean",
      default: false,
    })

const tagHandler = Effect.fn("Cli.session.tag")(function* (args: {
  sessionID: string
  tags: string[]
  remove: boolean
}) {
  const { Session } = yield* Effect.promise(() => import("@/session/session"))
  const { SessionID } = yield* Effect.promise(() => import("@/session/schema"))
  const { NotFoundError } = yield* Effect.promise(() => import("@/storage/storage"))
  const svc = yield* Session.Service
  const sessionID = SessionID.make(args.sessionID)
  const session = yield* svc
    .get(sessionID)
    .pipe(Effect.catchIf(NotFoundError.isInstance, () => fail(`Session not found: ${args.sessionID}`)))

  const input = args.tags.map((tag) => tag.trim()).filter((tag) => tag.length > 0)
  const current = tags(session.metadata)

  if (input.length === 0) {
    if (args.remove) return yield* fail("Pass at least one tag to remove")
    if (current.length === 0) {
      UI.println("No tags")
      return
    }
    for (const tag of current) UI.println(tag)
    return
  }

  const updated = toggle(current, input, args.remove)
  const metadata = { ...session.metadata }
  if (updated.length > 0) metadata["tags"] = updated
  if (updated.length === 0) delete metadata["tags"]
  yield* svc.setMetadata({ sessionID, metadata })
  UI.println(
    UI.Style.TEXT_SUCCESS_BOLD +
      `Tags for ${sessionID}: ` +
      UI.Style.TEXT_NORMAL +
      (updated.length > 0 ? updated.join(", ") : "(none)"),
  )
})

export const SessionTagCommand = effectCmd({
  command: "tag <sessionID> [tags..]",
  describe: "add, remove, or list session tags",
  builder: tagArgs,
  handler: tagHandler,
})

// Top-level `bolt tag <id> billing-bug` alias for the session subcommand.
export const TagCommand = effectCmd({
  command: "tag <sessionID> [tags..]",
  describe: "tag a session (alias of session tag)",
  builder: tagArgs,
  handler: tagHandler,
})

// Retention boundary: sessions last updated before this timestamp are stale.
export function cutoff(days: number, now: number): number | undefined {
  if (!Number.isFinite(days) || days <= 0) return undefined
  return now - days * 86_400_000
}

const page = 100

export const SessionPruneCommand = effectCmd({
  command: "prune",
  describe: "archive sessions older than a retention window",
  builder: (yargs) =>
    yargs
      .option("days", {
        describe: "archive sessions not updated in this many days",
        type: "number",
        default: 30,
      })
      .option("dry-run", {
        describe: "list the sessions that would be archived without archiving them",
        type: "boolean",
        default: false,
      }),
  handler: Effect.fn("Cli.session.prune")(function* (args) {
    const { Session } = yield* Effect.promise(() => import("@/session/session"))
    const svc = yield* Session.Service
    const boundary = cutoff(args.days, Date.now())
    if (boundary === undefined) return yield* fail("--days must be a positive number")

    // listGlobal's cursor is an exclusive time_updated upper bound and already
    // skips archived sessions, so paging from the boundary yields exactly the
    // stale root sessions across every project.
    const stale: Session.Info[] = []
    let cursor = boundary
    while (true) {
      const found = yield* svc.listGlobal({ roots: true, limit: page, cursor })
      if (found.length === 0) break
      stale.push(...found)
      if (found.length < page) break
      cursor = found[found.length - 1].time.updated
    }

    if (stale.length === 0) {
      UI.println(`No sessions older than ${args.days} days`)
      return
    }

    for (const session of stale) {
      const verb = args.dryRun ? "would archive" : "archiving"
      UI.println(`${verb} ${session.id}  ${Locale.todayTimeOrDateTime(session.time.updated)}  ${session.title}`)
      if (!args.dryRun) yield* svc.setArchived({ sessionID: session.id, time: Date.now() })
    }
    const summary = args.dryRun
      ? `Would archive ${stale.length} session(s) older than ${args.days} days`
      : `Archived ${stale.length} session(s) older than ${args.days} days`
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + summary + UI.Style.TEXT_NORMAL)
  }),
})

export const SessionBranchCommand = effectCmd({
  command: "branch <sessionID> [messageID]",
  describe: "branch a session into a new one sharing its prefix",
  builder: (yargs) =>
    yargs
      .positional("sessionID", {
        describe: "session ID to branch from",
        type: "string",
        demandOption: true,
      })
      .positional("messageID", {
        describe: "branch at this message (inclusive); defaults to the full history",
        type: "string",
      }),
  handler: Effect.fn("Cli.session.branch")(function* (args) {
    // Loaded lazily so the CLI entrypoint does not pull the session graph at
    // startup for unrelated commands.
    const { Session } = yield* Effect.promise(() => import("@/session/session"))
    const { SessionBranch } = yield* Effect.promise(() => import("@/session/branch"))
    const { MessageID, SessionID } = yield* Effect.promise(() => import("../../session/schema"))
    const { NotFoundError } = yield* Effect.promise(() => import("@/storage/storage"))
    const svc = yield* Session.Service
    const sessionID = SessionID.make(args.sessionID)
    const messages = yield* svc
      .messages({ sessionID })
      .pipe(Effect.catchIf(NotFoundError.isInstance, () => fail(`Session not found: ${args.sessionID}`)))
    const split = SessionBranch.boundary(messages, args.messageID ? MessageID.make(args.messageID) : undefined)
    if (!split) return yield* fail(`Message not found in session: ${args.messageID}`)
    const session = yield* svc
      .fork({ sessionID, messageID: split.fork })
      .pipe(Effect.catchIf(NotFoundError.isInstance, () => fail(`Session not found: ${args.sessionID}`)))
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Branched into ${session.id}` + UI.Style.TEXT_NORMAL + ` ${session.title}`)
  }),
})

export const SessionDeleteCommand = effectCmd({
  command: "delete <sessionID>",
  describe: "delete a session",
  builder: (yargs) =>
    yargs.positional("sessionID", {
      describe: "session ID to delete",
      type: "string",
      demandOption: true,
    }),
  handler: Effect.fn("Cli.session.delete")(function* (args) {
    const { Session } = yield* Effect.promise(() => import("@/session/session"))
    const { SessionID } = yield* Effect.promise(() => import("../../session/schema"))
    const { NotFoundError } = yield* Effect.promise(() => import("@/storage/storage"))
    const svc = yield* Session.Service
    const sessionID = SessionID.make(args.sessionID)
    yield* svc
      .remove(sessionID)
      .pipe(Effect.catchIf(NotFoundError.isInstance, () => fail(`Session not found: ${args.sessionID}`)))
    UI.println(UI.Style.TEXT_SUCCESS_BOLD + `Session ${args.sessionID} deleted` + UI.Style.TEXT_NORMAL)
  }),
})

// Parses --since values: relative durations like 30m, 24h, 7d, 2w, or any Date.parse-able date.
export function since(value: string, now: number): number | undefined {
  const relative = value.match(/^(\d+)([mhdw])$/)
  if (relative) {
    const units = { m: 60_000, h: 3_600_000, d: 86_400_000, w: 604_800_000 }
    return now - parseInt(relative[1], 10) * units[relative[2] as keyof typeof units]
  }
  const parsed = Date.parse(value)
  if (Number.isNaN(parsed)) return undefined
  return parsed
}

export function order(sessions: Session.Info[], key?: string): Session.Info[] {
  const sorted = [...sessions]
  if (key === "created") return sorted.sort((a, b) => b.time.created - a.time.created)
  if (key === "title") return sorted.sort((a, b) => a.title.localeCompare(b.title))
  if (key === "cost") return sorted.sort((a, b) => (b.cost ?? 0) - (a.cost ?? 0))
  return sorted.sort((a, b) => b.time.updated - a.time.updated)
}

export const SessionListCommand = effectCmd({
  command: "list",
  aliases: ["ls"],
  describe: "list sessions",
  builder: (yargs) =>
    yargs
      .option("max-count", {
        alias: "n",
        describe: "limit to N most recent sessions",
        type: "number",
      })
      .option("since", {
        describe: "only sessions updated after this date or relative duration (e.g. 24h, 7d)",
        type: "string",
      })
      .option("project", {
        describe: "search all projects, filtered by project name, worktree path, or id substring",
        type: "string",
      })
      .option("failed", {
        describe: "only sessions whose latest assistant message ended in an error",
        type: "boolean",
        default: false,
      })
      .option("sort", {
        describe: "sort order",
        type: "string",
        choices: ["updated", "created", "title", "cost"],
        default: "updated",
      })
      .option("json", {
        describe: "output as JSON (same as --format json)",
        type: "boolean",
        default: false,
      })
      .option("tag", {
        describe: "only sessions carrying this tag",
        type: "string",
      })
      .option("format", {
        describe: "output format",
        type: "string",
        choices: ["table", "json"],
        default: "table",
      }),
  handler: Effect.fn("Cli.session.list")(function* (args) {
    const { Session } = yield* Effect.promise(() => import("@/session/session"))
    const { NotFoundError } = yield* Effect.promise(() => import("@/storage/storage"))
    const svc = yield* Session.Service
    const start = args.since ? since(args.since, Date.now()) : undefined
    if (args.since && start === undefined) return yield* fail(`Invalid --since value: ${args.since}`)

    const found = yield* Effect.gen(function* () {
      if (args.project === undefined) return yield* svc.list({ roots: true, limit: args.maxCount, start })
      const needle = args.project.toLowerCase()
      const global = yield* svc.listGlobal({ roots: true, limit: args.maxCount, start })
      return global.filter((session) => {
        if (session.projectID.toLowerCase().includes(needle)) return true
        if (!session.project) return false
        if (session.project.name?.toLowerCase().includes(needle)) return true
        return session.project.worktree.toLowerCase().includes(needle)
      })
    })

    const failed = yield* Effect.forEach(
      found,
      (session) =>
        Effect.gen(function* () {
          if (!args.failed) return session
          const last = yield* svc
            .findMessage(session.id, (msg) => msg.info.role === "assistant")
            .pipe(Effect.catchIf(NotFoundError.isInstance, () => Effect.succeedNone))
          if (Option.isNone(last)) return undefined
          const info = last.value.info
          return info.role === "assistant" && info.error !== undefined ? session : undefined
        }),
      { concurrency: 10 },
    ).pipe(Effect.map((items) => items.filter((item) => item !== undefined)))

    const tagged = args.tag ? failed.filter((session) => tags(session.metadata).includes(args.tag!)) : failed
    const sessions = order(tagged, args.sort)

    if (sessions.length === 0) {
      UI.println(
        UI.Style.TEXT_DIM +
          "No sessions in this project yet. Sessions are stored per project directory; run this from the directory where you used bolt." +
          UI.Style.TEXT_NORMAL,
      )
      return
    }

    const json = args.json || args.format === "json"
    const output = json ? formatSessionJSON(sessions) : formatSessionTable(sessions)

    const shouldPaginate = process.stdout.isTTY && !args.maxCount && !json

    if (shouldPaginate) {
      yield* Effect.promise(async () => {
        const proc = Process.spawn(pagerCmd(), {
          stdin: "pipe",
          stdout: "inherit",
          stderr: "inherit",
        })

        if (!proc.stdin) {
          console.log(output)
          return
        }

        proc.stdin.write(output)
        proc.stdin.end()
        await proc.exited
      })
    } else {
      console.log(output)
    }
  }),
})

function formatSessionTable(sessions: Session.Info[]): string {
  const lines: string[] = []

  const maxIdWidth = Math.max(20, ...sessions.map((s) => s.id.length))
  const maxTitleWidth = Math.max(25, ...sessions.map((s) => s.title.length))

  const header = `Session ID${" ".repeat(maxIdWidth - 10)}  Title${" ".repeat(maxTitleWidth - 5)}  Updated`
  lines.push(header)
  lines.push("─".repeat(header.length))
  for (const session of sessions) {
    const truncatedTitle = Locale.truncate(session.title, maxTitleWidth)
    const timeStr = Locale.todayTimeOrDateTime(session.time.updated)
    const line = `${session.id.padEnd(maxIdWidth)}  ${truncatedTitle.padEnd(maxTitleWidth)}  ${timeStr}`
    lines.push(line)
  }

  return lines.join(EOL)
}

function formatSessionJSON(sessions: Session.Info[]): string {
  const jsonData = sessions.map((session) => ({
    id: session.id,
    title: session.title,
    updated: session.time.updated,
    created: session.time.created,
    projectId: session.projectID,
    directory: session.directory,
    tags: tags(session.metadata),
  }))
  return JSON.stringify(jsonData, null, 2)
}
