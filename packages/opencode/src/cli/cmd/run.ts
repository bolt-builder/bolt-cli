import type { PermissionV1 } from "@opencode-ai/core/v1/permission"
import { FSUtil } from "@opencode-ai/core/fs-util"
// CLI entry point for `opencode run` and `opencode --mini`.
//
// Handles three modes:
//   1. Non-interactive (default): sends a single prompt, streams events to
//      stdout, and exits when the session goes idle.
//   2. Interactive local (`opencode --mini`): boots the split-footer direct mode
//      with an in-process server (no external HTTP).
//   3. Interactive attach (`opencode --mini --attach`): connects to a running
//      opencode server and runs interactive mode against it.
//
// Also supports `--command` for slash-command execution, `--format json` for
// raw event streaming, `--continue` / `--session` for session resumption,
// and `--fork` for forking before continuing.
import type { Argv } from "yargs"
import path from "path"
import { pathToFileURL } from "url"
import { open } from "node:fs/promises"
import { Effect } from "effect"
import { UI } from "../ui"
import { effectCmd, fail } from "../effect-cmd"
import { Envelope } from "../envelope"
import { ExitCode } from "../exit"
import { Porcelain } from "../porcelain"
import { EOL } from "os"
import { Filesystem } from "@/util/filesystem"
import { createOpencodeClient, type OpencodeClient, type ToolPart } from "@opencode-ai/sdk/v2"
import { FormatError, FormatUnknownError } from "../error"
import { INTERACTIVE_INPUT_ERROR, resolveInteractiveStdin } from "./run/runtime.stdin"
import { Budget } from "./run/budget"
import { OutputSchema } from "./run/schema"
import { Plan } from "./run/plan"
import { split } from "./run/attach"
import { Attempt } from "./run/attempt"
import { Report } from "./run/report"

type ModelInput = Parameters<OpencodeClient["session"]["prompt"]>[0]["model"]

function pick(value: string | undefined): ModelInput | "auto" | undefined {
  if (!value) return undefined
  if (value === "auto") return "auto"
  const [providerID, ...rest] = value.split("/")
  return {
    providerID,
    modelID: rest.join("/"),
  } as ModelInput
}

function resolveRunInput(value?: string, piped?: string): string | undefined {
  if (!value) {
    return piped
  }

  if (!piped) {
    return value
  }

  return value + "\n" + piped
}

type FilePart = {
  type: "file"
  url: string
  filename: string
  mime: string
}

const ATTACH_FILE_MAX_BYTES = 10 * 1024 * 1024

type Inline = {
  icon: string
  title: string
  description?: string
}

type SessionInfo = {
  id: string
  title?: string
  directory?: string
}

function inline(info: Inline) {
  const suffix = info.description ? UI.Style.TEXT_DIM + ` ${info.description}` + UI.Style.TEXT_NORMAL : ""
  UI.println(UI.Style.TEXT_NORMAL + info.icon, UI.Style.TEXT_NORMAL + info.title + suffix)
}

function block(info: Inline, output?: string) {
  UI.empty()
  inline(info)
  if (!output?.trim()) return
  UI.println(output)
  UI.empty()
}

function formatRunError(error: unknown) {
  return FormatError(error) ?? FormatUnknownError(error)
}

async function tool(part: ToolPart) {
  try {
    const { toolInlineInfo } = await import("./run/tool")
    const next = toolInlineInfo(part)
    if (next.mode === "block") {
      block(next, next.body)
      return
    }

    inline(next)
  } catch {
    inline({
      icon: "\u2699",
      title: part.tool,
    })
  }
}

async function toolError(part: ToolPart) {
  try {
    const { toolInlineInfo } = await import("./run/tool")
    const next = toolInlineInfo(part)
    inline({
      icon: "✗",
      title: `${next.title} failed`,
      ...(next.description && { description: next.description }),
    })
    return
  } catch {
    inline({
      icon: "✗",
      title: `${part.tool} failed`,
    })
  }
}

export const RunCommand = effectCmd({
  command: "run [message..]",
  describe: "run bolt with a message",
  // --attach with a URL and --host connect to a remote server (no local
  // instance needed); the default path runs an in-process server and needs
  // the project instance.
  instance: (args) => !split(args.attach).server && !args.host,
  // For --dir without a server attach, load instance for the resolved target
  // dir. The handler also chdirs (preserving the legacy order: chdir → file resolution).
  directory: (args) => (args.dir && !split(args.attach).server ? path.resolve(process.cwd(), args.dir) : process.cwd()),
  builder: (yargs: Argv) =>
    yargs
      .positional("message", {
        describe: "message to send",
        type: "string",
        array: true,
        default: [],
      })
      .option("command", {
        describe: "the command to run, use message for args",
        type: "string",
      })
      .option("continue", {
        alias: ["c"],
        describe: "continue the last session",
        type: "boolean",
      })
      .option("session", {
        alias: ["s"],
        describe: "session id to continue",
        type: "string",
      })
      .option("fork", {
        describe: "fork the session before continuing (requires --continue or --session)",
        type: "boolean",
      })
      .option("share", {
        type: "boolean",
        describe: "share the session",
      })
      .option("model", {
        type: "string",
        alias: ["m"],
        describe: "model to use in the format of provider/model (or 'auto' for cheapest available)",
      })
      .option("best-of", {
        type: "string",
        describe:
          "comma-separated provider/model list: run the same task on every model in parallel, rank the results with a judge (--model, or the first entry), keep the winner",
      })
      .option("agent", {
        type: "string",
        describe: "agent to use (or 'auto' for automatic selection)",
      })
      .option("auto-agent", {
        type: "boolean",
        default: false,
        describe: "route the prompt to the best matching agent based on agent descriptions",
      })
      .option("format", {
        type: "string",
        choices: ["default", "json"],
        default: "default",
        describe: "format: default (formatted) or json (raw JSON events)",
      })
      .option("json", {
        type: "boolean",
        default: false,
        describe: Envelope.DESCRIBE,
      })
      .option("porcelain", {
        type: "boolean",
        default: false,
        describe: Porcelain.DESCRIBE,
      })
      .option("emit", {
        type: "string",
        choices: ["context"],
        describe:
          "emit machine-consumable output on stdout after the run: 'context' prints the run's findings so they can be piped into another run (`bolt run ... --emit context | bolt run ...`)",
      })
      .option("file", {
        alias: ["f"],
        type: "string",
        array: true,
        describe: "file(s) to attach to message",
      })
      .option("title", {
        type: "string",
        describe: "title for the session (uses truncated prompt if no value provided)",
      })
      .option("max-cost", {
        type: "number",
        describe: "abort the run once its cost in USD reaches this budget",
      })
      .option("timeout", {
        type: "number",
        describe: "abort the run after this many seconds, capturing any partial result",
      })
      .option("retries", {
        type: "number",
        default: 0,
        describe: "retry a failed or timed-out run this many times",
      })
      .option("max-tokens", {
        type: "number",
        describe: "abort the run once its total token usage reaches this budget",
      })
      .option("output-schema", {
        type: "string",
        describe: "JSON Schema file the final answer must validate against (retries until it does, bounded)",
      })
      .option("cost-report", {
        type: "boolean",
        default: false,
        describe:
          "report per-run tokens, cache hits, dollars, and wall time to stderr (or as a cost_report JSON event)",
      })
      .option("attach", {
        type: "string",
        array: true,
        describe:
          "attach to a running bolt server (e.g., http://localhost:4096), or inject file/dir paths as context without mentioning them in the prompt (repeatable)",
      })
      .option("host", {
        type: "string",
        describe:
          "run the agent on a remote machine over ssh (e.g., ssh://dev-box); requires bolt preinstalled on the remote",
      })
      .option("voice", {
        type: "boolean",
        default: false,
        describe: "record a voice prompt and transcribe it locally with whisper.cpp (press Enter to stop)",
      })
      .option("password", {
        alias: ["p"],
        type: "string",
        describe: "basic auth password (defaults to OPENCODE_SERVER_PASSWORD)",
      })
      .option("username", {
        alias: ["u"],
        type: "string",
        describe: "basic auth username (defaults to OPENCODE_SERVER_USERNAME or 'opencode')",
      })
      .option("dir", {
        type: "string",
        describe: "directory to run in, path on remote server if attaching",
      })
      .option("port", {
        type: "number",
        describe: "port for the local server (defaults to random port if no value provided)",
      })
      .option("variant", {
        type: "string",
        describe: "model variant (provider-specific reasoning effort, e.g., high, max, minimal)",
      })
      .option("thinking", {
        type: "boolean",
        describe: "show thinking blocks",
      })
      .option("mini", {
        type: "boolean",
        hidden: true,
        default: false,
      })
      .option("replay", {
        type: "boolean",
        default: true,
        hidden: true,
        describe: "replay interactive session history on resume and after resize (use --no-replay to disable)",
      })
      .option("replay-limit", {
        type: "number",
        hidden: true,
        describe: "cap visible interactive replay to the newest N messages",
      })
      .option("interactive", {
        alias: ["i"],
        type: "boolean",
        describe: "run in direct interactive split-footer mode",
        default: false,
      })
      .option("auto", {
        type: "boolean",
        describe: "auto-approve permissions that are not explicitly denied (dangerous!)",
        default: false,
      })
      .option("dry-run", {
        type: "boolean",
        default: false,
        describe: "show every file write and command the plan would execute without doing it",
      })
      .option("plan-only", {
        type: "boolean",
        default: false,
        describe:
          "CI gate: dry-run the prompt, print the full intended diff and commands, and exit nonzero if anything looks destructive",
      })
      .option("background", {
        alias: ["bg"],
        type: "boolean",
        default: false,
        describe: "run detached as a background job (manage with bolt jobs list/tail/kill)",
      })
      .option("yolo", {
        type: "boolean",
        hidden: true,
        default: false,
      })
      .option("dangerously-skip-permissions", {
        type: "boolean",
        hidden: true,
        default: false,
      })
      .option("demo", {
        type: "boolean",
        default: false,
        hidden: true,
        describe: "enable direct interactive demo slash commands; pass one as the message to run it immediately",
      })
      .option("pair", {
        type: "boolean",
        default: false,
        hidden: true,
        describe: "render user prompts sent by other clients on the same session",
      })
      .epilogue(
        `exit codes: ${ExitCode.OK} success, ${ExitCode.ERROR} failure, ${ExitCode.BUDGET} budget hit (--max-cost/--max-tokens)`,
      ),
  handler: Effect.fn("Cli.run")(function* (args) {
    const attach = split(args.attach)
    if (attach.error) {
      UI.error(attach.error)
      process.exit(1)
    }
    if (args.background) {
      if (args.interactive || attach.server) {
        UI.error("--background cannot be used with --interactive or a server --attach")
        process.exit(1)
      }
      const { spawnJob } = yield* Effect.promise(() => import("./jobs"))
      const skip = new Set(["--background", "--bg"])
      const argv = process.argv.slice(2).filter((arg) => !skip.has(arg))
      const job = spawnJob(argv, process.cwd())
      UI.println(`Started background job ${job.id} (pid ${job.pid}).`)
      UI.println(`Tail it with: bolt jobs tail ${job.id} --follow`)
      return
    }
    if (args.host) {
      if (args.attach) {
        UI.error("--host cannot be used with --attach")
        process.exit(1)
      }
      const host = args.host
      const { Ssh } = yield* Effect.promise(() => import("../ssh"))
      const { errorMessage } = yield* Effect.promise(() => import("@/util/error"))
      const remote = yield* Effect.tryPromise({
        try: () => Ssh.connect({ host }),
        catch: (error) => errorMessage(error),
      }).pipe(Effect.catch((message) => fail(message)))
      // Reuse the whole --attach path: SDK, session, and streaming all work
      // through the forwarded local port.
      attach.server = remote.url
      UI.println(UI.Style.TEXT_DIM + `Running on ${host} via ${remote.url}` + UI.Style.TEXT_NORMAL)
    }
    const server = attach.server

    if (args.voice) {
      if (args.mini) {
        UI.error("--voice cannot be used with --mini")
        process.exit(1)
      }
      if (!process.stdin.isTTY) {
        UI.error("--voice requires a TTY stdin")
        process.exit(1)
      }
      const { CliVoice } = yield* Effect.promise(() => import("../voice"))
      const text = yield* CliVoice.capture()
      // Append the transcript to any message given on the command line.
      args.message = [...args.message, text]
    }
    const { Agent } = yield* Effect.promise(() => import("@/agent/agent"))
    const { RuntimeFlags } = yield* Effect.promise(() => import("@/effect/runtime-flags"))
    const { InstanceRef } = yield* Effect.promise(() => import("@/effect/instance-ref"))
    const { ServerAuth } = yield* Effect.promise(() => import("@/server/auth"))
    const agentSvc = yield* Agent.Service
    const flags = yield* RuntimeFlags.Service
    const localInstance = yield* InstanceRef
    yield* Effect.promise(async () => {
      const rawMessage = [...args.message, ...(args["--"] || [])].join(" ")
      const interactive = args.mini
      const auto = args.auto || args.yolo || args["dangerously-skip-permissions"]
      const thinking = interactive ? (args.thinking ?? true) : (args.thinking ?? false)
      const die = (message: string): never => {
        UI.error(message)
        process.exit(1)
      }
      const dieInteractive = (error: unknown): never => {
        if (error instanceof Error && error.message === INTERACTIVE_INPUT_ERROR) {
          die(error.message)
        }

        throw error
      }

      let message = [...args.message, ...(args["--"] || [])]
        .map((arg) => (arg.includes(" ") ? `"${arg.replace(/"/g, '\\"')}"` : arg))
        .join(" ")

      if (interactive && args.command) {
        die("--mini cannot be used with --command")
      }

      if (interactive && args._?.[0] !== "mini") {
        die("--mini must be used without the run subcommand")
      }

      if (args.demo && !interactive) {
        die("--demo requires --mini")
      }

      if (interactive && args.format === "json") {
        die("--mini cannot be used with --format json")
      }

      if (args.json && args.format === "json") {
        die("--json cannot be used with --format json")
      }

      if (args.json && interactive) {
        die("--json cannot be used with --mini")
      }

      if (args.json && args["best-of"]) {
        die("--json cannot be used with --best-of")
      }

      if (args.json && server) {
        die("--json cannot be used with a server --attach")
      }

      if (args.emit && args.json) {
        die("--emit cannot be used with --json")
      }

      if (args.emit && args.format === "json") {
        die("--emit cannot be used with --format json")
      }

      if (args.emit && interactive) {
        die("--emit cannot be used with --mini")
      }

      if (args.emit && args["best-of"]) {
        die("--emit cannot be used with --best-of")
      }

      if (args.emit && server) {
        die("--emit cannot be used with a server --attach")
      }

      if (args.porcelain && args.json) {
        die("--porcelain cannot be used with --json")
      }

      if (args.porcelain && args.format === "json") {
        die("--porcelain cannot be used with --format json")
      }

      if (args.porcelain && interactive) {
        die("--porcelain cannot be used with --mini")
      }

      if (args.porcelain && args["best-of"]) {
        die("--porcelain cannot be used with --best-of")
      }

      if (args["replay-limit"] !== undefined && !interactive) {
        die("--replay-limit requires --mini")
      }

      if (
        args["replay-limit"] !== undefined &&
        (!Number.isInteger(args["replay-limit"]) || args["replay-limit"] <= 0)
      ) {
        die("--replay-limit must be a positive integer")
      }

      if (interactive && !process.stdout.isTTY) {
        die("--mini requires a TTY stdout")
      }

      if (interactive) {
        try {
          resolveInteractiveStdin().cleanup?.()
        } catch (error) {
          dieInteractive(error)
        }
      }

      const replay = args.replay === false ? false : args.replay || args["replay-limit"] !== undefined

      const root = Filesystem.resolve(process.env.PWD ?? process.cwd())
      const directory = (() => {
        if (!args.dir) return server ? undefined : root
        if (server) return args.dir

        try {
          process.chdir(path.isAbsolute(args.dir) ? args.dir : path.join(root, args.dir))
          return process.cwd()
        } catch {
          UI.error("Failed to change directory to " + args.dir)
          process.exit(1)
        }
      })()
      const attachHeaders = server
        ? ServerAuth.headers({ password: args.password, username: args.username })
        : undefined
      const attachSDK = (baseUrl: string, dir?: string) => {
        return createOpencodeClient({
          baseUrl,
          directory: dir,
          headers: attachHeaders,
        })
      }

      const files: FilePart[] = []
      // Context paths passed via --attach ride the same file-part pipeline as
      // --file: they reach the model as attachments, never as prompt text.
      const list = [...(args.file ? (Array.isArray(args.file) ? args.file : [args.file]) : []), ...attach.paths]
      if (list.length > 0) {
        for (const filePath of list) {
          const resolvedPath = path.resolve(server ? root : (directory ?? root), filePath)
          if (!(await Filesystem.exists(resolvedPath))) {
            UI.error(`File not found: ${filePath}`)
            process.exit(1)
          }

          const stat = Filesystem.stat(resolvedPath)
          const isDirectory = stat?.isDirectory() ?? false
          if (server && isDirectory) {
            UI.error(`Cannot attach local directory without a shared filesystem: ${filePath}`)
            process.exit(1)
          }

          const content = await (async () => {
            if (!server) return
            const handle = await open(resolvedPath, "r")
            try {
              const opened = await handle.stat()
              if (!opened.isFile() || Number(opened.size) > ATTACH_FILE_MAX_BYTES) {
                UI.error(`Cannot attach local file larger than 10 MiB or a special file: ${filePath}`)
                process.exit(1)
              }
              if (opened.size === 0) return Buffer.alloc(0)
              const buffer = Buffer.alloc(Number(opened.size))
              let offset = 0
              while (offset < buffer.length) {
                const read = await handle.read(buffer, offset, buffer.length - offset, offset)
                if (read.bytesRead === 0) break
                offset += read.bytesRead
              }
              return buffer.subarray(0, offset)
            } finally {
              await handle.close()
            }
          })()
          const detected = FSUtil.mimeType(resolvedPath)
          const text = content?.toString("utf8")
          const mime = !server
            ? isDirectory
              ? "application/x-directory"
              : "text/plain"
            : content && text !== undefined && Buffer.from(text, "utf8").equals(content)
              ? "text/plain"
              : detected

          files.push({
            type: "file",
            url: content ? `data:${mime};base64,${content.toString("base64")}` : pathToFileURL(resolvedPath).href,
            filename: path.basename(resolvedPath),
            mime,
          })
        }
      }

      const { Stdin } = await import("../stdin")
      const piped = await Stdin.piped()
      message = resolveRunInput(message, piped) ?? ""
      const initialInput = resolveRunInput(rawMessage, piped)

      if (message.trim().length === 0 && !args.command && !interactive) {
        UI.error("You must provide a message or a command")
        process.exit(1)
      }

      if (args.fork && !args.continue && !args.session) {
        UI.error("--fork requires --continue or --session")
        process.exit(1)
      }

      if (args["best-of"]) {
        if (interactive) die("--best-of cannot be used with --mini")
        if (args.command) die("--best-of cannot be used with --command")
        if (args.session || args.continue || args.fork) die("--best-of always runs in fresh sessions")
      }

      const dry = args["dry-run"] || args["plan-only"]
      if (dry) {
        const flag = args["dry-run"] ? "--dry-run" : "--plan-only"
        if (interactive) die(`${flag} cannot be used with --mini`)
        if (args["best-of"]) die(`${flag} cannot be used with --best-of`)
        if (args.session || args.continue) die(`${flag} requires a fresh session`)
        if (args["plan-only"] && server) die("--plan-only cannot be used with a server --attach")
        if (args["plan-only"] && args.command) die("--plan-only cannot be used with --command")
        if (args.format !== "json") {
          UI.println(
            UI.Style.TEXT_INFO_BOLD + "→",
            UI.Style.TEXT_NORMAL,
            args["plan-only"]
              ? "Plan only: file writes and shell commands will be reported and gated, not executed"
              : "Dry run: file writes and shell commands will be reported, not executed",
          )
        }
      }

      const limits = { cost: args["max-cost"], tokens: args["max-tokens"] }
      if (limits.cost !== undefined && !(limits.cost > 0)) {
        die("--max-cost must be a positive number")
      }
      if (limits.tokens !== undefined && (!Number.isInteger(limits.tokens) || limits.tokens <= 0)) {
        die("--max-tokens must be a positive integer")
      }
      if (interactive && (limits.cost !== undefined || limits.tokens !== undefined)) {
        die("--mini cannot be used with --max-cost or --max-tokens")
      }
      if (args["cost-report"]) {
        if (interactive) die("--cost-report cannot be used with --mini")
        if (args["best-of"]) die("--cost-report cannot be used with --best-of")
        if (args.attach) die("--cost-report cannot be used with --attach")
      }

      const schema = await (async () => {
        if (!args["output-schema"]) return undefined
        if (interactive) die("--output-schema cannot be used with --mini")
        if (args.command) die("--output-schema cannot be used with --command")
        if (args["best-of"]) die("--output-schema cannot be used with --best-of")
        const file = Bun.file(path.resolve(root, args["output-schema"]))
        if (!(await file.exists())) die(`Schema file not found: ${args["output-schema"]}`)
        const parsed = OutputSchema.payload(await file.text())
        if (!parsed) return die(`Schema file is not valid JSON: ${args["output-schema"]}`)
        return parsed.value
      })()

      const bounds = { timeout: args.timeout, retries: args.retries }
      const invalid = Attempt.invalid(bounds)
      if (invalid) die(invalid)
      if (interactive && (args.timeout !== undefined || args.retries > 0)) {
        die("--mini cannot be used with --timeout or --retries")
      }
      if (args["best-of"] && (args.timeout !== undefined || args.retries > 0)) {
        die("--best-of cannot be used with --timeout or --retries")
      }

      if (args["auto-agent"]) {
        if (args.agent) die("--auto-agent cannot be used with --agent")
        if (interactive) die("--auto-agent cannot be used with --mini")
        if (server) die("--auto-agent cannot be used with --attach")
        if (args.command) die("--auto-agent cannot be used with --command")
        if (args["best-of"]) die("--auto-agent cannot be used with --best-of")
      }

      const rules: PermissionV1.Ruleset = interactive
        ? []
        : [
            {
              permission: "question",
              action: "deny",
              pattern: "*",
            },
            {
              permission: "plan_enter",
              action: "deny",
              pattern: "*",
            },
            {
              permission: "plan_exit",
              action: "deny",
              pattern: "*",
            },
          ]

      function title() {
        if (args.title === undefined) return
        if (args.title !== "") return args.title
        return message.slice(0, 50) + (message.length > 50 ? "..." : "")
      }

      async function session(sdk: OpencodeClient): Promise<SessionInfo | undefined> {
        if (args.session) {
          const current = await sdk.session
            .get({
              sessionID: args.session,
            })
            .catch(() => undefined)

          if (!current?.data) {
            UI.error("Session not found")
            process.exit(1)
          }

          if (args.fork) {
            const forked = await sdk.session.fork({
              sessionID: args.session,
            })
            const id = forked.data?.id
            if (!id) {
              return
            }

            return {
              id,
              title: forked.data?.title ?? current.data.title,
              directory: forked.data?.directory ?? current.data.directory,
            }
          }

          return {
            id: current.data.id,
            title: current.data.title,
            directory: current.data.directory,
          }
        }

        const base = args.continue ? (await sdk.session.list()).data?.find((item) => !item.parentID) : undefined

        if (base && args.fork) {
          const forked = await sdk.session.fork({
            sessionID: base.id,
          })
          const id = forked.data?.id
          if (!id) {
            return
          }

          return {
            id,
            title: forked.data?.title ?? base.title,
            directory: forked.data?.directory ?? base.directory,
          }
        }

        if (base) {
          return {
            id: base.id,
            title: base.title,
            directory: base.directory,
          }
        }

        const name = title()
        const result = await sdk.session.create({
          title: name,
          metadata: dry ? { dryrun: true } : undefined,
          permission: [...rules],
        })
        const id = result.data?.id
        if (!id) {
          return
        }

        return {
          id,
          title: result.data?.title ?? name,
          directory: result.data?.directory,
        }
      }

      async function share(sdk: OpencodeClient, sessionID: string) {
        const cfg = await sdk.config.get()
        if (!cfg.data) return
        if (cfg.data.share !== "auto" && !flags.autoShare && !args.share) return
        const res = await sdk.session.share({ sessionID }).catch((error) => {
          if (error instanceof Error && error.message.includes("disabled")) {
            UI.println(UI.Style.TEXT_DANGER_BOLD + "!  " + error.message)
          }
          return { error }
        })
        if (!res.error && "data" in res && res.data?.share?.url) {
          UI.println(UI.Style.TEXT_INFO_BOLD + "~  " + res.data.share.url)
        }
      }

      function resolveAutoModel(model: ModelInput | "auto" | undefined) {
        if (model !== "auto") return model
        UI.println(
          UI.Style.TEXT_INFO_BOLD + "→",
          UI.Style.TEXT_NORMAL,
          `Using server-side default model selection (cheapest available)`,
        )
        return undefined
      }

      async function createFreshSession(
        sdk: OpencodeClient,
        input: { agent: string | undefined; model: ModelInput | "auto" | undefined; variant: string | undefined },
      ): Promise<SessionInfo> {
        const resolvedModel = resolveAutoModel(input.model)
        const result = await sdk.session.create({
          title: args.title !== undefined && args.title !== "" ? args.title : undefined,
          metadata: dry ? { dryrun: true } : undefined,
          agent: input.agent,
          model: resolvedModel
            ? {
                providerID: resolvedModel.providerID,
                id: resolvedModel.modelID,
                variant: input.variant,
              }
            : undefined,
          permission: [...rules],
        })
        const id = result.data?.id
        if (!id) {
          throw new Error("Failed to create session")
        }

        void share(sdk, id).catch(() => {})
        return {
          id,
          title: result.data?.title,
        }
      }

      async function current(sdk: OpencodeClient): Promise<string> {
        if (!server) {
          return directory ?? root
        }

        const next = await sdk.path
          .get()
          .then((x) => x.data?.directory)
          .catch(() => undefined)
        if (next) {
          return next
        }

        UI.error("Failed to resolve remote directory")
        process.exit(1)
      }

      function handleAutoAgent(name: string): string | undefined {
        if (name === "auto") {
          UI.println(UI.Style.TEXT_INFO_BOLD + "→", UI.Style.TEXT_NORMAL, `Using default agent`)
          return undefined
        }
        return name
      }

      async function localAgent() {
        if (!args.agent) return undefined
        const name = handleAutoAgent(args.agent)
        if (!name) return undefined

        const entry = await Effect.runPromise(
          agentSvc.get(name).pipe(Effect.provideService(InstanceRef, localInstance)),
        )
        if (!entry) {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `agent "${name}" not found. Falling back to default agent`,
          )
          return undefined
        }
        if (entry.mode === "subagent") {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `agent "${name}" is a subagent, not a primary agent. Falling back to default agent`,
          )
          return undefined
        }
        return name
      }

      async function attachAgent(sdk: OpencodeClient) {
        if (!args.agent) return undefined
        const name = handleAutoAgent(args.agent)
        if (!name) return undefined

        const modes = await sdk.app
          .agents(undefined, { throwOnError: true })
          .then((x) => x.data ?? [])
          .catch(() => undefined)

        if (!modes) {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `failed to list agents from ${server}. Falling back to default agent`,
          )
          return undefined
        }

        const agent = modes.find((a) => a.name === name)
        if (!agent) {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `agent "${name}" not found. Falling back to default agent`,
          )
          return undefined
        }

        if (agent.mode === "subagent") {
          UI.println(
            UI.Style.TEXT_WARNING_BOLD + "!",
            UI.Style.TEXT_NORMAL,
            `agent "${name}" is a subagent, not a primary agent. Falling back to default agent`,
          )
          return undefined
        }

        return name
      }

      // Deterministic prompt routing (--auto-agent): score the prompt against
      // primary agent descriptions and fall back to the default agent when no
      // candidate is a confident match. The one-line explanation is suppressed
      // in --format json so machine output stays clean.
      async function routedAgent() {
        const { route, explain } = await import("./run/route")
        const infos = await Effect.runPromise(agentSvc.list().pipe(Effect.provideService(InstanceRef, localInstance)))
        const fallback = await Effect.runPromise(
          agentSvc.defaultAgent().pipe(Effect.provideService(InstanceRef, localInstance)),
        )
        const choice = route(
          message,
          infos
            .filter((info) => info.mode !== "subagent" && info.hidden !== true && info.name !== fallback)
            .map((info) => ({ name: info.name, description: info.description })),
        )
        if (args.format !== "json") {
          UI.println(UI.Style.TEXT_DIM + explain(choice, fallback) + UI.Style.TEXT_NORMAL)
        }
        return choice?.agent
      }

      async function pickAgent(sdk: OpencodeClient) {
        if (args["auto-agent"]) return routedAgent()
        if (!args.agent) return undefined
        if (server) {
          return attachAgent(sdk)
        }

        return localAgent()
      }

      async function execute(sdk: OpencodeClient) {
        if (args["best-of"]) {
          const { parseCandidates, runBestOf } = await import("./run/best-of")
          const candidates = parseCandidates(args["best-of"])
          if (typeof candidates === "string") return die(candidates)
          const resolvedModel = resolveAutoModel(pick(args.model))
          const exit = await runBestOf({
            sdk: server ? attachSDK(server, directory ?? (await current(sdk))) : sdk,
            candidates,
            judge: resolvedModel ?? candidates[0],
            message,
            parts: [...files, { type: "text", text: message }],
            agent: args.agent,
            variant: args.variant,
            permission: [...rules],
            json: args.format === "json",
          })
          if (exit) process.exitCode = exit
          return
        }
        const started = Date.now()
        let usage = Report.empty
        const sess = await session(sdk)
        if (!sess?.id) {
          UI.error("Session not found")
          process.exit(1)
        }
        const sessionID = sess.id
        // Final text parts collected for the --json envelope or --emit context, printed on finish.
        const collected: string[] = []
        // Porcelain records are frozen: kind first, then fields; see ../porcelain.ts.
        if (args.porcelain) Porcelain.print("session", sessionID)

        function emit(type: string, data: Record<string, unknown>) {
          if (args.format === "json") {
            process.stdout.write(
              JSON.stringify({
                type,
                timestamp: Date.now(),
                sessionID,
                ...data,
              }) + EOL,
            )
            return true
          }
          return false
        }

        const plan: Plan.Entry[] = []

        // Consume one subscribed event stream for the active session and mirror it
        // to stdout/UI. `client` is passed explicitly because attach mode may
        // rebind the SDK to the session's directory after the subscription is
        // created, and replies issued from inside the loop must use that client.
        async function loop(client: OpencodeClient, events: Awaited<ReturnType<typeof sdk.event.subscribe>>) {
          const toggles = new Map<string, boolean>()
          const sessions = new Set([sessionID])
          let error: string | undefined
          let budget = Budget.empty
          let breached = false

          for await (const event of events.stream) {
            if (event.type === "session.created" && event.properties.info.parentID) {
              if (sessions.has(event.properties.info.parentID)) sessions.add(event.properties.info.id)
            }

            if (
              event.type === "message.updated" &&
              event.properties.sessionID === sessionID &&
              event.properties.info.role === "assistant" &&
              args.format !== "json" &&
              toggles.get("start") !== true
            ) {
              UI.empty()
              UI.println(`> ${event.properties.info.agent} · ${event.properties.info.modelID}`)
              UI.empty()
              toggles.set("start", true)
            }

            if (event.type === "message.part.updated") {
              const part = event.properties.part
              if (part.sessionID !== sessionID) continue

              if (part.type === "tool" && (part.state.status === "completed" || part.state.status === "error")) {
                if (args["plan-only"]) {
                  const entry = Plan.collect(part)
                  if (entry) plan.push(entry)
                }
                if (emit("tool_use", { part })) continue
                if (args.porcelain) {
                  Porcelain.print("tool", part.tool, part.state.status)
                  continue
                }
                if (part.state.status === "completed") {
                  await tool(part)
                  continue
                }
                await toolError(part)
                UI.error(part.state.error)
              }

              if (
                part.type === "tool" &&
                part.tool === "task" &&
                part.state.status === "running" &&
                args.format !== "json" &&
                !args.porcelain
              ) {
                if (toggles.get(part.id) === true) continue
                await tool(part)
                toggles.set(part.id, true)
              }

              if (part.type === "step-start") {
                if (emit("step_start", { part })) continue
              }

              if (part.type === "step-finish") {
                budget = Budget.add(budget, part)
                if (args["cost-report"]) usage = Report.add(usage, part)
                const breach = Budget.exceeded(budget, limits)
                if (breach && !breached) {
                  breached = true
                  process.exitCode = ExitCode.BUDGET
                  if (args.porcelain) {
                    Porcelain.print("budget", breach)
                  } else if (!emit("budget_exceeded", { budget, message: breach })) {
                    UI.error(`${breach}; aborting the session`)
                  }
                  await client.session.abort({ sessionID }).catch(() => {
                    // best-effort abort: the breach is already reported and the exit code is set
                  })
                }
                if (emit("step_finish", { part })) continue
              }

              if (part.type === "text" && part.time?.end) {
                if (emit("text", { part })) continue
                const text = part.text.trim()
                if (!text) continue
                if (args.json || args.emit === "context") {
                  collected.push(text)
                  continue
                }
                if (args.porcelain) {
                  Porcelain.print("text", text)
                  continue
                }
                if (!process.stdout.isTTY) {
                  process.stdout.write(text + EOL)
                  continue
                }
                UI.empty()
                UI.println(text)
                UI.empty()
              }

              if (part.type === "reasoning" && part.time?.end && thinking) {
                if (emit("reasoning", { part })) continue
                if (args.json) continue
                const text = part.text.trim()
                if (!text) continue
                if (args.porcelain) {
                  Porcelain.print("reasoning", text)
                  continue
                }
                const line = `Thinking: ${text}`
                if (process.stdout.isTTY) {
                  UI.empty()
                  UI.println(`${UI.Style.TEXT_DIM}\u001b[3m${line}\u001b[0m${UI.Style.TEXT_NORMAL}`)
                  UI.empty()
                  continue
                }
                process.stdout.write(line + EOL)
              }
            }

            if (event.type === "session.error") {
              const props = event.properties
              if (props.sessionID !== sessionID || !props.error) continue
              let err = String(props.error.name)
              if ("data" in props.error && props.error.data && "message" in props.error.data) {
                err = String(props.error.data.message)
              }
              error = error ? error + EOL + err : err
              if (emit("error", { error: props.error })) continue
              if (args.porcelain) {
                Porcelain.print("error", err)
                continue
              }
              UI.error(err)
            }

            if (
              event.type === "session.status" &&
              event.properties.sessionID === sessionID &&
              event.properties.status.type === "idle"
            ) {
              break
            }

            if (event.type === "permission.asked") {
              const permission = event.properties
              if (!sessions.has(permission.sessionID)) continue

              if (auto) {
                await client.permission.reply({
                  requestID: permission.id,
                  reply: "once",
                })
              } else {
                UI.println(
                  UI.Style.TEXT_WARNING_BOLD + "!",
                  UI.Style.TEXT_NORMAL +
                    `permission requested: ${permission.permission} (${permission.patterns.join(", ")}); auto-rejecting`,
                )
                await client.permission.reply({
                  requestID: permission.id,
                  reply: "reject",
                })
              }
            }
          }
          return error
        }
        const cwd = server ? (directory ?? sess.directory ?? (await current(sdk))) : (directory ?? root)
        const client = server ? attachSDK(server, cwd) : sdk

        // Validate agent if specified
        const agent = await pickAgent(client)

        // Resolve auto model selection
        const resolvedModel = resolveAutoModel(pick(args.model))

        await share(client, sessionID)

        if (!interactive) {
          const events = await client.event.subscribe()
          const completed = loop(client, events).catch((e) => {
            console.error(e)
            process.exitCode = 1
          })
          async function finish() {
            if (server) return
            const error = await completed
            // Do not clobber a more specific class (e.g. a budget breach) already set by the loop.
            if (error && !process.exitCode) process.exitCode = ExitCode.ERROR
            if (args["plan-only"]) {
              const findings = Plan.verdict(plan)
              if (!emit("plan", { entries: plan, findings })) {
                UI.empty()
                UI.println(Plan.render(plan))
                UI.empty()
                for (const finding of findings) {
                  UI.error(`destructive ${finding.entry.kind}: ${finding.entry.detail} (${finding.reason})`)
                }
                if (findings.length === 0) UI.println("Plan gate: nothing destructive detected.")
              }
              if (findings.length > 0) process.exitCode = ExitCode.GATE
            }
            if (args["cost-report"]) {
              const wall = Date.now() - started
              if (!emit("cost_report", Report.json(usage, wall))) {
                process.stderr.write(Report.render(usage, wall) + EOL)
              }
            }
            if (args.json) {
              if (error) {
                Envelope.printError("SessionError", error)
                return
              }
              Envelope.print({ sessionID, text: collected.join("\n\n") })
              return
            }
            if (args.emit !== "context") return
            const { context } = await import("./run/emit")
            process.stdout.write(context(sessionID, collected) + EOL)
          }

          // Race one attempt against the --timeout clock. The work promise is
          // silenced when the clock wins so a late rejection stays handled.
          async function bounded<T>(work: Promise<T>): Promise<T | "timeout"> {
            if (!args.timeout) return work
            let handle: ReturnType<typeof setTimeout> | undefined
            const clock = new Promise<"timeout">((resolve) => {
              handle = setTimeout(() => resolve("timeout"), args.timeout! * 1000)
            })
            const raced = await Promise.race([work, clock])
            if (handle !== undefined) clearTimeout(handle)
            if (raced === "timeout") void Promise.resolve(work).catch(() => {})
            return raced
          }

          // Abort the timed-out attempt and surface whatever partial result
          // the assistant already produced.
          async function timedOut(index: number) {
            await client.session.abort({ sessionID }).catch(() => {
              // best-effort abort: the timeout is already reported
            })
            const messages = await client.session.messages({ sessionID }).catch(() => undefined)
            const text = Attempt.partial(messages?.data ?? [])
            if (emit("timeout", { attempt: index, attempts: Attempt.attempts(bounds), partial: text })) return
            UI.error(Attempt.report(index, bounds))
            if (!text) return
            UI.println("Partial result before the timeout:")
            UI.empty()
            UI.println(text)
            UI.empty()
          }

          // Send the prompt or command, retrying failed and timed-out
          // attempts while the --retries budget lasts.
          async function deliver<T extends { error?: unknown }>(
            label: string,
            send: () => Promise<T>,
          ): Promise<{ result: T; index: number } | undefined> {
            for (let index = 1; ; index++) {
              const result = await bounded(send())
              if (result === "timeout") {
                await timedOut(index)
                if (Attempt.again(index, bounds)) continue
                process.exitCode = ExitCode.TIMEOUT
                return undefined
              }
              if (result.error) {
                if (args.json && !Attempt.again(index, bounds)) {
                  Envelope.printError(label, formatRunError(result.error))
                  process.exitCode = ExitCode.ERROR
                  return undefined
                }
                if (!emit("error", { error: result.error })) UI.error(formatRunError(result.error))
                if (Attempt.again(index, bounds)) {
                  if (args.format !== "json") {
                    UI.println(
                      UI.Style.TEXT_WARNING_BOLD + "!",
                      UI.Style.TEXT_NORMAL + `attempt ${index}/${Attempt.attempts(bounds)} failed; retrying`,
                    )
                  }
                  continue
                }
                process.exitCode = ExitCode.ERROR
                return undefined
              }
              return { result, index }
            }
          }

          if (args.command) {
            const done = await deliver("CommandError", () =>
              client.session.command({
                sessionID,
                agent,
                model: resolvedModel ? `${resolvedModel.providerID}/${resolvedModel.modelID}` : undefined,
                command: args.command!,
                arguments: message,
                variant: args.variant,
              }),
            )
            if (!done) return
            await finish()
            // the run succeeded on a retry; earlier attempts must not fail the exit code
            if (done.index > 1) process.exitCode = 0
            return
          }

          const done = await deliver("PromptError", () =>
            client.session.prompt({
              sessionID,
              agent,
              model: resolvedModel,
              variant: args.variant,
              parts: [
                ...files,
                { type: "text", text: schema ? `${message}\n\n${OutputSchema.instructions(schema)}` : message },
              ],
            }),
          )
          if (!done) return
          const result = done.result
          if (done.index > 1 && args.format !== "json") {
            // the event loop ended when the first attempt went idle, so print the retried answer here
            const parts = result.data?.parts ?? []
            const retried = parts.findLast((part) => part.type === "text")?.text?.trim()
            if (retried && process.stdout.isTTY) {
              UI.empty()
              UI.println(retried)
              UI.empty()
            }
            if (retried && !process.stdout.isTTY) process.stdout.write(retried + EOL)
          }
          await finish()
          // the run succeeded on a retry; earlier attempts must not fail the exit code
          if (done.index > 1) process.exitCode = 0
          if (schema === undefined) return

          // Validate the final answer against the schema, re-prompting with the
          // validation errors until it passes or the attempt budget runs out.
          const answer = (parts: { type: string; text?: string }[]) =>
            parts.findLast((part) => part.type === "text")?.text ?? ""
          let text = answer(result.data?.parts ?? [])
          for (let attempt = 1; ; attempt++) {
            const value = OutputSchema.payload(text)
            const errors = value ? OutputSchema.validate(schema, value.value) : ["$: the answer is not valid JSON"]
            if (value && errors.length === 0) {
              emit("schema_valid", { attempt, value: value.value })
              return
            }
            if (attempt >= OutputSchema.ATTEMPTS) {
              process.exitCode = 1
              if (emit("schema_invalid", { attempt, errors })) return
              UI.error(`The answer failed schema validation after ${attempt} attempts`)
              for (const error of errors) UI.error(error)
              return
            }
            if (!emit("schema_retry", { attempt, errors })) {
              UI.println(
                UI.Style.TEXT_WARNING_BOLD + "!",
                UI.Style.TEXT_NORMAL +
                  `answer failed schema validation (attempt ${attempt}/${OutputSchema.ATTEMPTS}); retrying`,
              )
            }
            const retry = await client.session.prompt({
              sessionID,
              agent,
              model: resolvedModel,
              variant: args.variant,
              parts: [{ type: "text", text: OutputSchema.feedback(errors) }],
            })
            if (retry.error) {
              if (!emit("error", { error: retry.error })) UI.error(formatRunError(retry.error))
              process.exitCode = 1
              return
            }
            text = answer(retry.data?.parts ?? [])
            // The event loop ended at the first idle, so print retry answers here.
            if (text.trim() && args.format !== "json") {
              if (process.stdout.isTTY) {
                UI.empty()
                UI.println(text.trim())
                UI.empty()
              }
              if (!process.stdout.isTTY) process.stdout.write(text.trim() + EOL)
            }
          }
        }

        const { runInteractiveMode } = await import("./run/runtime")
        try {
          await runInteractiveMode({
            sdk: client,
            directory: cwd,
            sessionID,
            sessionTitle: sess.title,
            resume: Boolean(args.session || args.continue) && !args.fork,
            pair: args.pair,
            replay,
            replayLimit: args["replay-limit"],
            agent,
            model: resolvedModel,
            variant: args.variant,
            files,
            initialInput,
            createSession: createFreshSession,
            thinking,
            backgroundSubagents: flags.experimentalBackgroundSubagents,
            demo: args.demo,
          })
        } catch (error) {
          dieInteractive(error)
        }
        return
      }

      const { ServerLocalFetch } = await import("@/server/local-fetch")
      const fetchFn = ServerLocalFetch.fetchFn

      if (interactive && !server && !args.session && !args.continue) {
        const model = pick(args.model)
        const resolvedModel = model === "auto" ? undefined : model
        const { runInteractiveLocalMode } = await import("./run/runtime")

        try {
          return await runInteractiveLocalMode({
            directory: directory ?? root,
            fetch: fetchFn,
            resolveAgent: localAgent,
            session,
            share,
            createSession: createFreshSession,
            agent: args.agent,
            model: resolvedModel,
            variant: args.variant,
            replay,
            replayLimit: args["replay-limit"],
            files,
            initialInput,
            thinking,
            backgroundSubagents: flags.experimentalBackgroundSubagents,
            demo: args.demo,
          })
        } catch (error) {
          dieInteractive(error)
        }
      }

      if (server) {
        const sdk = attachSDK(server, directory)
        return await execute(sdk)
      }

      // Route one-shot prompts through a running `bolt daemon` so they reuse
      // its warm server instead of booting one in-process. A stale or
      // unreachable record falls back to the in-process server below.
      const { Daemon } = await import("../daemon")
      const daemon = await Daemon.detect()
      if (daemon) {
        const { ServerAuth } = await import("@/server/auth")
        const sdk = createOpencodeClient({
          baseUrl: daemon.url,
          headers: ServerAuth.headers(),
          directory,
        })
        return await execute(sdk)
      }

      const sdk = createOpencodeClient({
        baseUrl: "http://opencode.internal",
        fetch: fetchFn,
        directory,
      })
      await execute(sdk)
    })
  }),
})

type MiniCommandInput = {
  directory?: string
  attach?: string
  password?: string
  username?: string
  continue?: boolean
  session?: string
  fork?: boolean
  model?: string
  agent?: string
  prompt?: string
  replay?: boolean
  replayLimit?: number
  demo?: boolean
  pair?: boolean
}

export async function runMini(input: MiniCommandInput) {
  if (!RunCommand.handler) throw new Error("Mini command handler is unavailable")
  await RunCommand.handler({
    $0: "opencode",
    _: ["mini"],
    message: input.prompt ? [input.prompt] : [],
    command: undefined,
    continue: input.continue,
    session: input.session,
    fork: input.fork,
    share: undefined,
    model: input.model,
    "best-of": undefined,
    bestOf: undefined,
    "max-cost": undefined,
    maxCost: undefined,
    "max-tokens": undefined,
    maxTokens: undefined,
    "output-schema": undefined,
    outputSchema: undefined,
    timeout: undefined,
    retries: 0,
    "cost-report": false,
    costReport: false,
    agent: input.agent,
    "auto-agent": false,
    autoAgent: false,
    format: "default",
    json: false,
    emit: undefined,
    porcelain: false,
    file: undefined,
    title: undefined,
    attach: input.attach ? [input.attach] : undefined,
    host: undefined,
    voice: false,
    password: input.password,
    username: input.username,
    dir: input.directory,
    port: undefined,
    variant: undefined,
    thinking: undefined,
    mini: true,
    interactive: false,
    replay: input.replay ?? true,
    "replay-limit": input.replayLimit,
    replayLimit: input.replayLimit,
    auto: false,
    background: false,
    "dry-run": false,
    dryRun: false,
    "plan-only": false,
    planOnly: false,
    yolo: false,
    "dangerously-skip-permissions": false,
    dangerouslySkipPermissions: false,
    demo: input.demo ?? false,
    pair: input.pair ?? false,
  })
}
