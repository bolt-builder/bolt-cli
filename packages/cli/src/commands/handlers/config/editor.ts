import { Effect } from "effect"
import { Commands } from "../../commands"
import { Runtime } from "../../../framework/runtime"
import { target } from "./shared"
export function editor() {
  return process.env.EDITOR?.trim() || process.env.VISUAL?.trim() || undefined
}
export default Runtime.handler(Commands.commands.config.commands.edit, () =>
  Effect.gen(function* () {
    const command = editor()
    if (!command) return yield* Effect.fail(new Error("No editor configured. Set $EDITOR (or $VISUAL) and try again."))
    const file = yield* target(true)
    if (!(yield* Effect.promise(() => Bun.file(file).exists()))) yield* Effect.promise(() => Bun.write(file, "{}\n"))
    const shell =
      process.platform === "win32"
        ? ["cmd", "/d", "/s", "/c", `${command} "%BOLT_CONFIG_EDIT_FILE%"`]
        : ["sh", "-c", `${command} "$BOLT_CONFIG_EDIT_FILE"`]
    const code = yield* Effect.tryPromise({
      try: () =>
        Bun.spawn(shell, {
          env: { ...process.env, BOLT_CONFIG_EDIT_FILE: file },
          stdin: "inherit",
          stdout: "inherit",
          stderr: "inherit",
        }).exited,
      catch: (cause) => cause,
    })
    if (code !== 0) return yield* Effect.fail(new Error(`Editor exited with code ${code}`))
    process.stdout.write(`Edited ${file}\n`)
  }),
)
