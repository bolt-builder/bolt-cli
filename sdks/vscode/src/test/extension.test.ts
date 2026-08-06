import { deepStrictEqual, ok, strictEqual } from "node:assert"
import { commands, extensions, workspace } from "vscode"

suite("extension", () => {
  test("registers every bolt command", async () => {
    await extensions.getExtension("bolt-builder.bolt-vscode")?.activate()
    const registered = await commands.getCommands(true)
    for (const id of ["bolt.openTerminal", "bolt.openNewTerminal", "bolt.addFilepathToTerminal"]) {
      ok(registered.includes(id), `missing command ${id}`)
    }
  })

  test("settings have the documented defaults", () => {
    const cfg = workspace.getConfiguration("bolt")
    strictEqual(cfg.get("path"), "")
    deepStrictEqual(cfg.get("args"), [])
    strictEqual(cfg.get("terminal.reuse"), true)
  })
})
