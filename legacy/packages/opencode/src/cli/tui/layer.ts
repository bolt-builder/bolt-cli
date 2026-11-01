import { run as runTui, type TuiInput } from "@bolt-ai/tui"
import { Global } from "@bolt-ai/core/global"
import { AppNodeBuilder } from "@bolt-ai/core/effect/app-node-builder"
import { Effect } from "effect"

export function run(input: TuiInput) {
  return runTui(input).pipe(Effect.provide(AppNodeBuilder.build(Global.node)))
}
