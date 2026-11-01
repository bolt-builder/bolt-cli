import path from "node:path"
import fs from "node:fs/promises"
import { Effect } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { errorMessage } from "../../util/error"

export type Pane = {
  readonly directory: string
  readonly command: string
}

/** Resolve the pane list: one pane per directory, or `count` panes in the current directory. */
export function panes(input: { dirs: string[]; count: number; cwd: string; command: string }): Pane[] {
  if (input.dirs.length) return input.dirs.map((directory) => ({ directory, command: input.command }))
  return Array.from({ length: input.count }, () => ({ directory: input.cwd, command: input.command }))
}

/**
 * Build the tmux invocations for the requested panes. Inside an existing tmux
 * client the current window is split; outside, a detached session is created
 * and optionally attached.
 */
export function plan(input: { panes: Pane[]; inside: boolean; name: string; layout: string; attach: boolean }) {
  const steps: string[][] = []
  if (input.inside) {
    for (const pane of input.panes) steps.push(["split-window", "-d", "-c", pane.directory, pane.command])
    steps.push(["select-layout", input.layout])
    return steps
  }
  const first = input.panes[0]
  steps.push(["new-session", "-d", "-s", input.name, "-c", first.directory, first.command])
  for (const pane of input.panes.slice(1))
    steps.push(["split-window", "-d", "-t", input.name, "-c", pane.directory, pane.command])
  steps.push(["select-layout", "-t", input.name, input.layout])
  if (input.attach) steps.push(["attach-session", "-t", input.name])
  return steps
}

export default Runtime.handler(Commands.commands.mux, (input) =>
  Effect.gen(function* () {
    const tmux = Bun.which("tmux")
    if (!tmux)
      return yield* Effect.fail(
        new Error(
          "bolt mux requires tmux and it was not found on PATH. Install tmux (https://github.com/tmux/tmux/wiki/Installing) and retry.",
        ),
      )
    if (input.count < 1 || input.count > 16)
      return yield* Effect.fail(new Error("--count must be an integer between 1 and 16"))
    if (!/^[A-Za-z0-9_-]+$/.test(input.name))
      return yield* Effect.fail(new Error("--name must contain only letters, digits, underscores or hyphens"))
    const cwd = process.cwd()
    const dirs = input.dirs.map((dir) => path.resolve(cwd, dir))
    for (const dir of dirs)
      if (!(yield* Effect.tryPromise(() => fs.stat(dir))).isDirectory())
        return yield* Effect.fail(new Error(`Directory not found: ${dir}`))
    const app = yield* AppProcess.Service
    const inside = !!process.env.TMUX
    const attach = !inside && process.stdout.isTTY === true
    if (!inside && (yield* app.run(ChildProcess.make(tmux, ["has-session", "-t", input.name]))).exitCode === 0)
      return yield* Effect.fail(
        new Error(
          `tmux session '${input.name}' already exists. Attach with: tmux attach -t ${input.name}, or pass --name.`,
        ),
      )
    for (const step of plan({
      panes: panes({ dirs, count: input.count, cwd, command: "bolt" }),
      inside,
      name: input.name,
      layout: input.layout,
      attach,
    })) {
      const result = yield* app.run(ChildProcess.make(tmux, step, { stdin: "inherit", stdout: "inherit" }), {
        maxErrorBytes: 10000,
      })
      if (result.exitCode !== 0)
        return yield* Effect.fail(
          new Error(`tmux ${step[0]} failed: ${result.stderr.toString().trim() || `exit ${result.exitCode}`}`),
        )
    }
    if (!attach && !inside)
      process.stdout.write(`Started tmux session '${input.name}'. Attach with: tmux attach -t ${input.name}\n`)
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
