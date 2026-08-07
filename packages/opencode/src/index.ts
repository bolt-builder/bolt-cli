import yargs from "yargs"
import { hideBin } from "yargs/helpers"
import { RunCommand } from "./cli/cmd/run"
import { AskCommand } from "./cli/cmd/ask"
import { ArenaCommand } from "./cli/cmd/arena"
import { GenerateCommand } from "./cli/cmd/generate"
import { ConsoleCommand } from "./cli/cmd/account"
import { ProvidersCommand } from "./cli/cmd/providers"
import { AgentCommand } from "./cli/cmd/agent"
import { UpgradeCommand } from "./cli/cmd/upgrade"
import { UninstallCommand } from "./cli/cmd/uninstall"
import { ModelsCommand } from "./cli/cmd/models"
import { UI } from "./cli/ui"
import { InstallationVersion } from "@opencode-ai/core/installation/version"
import { FormatError } from "./cli/error"
import { ServeCommand } from "./cli/cmd/serve"
import { DaemonCommand } from "./cli/cmd/daemon"
import { WarmCommand } from "./cli/cmd/warm"
import { DebugCommand } from "./cli/cmd/debug"
import { ConfigCommand } from "./cli/cmd/config"
import { StatsCommand } from "./cli/cmd/stats"
import { EvalCommand } from "./cli/cmd/eval"
import { LogsCommand } from "./cli/cmd/logs"
import { MapCommand } from "./cli/cmd/map"
import { ArchCommand } from "./cli/cmd/arch"
import { MigrateCommand } from "./cli/cmd/migrate"
import { DepsCommand } from "./cli/cmd/deps"
import { DiffGateCommand } from "./cli/cmd/diff-gate"
import { OwnersCommand } from "./cli/cmd/owners"
import { HotspotsCommand } from "./cli/cmd/hotspots"
import { PackagesCommand } from "./cli/cmd/packages"
import { ApiCommand } from "./cli/cmd/api"
import { IndexCommand } from "./cli/cmd/indexer"
import { DeadCommand } from "./cli/cmd/dead"
import { DupesCommand } from "./cli/cmd/dupes"
import { McpCommand } from "./cli/cmd/mcp"
import { GithubCommand } from "./cli/cmd/github"
import { ExecCommand } from "./cli/cmd/exec"
import { ExportCommand } from "./cli/cmd/export"
import { ImportCommand } from "./cli/cmd/import"
import { AttachCommand } from "./cli/cmd/attach"
import { TuiThreadCommand } from "./cli/cmd/tui"
import { AcpCommand } from "./cli/cmd/acp"
import { EOL } from "os"
import { WebCommand } from "./cli/cmd/web"
import { PrCommand } from "./cli/cmd/pr"
import { StackCommand } from "./cli/cmd/stack"
import { CommitCommand } from "./cli/cmd/commit"
import { CommitlintCommand } from "./cli/cmd/commitlint"
import { PortCommand } from "./cli/cmd/port"
import { SplitCommand } from "./cli/cmd/split"
import { ReviewCommand } from "./cli/cmd/review"
import { BlastCommand } from "./cli/cmd/blast"
import { UndoCommand } from "./cli/cmd/undo"
import { AnalyzeCommand } from "./cli/cmd/analyze"
import { CheckpointCommand } from "./cli/cmd/checkpoint"
import { RebaseCommand } from "./cli/cmd/rebase"
import { InvariantsCommand } from "./cli/cmd/invariants"
import { ResolveCommand } from "./cli/cmd/resolve"
import { CodemodCommand } from "./cli/cmd/codemod"
import { AssertsCommand } from "./cli/cmd/asserts"
import { PipelineCommand } from "./cli/cmd/pipeline"
import { RefactorCommand } from "./cli/cmd/refactor"
import { TightenCommand } from "./cli/cmd/tighten"
import { LearnCommand } from "./cli/cmd/learn"
import { DriftCommand } from "./cli/cmd/drift"
import { MemoryCommand } from "./cli/cmd/memory"
import { WatchCommand } from "./cli/cmd/watch"
import { JobsCommand } from "./cli/cmd/jobs"
import { CronCommand } from "./cli/cmd/cron"
import { FlakyCommand } from "./cli/cmd/flaky"
import { ProptestCommand } from "./cli/cmd/proptest"
import { GuardCommand } from "./cli/cmd/guard"
import { MutateCommand } from "./cli/cmd/mutate"
import { MuxCommand } from "./cli/cmd/mux"
import { BisectCommand } from "./cli/cmd/bisect"
import { BatchCommand } from "./cli/cmd/batch"
import { WhyCommand } from "./cli/cmd/why"
import { BenchCommand } from "./cli/cmd/bench"
import { FigmaCommand } from "./cli/cmd/figma"
import { PairCommand } from "./cli/cmd/pair"
import { SessionCommand, TagCommand } from "./cli/cmd/session"
import { ResumeCommand } from "./cli/cmd/resume"
import { GrepCommand } from "./cli/cmd/grep"
import { ForkCommand } from "./cli/cmd/fork"
import { SubmodulesCommand } from "./cli/cmd/submodules"
import { WorktreeCommand } from "./cli/cmd/worktree"
import { DbCommand } from "./cli/cmd/db"
import { errorMessage } from "./util/error"
import { PluginCommand } from "./cli/cmd/plug"
import { PluginCli } from "./plugin/cli"
import { Heap } from "./cli/heap"

const args = hideBin(process.argv)

const commands = [
  AcpCommand,
  McpCommand,
  TuiThreadCommand,
  AttachCommand,
  RunCommand,
  AskCommand,
  ArenaCommand,
  GenerateCommand,
  DebugCommand,
  ConfigCommand,
  ConsoleCommand,
  ProvidersCommand,
  AgentCommand,
  UpgradeCommand,
  UninstallCommand,
  ServeCommand,
  DaemonCommand,
  WarmCommand,
  WebCommand,
  ModelsCommand,
  StatsCommand,
  EvalCommand,
  LogsCommand,
  MapCommand,
  ArchCommand,
  MigrateCommand,
  DepsCommand,
  DiffGateCommand,
  OwnersCommand,
  HotspotsCommand,
  PackagesCommand,
  ApiCommand,
  IndexCommand,
  DeadCommand,
  DupesCommand,
  ExecCommand,
  ExportCommand,
  ImportCommand,
  GithubCommand,
  PrCommand,
  StackCommand,
  CommitCommand,
  CommitlintCommand,
  PortCommand,
  SplitCommand,
  ReviewCommand,
  BlastCommand,
  UndoCommand,
  AnalyzeCommand,
  CheckpointCommand,
  RebaseCommand,
  InvariantsCommand,
  ResolveCommand,
  CodemodCommand,
  AssertsCommand,
  PipelineCommand,
  RefactorCommand,
  TightenCommand,
  LearnCommand,
  DriftCommand,
  MemoryCommand,
  WatchCommand,
  JobsCommand,
  CronCommand,
  FlakyCommand,
  ProptestCommand,
  GuardCommand,
  MutateCommand,
  MuxCommand,
  BisectCommand,
  BatchCommand,
  WhyCommand,
  BenchCommand,
  FigmaCommand,
  PairCommand,
  SessionCommand,
  ResumeCommand,
  GrepCommand,
  TagCommand,
  ForkCommand,
  SubmodulesCommand,
  WorktreeCommand,
  PluginCommand,
  DbCommand,
]

function show(out: string) {
  const text = out.trimStart()
  if (!text.startsWith("bolt ")) {
    process.stderr.write(UI.logo() + EOL + EOL)
    process.stderr.write(text + EOL)
    return
  }
  process.stderr.write(out)
}

const cli = yargs(args)
  .parserConfiguration({ "populate--": true })
  .scriptName("bolt")
  .wrap(100)
  .help("help", "show help")
  .alias("help", "h")
  .version("version", "show version number", InstallationVersion)
  .alias("version", "v")
  .option("print-logs", {
    describe: "print logs to stderr",
    type: "boolean",
  })
  .option("log-level", {
    describe: "log level",
    type: "string",
    choices: ["DEBUG", "INFO", "WARN", "ERROR"],
  })
  .option("pure", {
    describe: "run without external plugins",
    type: "boolean",
  })
  .option("profile", {
    describe: "use a named config profile",
    type: "string",
  })
  .option("quiet", {
    describe: "suppress non-essential output on stderr (errors still print)",
    type: "boolean",
  })
  .option("verbose", {
    describe: "print debug logs to stderr (implies --print-logs and --log-level DEBUG)",
    type: "boolean",
  })
  .option("offline", {
    describe: "fail fast on network access instead of hanging",
    type: "boolean",
  })
  .middleware(async (opts) => {
    if (opts.quiet) UI.setQuiet(true)
    if (opts.verbose) {
      process.env.OPENCODE_PRINT_LOGS = "1"
      process.env.OPENCODE_LOG_LEVEL = "DEBUG"
    }
    if (opts.printLogs) process.env.OPENCODE_PRINT_LOGS = "1"
    if (opts.logLevel) process.env.OPENCODE_LOG_LEVEL = opts.logLevel
    if (opts.profile) process.env.OPENCODE_PROFILE = opts.profile
    if (opts.pure) {
      process.env.OPENCODE_PURE = "1"
    }
    if (opts.offline || process.env.OPENCODE_OFFLINE) {
      // The env var propagates offline mode to spawned bolt subprocesses.
      process.env.OPENCODE_OFFLINE = "1"
      const { Offline } = await import("./cli/offline")
      Offline.enable()
    }

    Heap.start()

    process.env.AGENT = "1"
    process.env.OPENCODE = "1"
    process.env.OPENCODE_PID = String(process.pid)
  })
  .usage("")
  .completion("completion", "generate shell completion script")
  .fail((msg, err) => {
    if (err) throw err
    if (msg) process.stderr.write(msg + EOL)
    if (
      msg?.startsWith("Unknown argument") ||
      msg?.startsWith("Not enough non-option arguments") ||
      msg?.startsWith("Invalid values:")
    ) {
      cli.showHelp(show)
    }
    process.exit(1)
  })
  .strict()

for (const command of commands) cli.command(command as never)

try {
  // Plugin-defined subcommands: dispatch unknown top-level commands to plugin
  // `cli` registrations before yargs parses (the default `$0 [project]`
  // command would otherwise treat the token as a project path).
  const builtin = PluginCli.known(commands)
  builtin.add("completion")
  const name = PluginCli.candidate(args, builtin)
  if (name) {
    const handled = await PluginCli.dispatch({ name, args: args.slice(1), directory: process.cwd() })
    if (handled) process.exit(0)
  }
  if (args.includes("-h") || args.includes("--help")) {
    await cli.parse(args, (err: Error | undefined, _argv: unknown, out: string) => {
      if (err) throw err
      if (!out) return
      show(out)
    })
  } else {
    await cli.parse()
  }
} catch (e) {
  const formatted = FormatError(e)
  if (formatted) UI.error(formatted)
  if (formatted === undefined) {
    UI.error("Unexpected error" + EOL)
    process.stderr.write(errorMessage(e) + EOL)
  }
  // FormatError may have set a classed exit code (e.g. CliError exitCode, auth); keep it.
  if (!process.exitCode) process.exitCode = 1
} finally {
  // Some subprocesses don't react properly to SIGTERM and similar signals.
  // Most notably, some docker-container-based MCP servers don't handle such signals unless
  // run using `docker run --init`.
  // Explicitly exit to avoid any hanging subprocesses.
  process.exit()
}
