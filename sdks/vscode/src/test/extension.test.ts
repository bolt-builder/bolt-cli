import { deepStrictEqual, ok, strictEqual } from "node:assert"
import { commands, extensions, workspace } from "vscode"

suite("extension", () => {
  test("registers every bolt command", async () => {
    await extensions.getExtension("bolt-builder.bolt-vscode")?.activate()
    const registered = await commands.getCommands(true)
    for (const id of ["bolt.openTerminal", "bolt.openNewTerminal", "bolt.addFilepathToTerminal", "bolt.addFilepathToChat"]) {
      ok(registered.includes(id), `missing command ${id}`)
    }
  })

  test("the chat view is registered", async () => {
    await extensions.getExtension("bolt-builder.bolt-vscode")?.activate()
    // Focusing the contributed view resolves the webview provider; it throws
    // when the view id is not registered.
    await commands.executeCommand("bolt.chat.focus")
  })

  test("settings have the documented defaults", () => {
    const cfg = workspace.getConfiguration("bolt")
    strictEqual(cfg.get("path"), "")
    deepStrictEqual(cfg.get("args"), [])
    strictEqual(cfg.get("terminal.reuse"), true)
  })
})
