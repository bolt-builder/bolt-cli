import { Argument, Flag, GlobalFlag } from "effect/cli"
import { Schema } from "effect"
import { CliFlag } from "../framework/flag"
import { Spec } from "../framework/spec"
import { Updater } from "../services/updater"

export const PrintLogs = GlobalFlag.Setting("print-logs")({
  flag: Flag.Boolean("print-logs").pipe(
    Flag.withDescription("Print logs to stderr (server logs require --standalone)"),
    Flag.withDefault(false),
  ),
})

export const Standalone = GlobalFlag.Setting("standalone")({
  flag: Flag.Boolean("standalone").pipe(
    Flag.withDescription("Run with a private server instead of the background service"),
    Flag.withDefault(false),
  ),
})

export const Server = GlobalFlag.Setting("server")({
  flag: Flag.String("server").pipe(
    Flag.withDescription("Connect to a server URL instead of the background service"),
    Flag.optional,
  ),
})

const ServerFlags = [Standalone, Server] as const

declare const OPENCODE_CLI_NAME: string | undefined

const ServerParams = {
  standalone: Standalone.flag,
  server: Server.flag,
}

const PermissionParams = {
  auto: Flag.Boolean("auto").pipe(
    Flag.withDescription("Auto-approve permissions that are not explicitly denied"),
    Flag.withDefault(false),
  ),
  yolo: Flag.Boolean("yolo").pipe(Flag.withDefault(false), Flag.withHidden),
  dangerouslySkipPermissions: Flag.Boolean("dangerously-skip-permissions").pipe(
    Flag.withDefault(false),
    Flag.withHidden,
  ),
}

const ExportParams = {
  session: Argument.String("session").pipe(Argument.withDescription("Session ID to export"), Argument.optional),
  sanitize: Flag.Boolean("sanitize").pipe(
    Flag.withDescription("Redact sensitive transcript and file data"),
    Flag.withDefault(false),
  ),
  html: Flag.Boolean("html").pipe(Flag.withDefault(false)),
  md: Flag.Boolean("md").pipe(Flag.withDefault(false)),
  jsonl: Flag.Boolean("jsonl").pipe(Flag.withDefault(false)),
  json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
  porcelain: Flag.Boolean("porcelain").pipe(Flag.withDefault(false)),
  out: Flag.String("out").pipe(Flag.withDefault("replay.html")),
}

const Root = Spec.make(typeof OPENCODE_CLI_NAME === "string" ? OPENCODE_CLI_NAME : "bolt", {
  description: "Bolt command line interface",
  params: {
    ...ServerParams,
    ...PermissionParams,
    directory: Argument.String("directory").pipe(
      Argument.withDescription("Directory to start Bolt in"),
      Argument.optional,
    ),
    continue: Flag.Boolean("continue").pipe(
      Flag.withAlias("c"),
      Flag.withDescription("Continue the last session"),
      Flag.withDefault(false),
    ),
    session: Flag.String("session").pipe(
      Flag.withAlias("s"),
      Flag.withDescription("Session ID to continue, or to create if it does not exist"),
      Flag.optional,
    ),
    prompt: Flag.String("prompt").pipe(Flag.withDescription("Prompt to use"), Flag.optional),
  },
  commands: [
    Spec.make("bisect", {
      description: "Find the commit that broke a command in an isolated worktree",
      globalFlags: ServerFlags,
      params: {
        command: Argument.String("command"),
        good: Flag.String("good").pipe(Flag.withAlias("g")),
        fix: Flag.Boolean("fix").pipe(Flag.withDefault(false)),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("mutate", {
      description: "Mutate a source file and verify that the tests catch bugs",
      params: {
        file: Argument.String("file"),
        command: Flag.String("command").pipe(Flag.withAlias("c"), Flag.optional),
        limit: Flag.Int("limit").pipe(Flag.withAlias("n"), Flag.withDefault(25)),
        timeout: Flag.Int("timeout").pipe(Flag.withDefault(120000)),
      },
    }),
    Spec.make("mux", {
      description: "Run parallel Bolt sessions in tmux split panes",
      params: {
        dirs: Argument.String("dirs").pipe(Argument.variadic()),
        count: Flag.Int("count").pipe(Flag.withAlias("n"), Flag.withDefault(2)),
        layout: Flag.Literals("layout", [
          "tiled",
          "even-horizontal",
          "even-vertical",
          "main-horizontal",
          "main-vertical",
        ]).pipe(Flag.withDefault("tiled")),
        name: Flag.String("name").pipe(Flag.withDefault("bolt")),
      },
    }),
    Spec.make("codemod", {
      description: "Generate an ast-grep transform, preview it and apply with --apply",
      globalFlags: ServerFlags,
      params: {
        description: Argument.String("description").pipe(Argument.optional),
        pattern: Flag.String("pattern").pipe(Flag.optional),
        rewrite: Flag.String("rewrite").pipe(Flag.optional),
        lang: Flag.String("lang").pipe(Flag.optional),
        apply: Flag.Boolean("apply").pipe(Flag.withDefault(false)),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("checkpoint", {
      description: "Save and rewind named repository and conversation checkpoints",
      globalFlags: ServerFlags,
      commands: [
        Spec.make("save", {
          description: "Save the repository and current conversation",
          params: {
            name: Argument.String("name"),
            session: Flag.String("session").pipe(Flag.withAlias("s"), Flag.optional),
            repoOnly: Flag.Boolean("repo-only").pipe(Flag.withDefault(false)),
          },
        }),
        Spec.make("list", { description: "List saved checkpoints", aliases: ["ls"] }),
        Spec.make("rewind", {
          description: "Restore a named checkpoint",
          params: { name: Argument.String("name") },
        }),
        Spec.make("remove", {
          description: "Remove a named checkpoint",
          aliases: ["rm"],
          params: { name: Argument.String("name") },
        }),
      ],
    }),
    Spec.make("batch", {
      description: "Run queued prompts sequentially or in parallel with a summary",
      globalFlags: ServerFlags,
      params: {
        file: Argument.String("file"),
        parallel: Flag.Int("parallel").pipe(Flag.withDefault(1)),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
        agent: Flag.String("agent").pipe(Flag.optional),
      },
    }),
    Spec.make("exec", {
      description: "Run a Markdown playbook, stopping at the first failed step",
      globalFlags: ServerFlags,
      params: {
        file: Flag.String("file").pipe(Flag.withAlias("f")),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
        agent: Flag.String("agent").pipe(Flag.optional),
      },
    }),
    Spec.make("undo", {
      description: "Roll back the last agent turn, including files and conversation",
      globalFlags: ServerFlags,
      params: {
        session: Flag.String("session").pipe(Flag.withAlias("s"), Flag.optional),
        redo: Flag.Boolean("redo").pipe(Flag.withDefault(false)),
      },
    }),
    Spec.make("cron", {
      description: "Schedule recurring agent chores through persistent background jobs",
      params: {
        action: Argument.Literals("action", ["add", "list", "rm", "start"]),
        args: Argument.String("args").pipe(Argument.variadic()),
      },
    }),
    Spec.make("jobs", {
      description: "Manage background jobs and supervise health with bounded restarts",
      params: {
        action: Argument.Literals("action", ["list", "tail", "kill", "supervise"]),
        id: Argument.String("id").pipe(Argument.optional),
        follow: Flag.Boolean("follow").pipe(Flag.withAlias("f"), Flag.withDefault(false)),
        health: Flag.String("health").pipe(Flag.optional),
        interval: Flag.Finite("interval").pipe(Flag.withDefault(5)),
        retries: Flag.Finite("retries").pipe(Flag.withDefault(3)),
        limit: Flag.Finite("limit").pipe(Flag.withDefault(5)),
      },
    }),
    Spec.make("invariants", {
      description: "State invariants before refactoring and verify them afterwards",
      globalFlags: ServerFlags,
      params: {
        action: Argument.Literals("action", ["state", "verify"]),
        files: Argument.String("files").pipe(Argument.variadic()),
        range: Flag.String("range").pipe(Flag.optional),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("analyze", {
      description: "Run project lint, typecheck and dead-export checks over the current diff",
      params: {
        branchTarget: Argument.String("branch-name").pipe(Argument.optional),
        staged: Flag.Boolean("staged").pipe(Flag.withDefault(false)),
        branch: Flag.String("branch").pipe(Flag.withOptionalValue(""), Flag.optional),
      },
    }),
    Spec.make("init", {
      description: "Initialize Bolt config, agents and commands for a project",
      params: {
        directory: Argument.String("directory").pipe(Argument.optional),
        preset: Flag.Literals("preset", ["library", "webapp", "monorepo"]).pipe(Flag.optional),
      },
    }),
    Spec.make("submodules", {
      description: "Report submodule drift and bring submodules in sync",
      params: { sync: Flag.Boolean("sync").pipe(Flag.withDefault(false)) },
    }),
    Spec.make("bench", {
      description: "Benchmark a command against a base ref and flag regressions",
      params: {
        command: Argument.String("command"),
        base: Flag.String("base").pipe(Flag.withAlias("b"), Flag.optional),
        runs: Flag.Finite("runs").pipe(Flag.withAlias("n"), Flag.withDefault(5)),
        warmup: Flag.Finite("warmup").pipe(Flag.withDefault(1)),
        threshold: Flag.Finite("threshold").pipe(Flag.withAlias("t"), Flag.withDefault(10)),
      },
    }),
    Spec.make("asserts", {
      description: "Find weak assertions and suggest concrete checks",
      globalFlags: ServerFlags,
      params: {
        files: Argument.String("files").pipe(Argument.variadic()),
        branch: Flag.String("branch").pipe(Flag.withOptionalValue(""), Flag.optional),
        suggest: Flag.Boolean("suggest").pipe(Flag.withDefault(false)),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("tighten", {
      description: "Find loose types and suggest stricter replacements",
      globalFlags: ServerFlags,
      params: {
        files: Argument.String("files").pipe(Argument.variadic()),
        branch: Flag.String("branch").pipe(Flag.withOptionalValue(""), Flag.optional),
        suggest: Flag.Boolean("suggest").pipe(Flag.withDefault(false)),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("index", {
      description: "Build or query the incremental local source index",
      params: {
        query: Argument.String("query").pipe(Argument.optional),
        out: Flag.String("out").pipe(Flag.withDefault("codebase-index.json")),
        limit: Flag.Int("limit").pipe(Flag.withDefault(10)),
        watch: Flag.Boolean("watch").pipe(Flag.withDefault(false)),
      },
    }),
    Spec.make("flaky", {
      description: "Detect flaky tests by repeating a command and quarantine mixed results",
      params: {
        command: Argument.String("command"),
        runs: Flag.Int("runs").pipe(Flag.withAlias("n"), Flag.withDefault(10)),
        quarantine: Flag.Boolean("quarantine").pipe(Flag.withAlias("q"), Flag.withDefault(false)),
      },
    }),
    Spec.make("resume", {
      description: "Resume a session, with a fuzzy picker when no ID is given",
      globalFlags: ServerFlags,
      params: { sessionID: Argument.String("sessionID").pipe(Argument.optional) },
    }),
    Spec.make("fork", {
      description: "Fork a session at a message, including that message in the copied history",
      globalFlags: ServerFlags,
      params: {
        sessionID: Argument.String("sessionID"),
        messageID: Argument.String("messageID").pipe(Argument.optional),
        resume: Flag.Boolean("resume").pipe(Flag.withDefault(false)),
      },
    }),
    Spec.make("drift", {
      description: "Flag documentation and comments made stale by the current diff",
      params: {
        branchTarget: Argument.String("branch-name").pipe(Argument.optional),
        staged: Flag.Boolean("staged").pipe(Flag.withDefault(false)),
        branch: Flag.String("branch").pipe(Flag.withOptionalValue(""), Flag.optional),
      },
    }),
    Spec.make("logs", {
      description: "Print or follow the Bolt agent log",
      params: {
        tail: Flag.Int("tail").pipe(Flag.withDefault(1000)),
        follow: Flag.Boolean("follow").pipe(Flag.withAlias("f"), Flag.withDefault(false)),
        level: Flag.Literals("level", ["DEBUG", "INFO", "WARN", "ERROR"]).pipe(Flag.optional),
        session: Flag.String("session").pipe(Flag.optional),
        file: Flag.String("file").pipe(Flag.optional),
        json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
        porcelain: Flag.Boolean("porcelain").pipe(Flag.withDefault(false)),
      },
    }),
    Spec.make("deps", { description: "Report outdated, vulnerable, deprecated and abandoned npm dependencies" }),
    Spec.make("alias", {
      description: "List, show, set or remove Bolt CLI command aliases",
      params: {
        entry: Argument.String("entry").pipe(Argument.optional),
        rm: Flag.Boolean("rm").pipe(Flag.withDefault(false)),
      },
    }),
    Spec.make("memory", {
      description: "Inspect and manage Bolt project memory",
      commands: [
        Spec.make("export", {
          description: "Export project memory as markdown",
          globalFlags: ServerFlags,
          params: { out: Flag.String("out").pipe(Flag.withAlias("o"), Flag.optional) },
        }),
        Spec.make("import", {
          description: "Import an exported memory document",
          globalFlags: ServerFlags,
          params: { file: Argument.String("file") },
        }),
        Spec.make("team", {
          description: "Share selected memory through .bolt/memory.md",
          globalFlags: ServerFlags,
          params: {
            action: Argument.Literals("action", ["init", "share"]),
            query: Argument.String("query").pipe(Argument.optional),
          },
        }),
        Spec.make("diff", {
          description: "Review memory staged by session captures",
          globalFlags: ServerFlags,
          params: {
            apply: Flag.Boolean("apply").pipe(Flag.withDefault(false)),
            discard: Flag.Boolean("discard").pipe(Flag.withDefault(false)),
          },
        }),
        Spec.make("review", {
          description: "Toggle review mode for captured memory",
          globalFlags: ServerFlags,
          params: { mode: Argument.Literals("mode", ["on", "off"]) },
        }),
        Spec.make("search", {
          description: "Search stored project memory",
          globalFlags: ServerFlags,
          params: {
            query: Argument.String("query"),
            limit: Flag.Int("limit").pipe(Flag.withAlias("n"), Flag.withDefault(10)),
          },
        }),
        Spec.make("conflicts", {
          description: "Detect and resolve contradictory facts",
          globalFlags: ServerFlags,
          params: { fix: Flag.Boolean("fix").pipe(Flag.withDefault(false)) },
        }),
        Spec.make("why", {
          description: "Explain stored memory with evidence and provenance",
          globalFlags: ServerFlags,
          params: {
            question: Argument.String("question").pipe(Argument.variadic()),
            model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
          },
        }),
      ],
    }),
    Spec.make("export", {
      globalFlags: ServerFlags,
      description: "Export a session as JSON, Markdown, JSONL or a self-contained HTML replay",
      params: ExportParams,
    }),
    Spec.make("grep", {
      globalFlags: ServerFlags,
      description: "Search text, reasoning and completed tool output across session transcripts",
      params: {
        pattern: Argument.String("pattern"),
        ignoreCase: Flag.Boolean("ignore-case").pipe(Flag.withAlias("i"), Flag.withDefault(false)),
        limit: Flag.Int("limit").pipe(Flag.optional),
        json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
      },
    }),
    Spec.make("why", {
      globalFlags: ServerFlags,
      description: "Explain when and why a behavior changed using commit evidence",
      params: {
        question: Argument.String("question"),
        file: Flag.String("file").pipe(Flag.optional),
        lines: Flag.String("lines").pipe(Flag.optional),
        term: Flag.String("term").pipe(Flag.optional),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("commitlint", {
      description: "Lint commit messages against this repository's own conventions",
      params: {
        range: Flag.String("range").pipe(Flag.optional),
        history: Flag.Int("history").pipe(Flag.withDefault(200)),
      },
    }),
    Spec.make("review", {
      globalFlags: ServerFlags,
      description: "Review code changes with the code-review agent",
      params: {
        branchTarget: Argument.String("branch-name").pipe(Argument.optional),
        staged: Flag.Boolean("staged").pipe(Flag.withDefault(false)),
        branch: Flag.String("branch").pipe(Flag.withOptionalValue(""), Flag.optional),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
        confidence: Flag.Boolean("confidence").pipe(Flag.withDefault(false)),
        json: Flag.Boolean("json").pipe(Flag.withDefault(false)),
        porcelain: Flag.Boolean("porcelain").pipe(Flag.withDefault(false)),
      },
    }),
    Spec.make("diff-gate", {
      globalFlags: ServerFlags,
      description: "Review a diff from stdin and fail at the selected severity",
      params: {
        threshold: Flag.Literals("threshold", ["minor", "major", "critical"]).pipe(Flag.withDefault("major")),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("learn", {
      globalFlags: ServerFlags,
      description: "Learn repository conventions into Bolt project memory",
      params: { model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional) },
    }),
    Spec.make("ask", {
      globalFlags: ServerFlags,
      description: "Ask a one-shot question and print only the answer",
      params: {
        question: Argument.String("question").pipe(Argument.variadic()),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
        agent: Flag.String("agent").pipe(Flag.optional),
      },
    }),
    Spec.make("commit", {
      globalFlags: ServerFlags,
      description: "Commit staged changes with a generated message",
      params: {
        all: Flag.Boolean("all").pipe(Flag.withAlias("a"), Flag.withDefault(false)),
        dryRun: Flag.Boolean("dry-run").pipe(Flag.withDefault(false)),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("map", {
      description: "Draw a markdown and Mermaid map of source dependencies",
      params: {
        out: Flag.String("out").pipe(Flag.withDefault("codebase-map.md")),
        depth: Flag.Int("depth").pipe(Flag.withDefault(2)),
      },
    }),
    Spec.make("arch", {
      description: "Detect imports that violate the declared module contract",
      params: { contract: Flag.String("contract").pipe(Flag.withDefault("architecture.json")) },
    }),
    Spec.make("owners", {
      description: "Map directory ownership from Git history and CODEOWNERS",
      params: {
        since: Flag.String("since").pipe(Flag.withDefault("1 year")),
        depth: Flag.Int("depth").pipe(Flag.withDefault(2)),
      },
    }),
    Spec.make("dead", {
      description: "Find unused exports ranked by deletion safety",
      params: { limit: Flag.Int("limit").pipe(Flag.withDefault(40)) },
    }),
    Spec.make("dupes", {
      description: "Find near-identical code blocks across the repo",
      params: {
        window: Flag.Int("window").pipe(Flag.withDefault(6)),
        limit: Flag.Int("limit").pipe(Flag.withDefault(20)),
      },
    }),
    Spec.make("packages", {
      description: "Map workspace dependencies and parallel build order",
      params: { out: Flag.String("out").pipe(Flag.optional) },
    }),
    Spec.make("hotspots", {
      description: "Flag files with high churn and high complexity for refactoring",
      params: {
        since: Flag.String("since").pipe(
          Flag.withDescription("History window, any git-parseable date"),
          Flag.withDefault("90 days"),
        ),
        limit: Flag.Int("limit").pipe(Flag.withDescription("Maximum files to report"), Flag.withDefault(20)),
      },
    }),
    Spec.make("blast", {
      description: "Estimate the blast radius of tracked changes",
      params: {
        staged: Flag.Boolean("staged").pipe(
          Flag.withDescription("Analyze staged changes only"),
          Flag.withDefault(false),
        ),
        branch: Flag.String("branch").pipe(
          Flag.withDescription("Analyze changes since the merge base with a branch"),
          Flag.optional,
        ),
      },
    }),
    Spec.make("upgrade", {
      description: "Upgrade Bolt to the latest or a specific version",
      aliases: ["update"],
      params: {
        target: Argument.String("target").pipe(
          Argument.withDescription("Version to upgrade to (with or without a leading v)"),
          Argument.optional,
        ),
        method: Flag.Literals("method", Updater.methods).pipe(
          Flag.withAlias("m"),
          Flag.withDescription("Installation method to use"),
          Flag.optional,
        ),
      },
    }),
    Spec.make("uninstall", {
      description: "Uninstall Bolt, keeping session data, configuration, and state",
      params: {
        dryRun: Flag.Boolean("dry-run").pipe(
          Flag.withDescription("Show what would be removed without removing"),
          Flag.withDefault(false),
        ),
        force: Flag.Boolean("force").pipe(
          Flag.withAlias("f"),
          Flag.withDescription("Skip confirmation prompts"),
          Flag.withDefault(false),
        ),
      },
    }),
    Spec.make("acp", {
      description: "Start an Agent Client Protocol server",
      params: {
        login: Flag.Boolean("login").pipe(
          Flag.withDescription("Run auth login instead of starting the server"),
          Flag.withDefault(false),
        ),
      },
    }),
    Spec.make("api", {
      description: "Make a request to the running server",
      globalFlags: ServerFlags,
      params: {
        request: Argument.String("operation | method path").pipe(
          Argument.withDescription("OpenAPI operation ID, or an HTTP method followed by a path"),
          Argument.variadic({ min: 1, max: 2 }),
        ),
        data: Flag.String("data").pipe(Flag.withAlias("d"), Flag.withDescription("Request body"), Flag.optional),
        header: Flag.String("header").pipe(
          Flag.withAlias("H"),
          Flag.withDescription("Request header in name:value form"),
          Flag.atMost(100),
        ),
        param: Flag.KeyValuePair("param").pipe(Flag.withDescription("OpenAPI path or query parameter"), Flag.optional),
      },
    }),
    Spec.make("debug", {
      description: "Debugging and troubleshooting tools",
      commands: [
        Spec.make("agents", { description: "List all agents", globalFlags: ServerFlags }),
        Spec.make("config", { description: "List configuration sources", globalFlags: ServerFlags }),
        Spec.make("heap-dump", {
          description: "Write a heap snapshot of the running server and print its path",
          globalFlags: [Server],
          params: {
            directory: Flag.String("directory").pipe(
              Flag.withDescription("Directory to write the snapshot into instead of the server's log directory"),
              Flag.optional,
            ),
          },
        }),
        Spec.make("paths", {
          description: "Show global paths (data, config, cache, state)",
          params: {
            name: Argument.Literals("name", [
              "db",
              "home",
              "data",
              "config",
              "cache",
              "state",
              "tmp",
              "bin",
              "log",
              "repos",
            ]).pipe(
              Argument.withDescription(
                "Print only one path: db, home, data, config, cache, state, tmp, bin, log, repos",
              ),
              Argument.optional,
            ),
          },
        }),
      ],
    }),
    Spec.make("auth", {
      description: "manage integrations and credentials",
      globalFlags: ServerFlags,
      commands: [
        Spec.make("list", {
          description: "list integrations and credentials",
          params: {
            format: Flag.Literals("format", ["default", "json"]).pipe(
              Flag.withDescription("Output format"),
              Flag.withDefault("default"),
            ),
          },
        }),
        Spec.make("login", {
          description: "connect an integration",
          params: {
            target: Argument.String("target").pipe(
              Argument.withDescription("Integration ID, name, or well-known provider URL"),
              Argument.optional,
            ),
            method: Flag.String("method").pipe(Flag.withDescription("Authentication method ID"), Flag.optional),
            answer: Flag.String("answer").pipe(
              Flag.withDescription("Provider form answer (key=value; repeat for multiple fields)"),
              Flag.atMost(100),
            ),
          },
        }),
        Spec.make("logout", {
          description: "log out of a saved account",
          params: {
            target: Argument.String("target").pipe(
              Argument.withDescription("Integration ID or name"),
              Argument.optional,
            ),
            credential: Argument.String("credential").pipe(
              Argument.withDescription("Credential ID or label (opens an account picker when omitted)"),
              Argument.optional,
            ),
          },
        }),
        Spec.make("export", {
          description: "print stored credentials, including secrets, as JSON",
          params: {
            target: Argument.String("target").pipe(
              Argument.withDescription("Integration ID or name (exports every integration when omitted)"),
              Argument.optional,
            ),
          },
        }),
        Spec.make("import", {
          description: "import credentials exported by auth export",
          params: {
            file: Argument.String("file").pipe(
              Argument.withDescription("JSON file to import (reads stdin when omitted)"),
              Argument.optional,
            ),
          },
        }),
        Spec.make("switch", {
          description: "switch the active account for an integration",
          params: {
            target: Argument.String("target").pipe(
              Argument.withDescription("Integration ID or name"),
              Argument.optional,
            ),
            credential: Argument.String("credential").pipe(
              Argument.withDescription("Credential ID or label (opens an account picker when omitted)"),
              Argument.optional,
            ),
          },
        }),
      ],
    }),
    Spec.make("mcp", {
      description: "Manage MCP (Model Context Protocol) servers",
      commands: [
        Spec.make("list", {
          description: "List configured MCP servers and their status",
          globalFlags: ServerFlags,
        }),
        Spec.make("add", {
          description: "Add an MCP server to your configuration",
          params: {
            name: Argument.String("name").pipe(Argument.withDescription("Name of the MCP server")),
            command: Argument.String("command").pipe(
              Argument.withDescription("Command and arguments for a local server, passed after --"),
              Argument.variadic({ min: 0 }),
            ),
            url: Flag.String("url").pipe(Flag.withDescription("URL for a remote MCP server"), Flag.optional),
            header: Flag.KeyValuePair("header").pipe(
              Flag.withDescription("HTTP header for a remote server, as name=value"),
              Flag.optional,
            ),
            env: Flag.KeyValuePair("env").pipe(
              Flag.withDescription("Environment variable for a local server, as name=value"),
              Flag.optional,
            ),
            global: Flag.Boolean("global").pipe(
              Flag.withDescription("Write to the global config instead of the project config"),
              Flag.withDefault(false),
            ),
          },
        }),
        Spec.make("auth", {
          description: "Authenticate with an OAuth-capable remote MCP server",
          globalFlags: ServerFlags,
          params: {
            name: Argument.String("name").pipe(Argument.withDescription("Name of the MCP server"), Argument.optional),
          },
        }),
        Spec.make("logout", {
          description: "Remove stored OAuth credentials for an MCP server",
          globalFlags: ServerFlags,
          params: { name: Argument.String("name").pipe(Argument.withDescription("Name of the MCP server")) },
        }),
      ],
    }),
    Spec.make("plugin", {
      description: "Manage plugins",
      commands: [
        Spec.make("list", {
          description: "List plugins",
          globalFlags: ServerFlags,
          params: {
            builtin: Flag.Boolean("builtin").pipe(
              Flag.withDescription("Include built-in server plugins"),
              Flag.withDefault(false),
            ),
          },
        }),
        Spec.make("add", {
          description: "Install a plugin and add it to the global configuration",
          params: {
            package: Argument.String("package").pipe(Argument.withDescription("npm registry or Git package specifier")),
          },
        }),
        Spec.make("check", {
          description: "Check package plugins for updates",
          globalFlags: ServerFlags,
          params: {
            target: Argument.String("target").pipe(
              Argument.withDescription("Configured package target"),
              Argument.optional,
            ),
          },
        }),
        Spec.make("update", {
          description: "Update package plugins",
          globalFlags: ServerFlags,
          params: {
            target: Argument.String("target").pipe(
              Argument.withDescription("Configured package target; omit to update all outdated plugins"),
              Argument.optional,
            ),
          },
        }),
        Spec.make("remove", {
          description: "Remove a plugin from global configuration",
          params: {
            package: Argument.String("package").pipe(Argument.withDescription("configured package specifier")),
          },
        }),
      ],
    }),
    Spec.make("models", {
      description: "List all available models",
      globalFlags: ServerFlags,
    }),
    Spec.make("stats", {
      description: "Show shareable usage statistics",
      globalFlags: ServerFlags,
      params: {
        days: Flag.Int("days").pipe(
          Flag.withSchema(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
          Flag.withDescription("Show the last N days; 0 means today"),
          Flag.optional,
        ),
        year: Flag.Int("year").pipe(
          Flag.withSchema(Schema.Int.check(Schema.isBetween({ minimum: 1970, maximum: 9_999 }))),
          Flag.withDescription("Show a calendar year"),
          Flag.optional,
        ),
        all: Flag.Boolean("all").pipe(Flag.withDescription("Show lifetime statistics"), Flag.withDefault(false)),
        project: Flag.String("project").pipe(
          Flag.withDescription('Filter by project ID, or use "." for the current project'),
          Flag.optional,
        ),
        models: Flag.Boolean("models").pipe(Flag.withDescription("Show model usage"), Flag.withDefault(false)),
        tools: Flag.Boolean("tools").pipe(Flag.withDescription("Show tool reliability"), Flag.withDefault(false)),
        cost: Flag.Boolean("cost").pipe(Flag.withDescription("Show cost and token details"), Flag.withDefault(false)),
        full: Flag.Boolean("full").pipe(Flag.withDescription("Show every detailed section"), Flag.withDefault(false)),
        limit: Flag.Int("limit").pipe(
          Flag.withSchema(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
          Flag.withDescription("Number of rows in detailed sections"),
          Flag.withDefault(5),
        ),
        json: Flag.Boolean("json").pipe(Flag.withDescription("Output statistics as JSON"), Flag.withDefault(false)),
      },
    }),
    Spec.make("mini", {
      description: "Start the minimal interactive interface",
      globalFlags: ServerFlags,
      params: {
        continue: Flag.Boolean("continue").pipe(
          Flag.withAlias("c"),
          Flag.withDescription("Continue the last session"),
          Flag.withDefault(false),
        ),
        session: Flag.String("session").pipe(
          Flag.withAlias("s"),
          Flag.withDescription("Session ID to continue, or to create if it does not exist"),
          Flag.optional,
        ),
        fork: Flag.Boolean("fork").pipe(
          Flag.withDescription("Fork the session when continuing"),
          Flag.withDefault(false),
        ),
        replay: Flag.Boolean("replay").pipe(
          Flag.withDescription("Restore session history on resume and resize (disable with --no-replay)"),
          Flag.optional,
        ),
        replayLimit: Flag.Int("replay-limit").pipe(
          Flag.withDescription("Limit replay to the newest N messages (default: 200)"),
          Flag.optional,
        ),
        model: Flag.String("model").pipe(
          Flag.withAlias("m"),
          Flag.withDescription("Model to use in the format provider/model"),
          Flag.optional,
        ),
        agent: Flag.String("agent").pipe(Flag.withDescription("Agent to use"), Flag.optional),
        prompt: Flag.String("prompt").pipe(Flag.withDescription("Prompt to use"), Flag.optional),
        demo: Flag.Boolean("demo").pipe(Flag.withDefault(false), Flag.withHidden),
      },
    }),
    Spec.make("config", {
      description: "Inspect and manage project and global configuration",
      globalFlags: ServerFlags,
      commands: [
        Spec.make("get", {
          description: "Print a resolved configuration value",
          params: { key: Argument.String("key") },
        }),
        Spec.make("set", {
          description: "Set a configuration value, preserving JSONC comments",
          params: {
            key: Argument.String("key"),
            value: Argument.String("value"),
            global: Flag.Boolean("global").pipe(Flag.withDefault(false)),
          },
        }),
        Spec.make("unset", {
          description: "Remove a configuration value",
          params: { key: Argument.String("key"), global: Flag.Boolean("global").pipe(Flag.withDefault(false)) },
        }),
        Spec.make("edit", { description: "Open global configuration in $EDITOR or $VISUAL" }),
        Spec.make("doctor", { description: "Show configuration sources and winning keys" }),
        Spec.make("diff", {
          description: "Compare project configuration with HEAD",
          params: { patch: Flag.Boolean("patch").pipe(Flag.withDefault(false)) },
        }),
      ],
    }),
    Spec.make("warm", {
      description: "Preload project configuration, model metadata and the source index",
      globalFlags: ServerFlags,
      params: { index: Flag.Boolean("index").pipe(Flag.withDefault(true)) },
    }),
    Spec.make("worktree", {
      description: "Create, list and clean agent worktrees",
      globalFlags: ServerFlags,
      commands: [
        Spec.make("list", { description: "List agent worktrees", aliases: ["ls"] }),
        Spec.make("create", {
          description: "Create an isolated agent worktree",
          params: {
            name: Argument.String("name").pipe(Argument.optional),
            start: Flag.String("start").pipe(Flag.optional),
          },
        }),
        Spec.make("remove", {
          description: "Remove a clean agent worktree and its branch",
          aliases: ["rm"],
          params: { worktree: Argument.String("worktree") },
        }),
        Spec.make("clean", {
          description: "Preview or remove all agent worktrees",
          params: { apply: Flag.Boolean("apply").pipe(Flag.withDefault(false)) },
        }),
      ],
    }),
    Spec.make("refactor", {
      description: "Refactor with a test-verified repair loop",
      globalFlags: ServerFlags,
      params: {
        instruction: Argument.String("instruction"),
        test: Flag.String("test"),
        attempts: Flag.Int("attempts").pipe(Flag.withDefault(5)),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
        confidence: Flag.Boolean("confidence").pipe(Flag.withDefault(false)),
        selfReview: Flag.Boolean("self-review").pipe(Flag.withDefault(false)),
      },
    }),
    Spec.make("pipeline", {
      description: "Run a plan, code, review agent pipeline on a task",
      globalFlags: ServerFlags,
      params: {
        task: Argument.String("task"),
        attempts: Flag.Int("attempts").pipe(Flag.withDefault(2)),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("guard", {
      description: "Generate and verify a failing regression test before fixing a bug",
      globalFlags: ServerFlags,
      params: {
        bug: Argument.String("bug"),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("proptest", {
      description: "Generate and run property tests for pure exported functions",
      globalFlags: ServerFlags,
      params: {
        file: Argument.String("file"),
        name: Flag.String("name").pipe(Flag.optional),
        model: Flag.String("model").pipe(Flag.withAlias("m"), Flag.optional),
      },
    }),
    Spec.make("arena", {
      description: "Race agents in isolated worktrees and keep the best result",
      globalFlags: ServerFlags,
      params: {
        message: Argument.String("message").pipe(Argument.variadic({ min: 0 })),
        models: Flag.String("models"),
        judge: Flag.String("judge").pipe(Flag.optional),
        agent: Flag.String("agent").pipe(Flag.optional),
        variant: Flag.String("variant").pipe(Flag.optional),
        format: Flag.Literals("format", ["default", "json"]).pipe(Flag.withDefault("default")),
        cleanup: Flag.Boolean("cleanup").pipe(Flag.withDefault(false)),
        ...PermissionParams,
      },
    }),
    Spec.make("run", {
      description: "Run Bolt with a message",
      globalFlags: ServerFlags,
      params: {
        bestOf: Flag.String("best-of").pipe(
          Flag.optional,
          Flag.withDescription("Race comma-separated provider/model entries and judge their answers"),
        ),
        judge: Flag.String("judge").pipe(Flag.optional),
        variant: Flag.String("variant").pipe(Flag.optional),
        background: Flag.Boolean("background").pipe(Flag.withAlias("bg"), Flag.withDefault(false)),
        voice: Flag.Boolean("voice").pipe(
          Flag.withDefault(false),
          Flag.withDescription("Record a prompt and transcribe with local whisper.cpp"),
        ),
        message: Argument.String("message").pipe(
          Argument.withDescription("Message to send"),
          Argument.variadic({ min: 0 }),
        ),
        continue: Flag.Boolean("continue").pipe(
          Flag.withAlias("c"),
          Flag.withDescription("Continue the last session"),
          Flag.withDefault(false),
        ),
        session: Flag.String("session").pipe(
          Flag.withAlias("s"),
          Flag.withDescription("Session ID to continue, or to create if it does not exist"),
          Flag.optional,
        ),
        fork: Flag.Boolean("fork").pipe(
          Flag.withDescription("Fork the session before continuing"),
          Flag.withDefault(false),
        ),
        worktree: CliFlag.optionalValue("worktree", "name").pipe(
          Flag.withAlias("w"),
          Flag.withDescription("Start a new session in a new git worktree, optionally with this name"),
        ),
        model: Flag.String("model").pipe(
          Flag.withAlias("m"),
          Flag.withDescription("Model to use in the format provider/model#variant"),
          Flag.optional,
        ),
        agent: Flag.String("agent").pipe(Flag.withDescription("Agent to use"), Flag.optional),
        format: Flag.Literals("format", ["default", "json"]).pipe(
          Flag.withDescription("Output format"),
          Flag.withDefault("default"),
        ),
        file: Flag.String("file").pipe(
          Flag.withAlias("f"),
          Flag.withDescription("File to attach to the message"),
          Flag.atMost(100),
        ),
        title: Flag.String("title").pipe(Flag.withDescription("Session title"), Flag.optional),
        thinking: Flag.Boolean("thinking").pipe(Flag.withDescription("Show thinking blocks"), Flag.withDefault(false)),
        ...PermissionParams,
      },
    }),
    Spec.make("session", {
      description: "Manage sessions",
      globalFlags: ServerFlags,
      commands: [
        Spec.make("list", {
          description: "List top-level sessions in the current project, newest first",
          params: {
            maxCount: Flag.Int("max-count").pipe(
              Flag.withAlias("n"),
              Flag.withSchema(Schema.Int.check(Schema.isGreaterThanOrEqualTo(1))),
              Flag.withDescription("Limit to N most recent sessions (default: 100)"),
              Flag.optional,
            ),
            format: Flag.Literals("format", ["table", "json"]).pipe(
              Flag.withDescription("Output format"),
              Flag.withDefault("table"),
            ),
          },
        }),
        Spec.make("delete", {
          description: "Delete a session and its child sessions",
          params: {
            sessionID: Argument.String("sessionID").pipe(Argument.withDescription("Session ID to delete")),
          },
        }),
        Spec.make("export", {
          description: "Export a session as JSON, Markdown, JSONL or an HTML replay",
          params: ExportParams,
        }),
        Spec.make("import", {
          description: "Import session data from a JSON file or URL",
          params: {
            file: Argument.String("file").pipe(Argument.withDescription("JSON file or URL to import")),
            directory: Flag.String("directory").pipe(
              Flag.withDescription("Directory in which to import the session"),
              Flag.optional,
            ),
          },
        }),
      ],
    }),
    Spec.make("service", {
      description: "Manage the background server",
      commands: [
        Spec.make("start", { description: "Start the background server" }),
        Spec.make("restart", { description: "Restart the background server" }),
        Spec.make("status", { description: "Show background server status" }),
        Spec.make("stop", { description: "Stop the background server" }),
        Spec.make("get", {
          description: "Get service configuration",
          params: {
            key: Argument.String("key").pipe(Argument.withDescription("Service setting or env"), Argument.optional),
            name: Argument.String("name").pipe(
              Argument.withDescription("Environment variable name"),
              Argument.optional,
            ),
          },
        }),
        Spec.make("set", {
          description: "Set service configuration",
          params: {
            key: Argument.String("key").pipe(Argument.withDescription("Service setting or env")),
            value: Argument.String("value").pipe(
              Argument.withDescription("Setting value or environment variable name"),
            ),
            nestedValue: Argument.String("env-value").pipe(
              Argument.withDescription("Environment variable value"),
              Argument.optional,
            ),
          },
        }),
        Spec.make("unset", {
          description: "Unset service configuration",
          params: {
            key: Argument.String("key").pipe(Argument.withDescription("Service setting or env")),
            name: Argument.String("name").pipe(
              Argument.withDescription("Environment variable name"),
              Argument.optional,
            ),
          },
        }),
      ],
    }),
    Spec.make("reload", {
      description: "Reload configuration",
      globalFlags: ServerFlags,
    }),
    Spec.make("pair", {
      description: "Print one-time links to connect a browser or app",
      params: {
        url: Flag.String("url").pipe(
          Flag.withDescription("Use an external HTTP(S) server URL in pairing links"),
          Flag.mapTryCatch(
            (value) => {
              const url = new URL(value)
              if (!["http:", "https:"].includes(url.protocol) || url.username || url.password || url.search || url.hash)
                throw new Error("Invalid pairing URL")
              return url.href.replace(/\/+$/, "")
            },
            () => "Expected an HTTP(S) server URL without credentials, query parameters, or a fragment",
          ),
          Flag.optional,
        ),
        remote: Flag.Boolean("remote").pipe(
          Flag.withDescription(
            "Pair through the OpenTunnel remote address, enabling remote access if needed (exposes the server to the internet)",
          ),
          Flag.withDefault(false),
        ),
        yes: Flag.Boolean("yes").pipe(
          Flag.withAlias("y"),
          Flag.withDescription(
            "Accept exposing the server to the internet when --remote enables remote access for the first time (required without an interactive terminal)",
          ),
          Flag.withDefault(false),
        ),
      },
    }),
    Spec.make("serve", {
      description: "Start the v2 API and web server",
      params: {
        hostname: Flag.String("hostname").pipe(Flag.optional),
        port: Flag.Int("port").pipe(Flag.optional),
        cors: Flag.String("cors").pipe(
          Flag.withSchema(Schema.NonEmptyString),
          Flag.withDescription("Additional allowed CORS origin (repeat for multiple origins)"),
          Flag.atLeast(0),
        ),
        service: Flag.Boolean("service").pipe(Flag.withDefault(false)),
        stdio: Flag.Boolean("stdio").pipe(Flag.withDefault(false)),
      },
    }),
  ],
})

export const Commands = Root
