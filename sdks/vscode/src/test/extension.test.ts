import * as assert from "node:assert"
import * as vscode from "vscode"

suite("extension", () => {
  test("registers every bolt command", async () => {
    await vscode.extensions.getExtension("bolt-builder.bolt-vscode")?.activate()
    const commands = await vscode.commands.getCommands(true)
    for (const id of ["bolt.openTerminal", "bolt.openNewTerminal", "bolt.addFilepathToTerminal"]) {
      assert.ok(commands.includes(id), `missing command ${id}`)
    }
  })

  test("settings have the documented defaults", () => {
    const cfg = vscode.workspace.getConfiguration("bolt")
    assert.strictEqual(cfg.get("path"), "")
    assert.deepStrictEqual(cfg.get("args"), [])
    assert.strictEqual(cfg.get("terminal.reuse"), true)
  })
})
