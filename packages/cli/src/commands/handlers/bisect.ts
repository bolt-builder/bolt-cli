import path from "node:path"
import os from "node:os"
import { Effect, Exit, Option } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { ServerConnection } from "../../services/server-connection"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { answer } from "../../services/answer"
import { parseSessionTargetModel } from "../../session-target"
import { Signature } from "../../services/signature"
import { errorMessage } from "../../util/error"

const INSTRUCTIONS = [
  "Main is red. A git bisect identified the culprit commit below.",
  "Investigate with your read, grep, and glob tools, explain the root cause in two or three sentences, and propose the minimal fix as a unified diff in a fenced code block.",
  "Do not edit any files; only propose the patch.",
].join("\n")

export default Runtime.handler(Commands.commands.bisect, (input) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const git = yield* Git.make
    const app = yield* AppProcess.Service
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* Effect.fail(
        new Error("Could not find git repository. Please run this command from a git repository."),
      )
    const cwd = root.stdout.toString().trim()
    const head = yield* git.run(["rev-parse", "--verify", "HEAD^{commit}"], cwd)
    const good = yield* git.run(["rev-parse", "--verify", "--end-of-options", `${input.good}^{commit}`], cwd)
    if (head.exitCode !== 0 || good.exitCode !== 0)
      return yield* Effect.fail(new Error("HEAD and --good must resolve to commits"))
    const sha = head.stdout.toString().trim()
    const goodSHA = good.stdout.toString().trim()
    const directory = path.join(os.tmpdir(), `bolt-bisect-${crypto.randomUUID()}`)
    yield* Effect.acquireRelease(
      git.run(["worktree", "add", "--detach", directory, sha], cwd).pipe(Effect.flatMap(AppProcess.requireSuccess)),
      () =>
        git.run(["worktree", "remove", "--force", directory], cwd).pipe(
          Effect.exit,
          Effect.flatMap((result) =>
            Effect.sync(() => {
              if (Exit.isSuccess(result) && result.value.exitCode === 0) return
              process.stderr.write(
                `Failed to remove temporary worktree. Run: git worktree remove --force ${directory}\n`,
              )
              process.exitCode ||= 1
            }),
          ),
        ),
    )
    const run = (args: string[]) =>
      app.run(ChildProcess.make("git", ["-c", "core.autocrlf=false", ...args], { cwd: directory }), {
        maxOutputBytes: 60000,
        maxErrorBytes: 10000,
      })
    const execute = app.run(ChildProcess.make(input.command, { shell: true, cwd: directory }), {
      maxOutputBytes: 10000,
      maxErrorBytes: 10000,
    })
    process.stdout.write(`Checking that "${input.command}" fails on HEAD...\n`)
    const failure = yield* execute
    if (failure.exitCode === 0) return yield* Effect.fail(new Error("The command passes on HEAD. Nothing to bisect."))
    yield* run(["checkout", "--detach", goodSHA]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    if ((yield* execute).exitCode !== 0)
      return yield* Effect.fail(new Error("The command also fails on --good. Choose a passing commit."))
    yield* run(["checkout", "--detach", sha]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    process.stdout.write(`Bisecting between ${input.good} (good) and HEAD (bad)...\n`)
    yield* run(["bisect", "start", sha, goodSHA]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    // Run through the platform shell directly so Git for Windows cannot reparse
    // cmd.exe quoting. Git can finish with HEAD still on the last good commit;
    // convergence means only the bad revision remains outside the good ancestry.
    while (true) {
      const candidates = yield* run([
        "rev-list",
        "--count",
        "refs/bisect/bad",
        "--not",
        "--glob=refs/bisect/good-*",
      ]).pipe(Effect.flatMap(AppProcess.requireSuccess))
      if (candidates.stdout.toString().trim() === "1") break
      const checked = yield* execute
      if (checked.exitCode >= 128)
        return yield* Effect.fail(new Error(`Bisect command aborted (exit ${checked.exitCode}).\n${checked.stderr}`))
      const marked = yield* run(["bisect", checked.exitCode === 0 ? "good" : checked.exitCode === 125 ? "skip" : "bad"])
      if (marked.exitCode !== 0)
        return yield* Effect.fail(
          new Error(
            marked.stderr.toString().trim() || marked.stdout.toString().trim() || "git bisect failed to converge",
          ),
        )
    }
    const culprit = yield* run(["rev-parse", "--verify", "refs/bisect/bad"]).pipe(
      Effect.flatMap(AppProcess.requireSuccess),
    )
    const commit = culprit.stdout.toString().trim()
    const summary = yield* run([
      "show",
      "--stat",
      "--format=commit %H%nauthor %an <%ae>%ndate   %ad%n%n  %s",
      commit,
    ]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const diff = yield* run(["show", commit]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const signed = yield* run(["log", "-1", "--format=%h%x00%G?%x00%GS", commit])
    process.stdout.write(`\nCulprit found:\n${summary.stdout.toString().trim()}\n`)
    const signature = Signature.parse(signed.stdout.toString()).at(0)
    if (signature) process.stdout.write(Signature.line(signature) + "\n")
    if (!input.fix) {
      process.stdout.write(`\nPropose a fix with: bolt bisect "${input.command}" --good ${input.good} --fix\n`)
      return
    }
    if (summary.stdoutTruncated || diff.stdoutTruncated)
      return yield* Effect.fail(new Error("Culprit evidence exceeds the analysis limit; inspect the commit directly"))
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    process.stdout.write("Asking the agent for a root cause and a proposed patch...\n")
    const response = yield* Effect.tryPromise(() =>
      answer({
        client,
        directory: cwd,
        agent: "ask",
        model,
        title: `bolt bisect: ${commit.slice(0, 12)}`,
        text:
          INSTRUCTIONS +
          "\n\n" +
          `Failing command: ${input.command}\n\n${summary.stdout}\n\n${diff.stdout}\n\nCommand output:\n${failure.stdout}\n${failure.stderr}`,
        permissions: [
          { action: "*", resource: "*", effect: "allow" },
          ...["edit", "shell", "subagent", "memory_save", "task_create", "task_update"].map((action) => ({
            action,
            resource: "*",
            effect: "deny" as const,
          })),
        ],
      }),
    )
    process.stdout.write(response + "\n")
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
