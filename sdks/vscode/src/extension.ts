import * as vscode from "vscode"
import { access, constants } from "node:fs/promises"
import path from "node:path"

const TERMINAL = "Bolt"
const BINARY = "bolt"
const DOCS = "https://github.com/bolt-builder/bolt-cli"

export function activate(context: vscode.ExtensionContext) {
  context.subscriptions.push(
    vscode.commands.registerCommand("bolt.openTerminal", async () => {
      const existing = vscode.window.terminals.find((t) => t.name === TERMINAL)
      if (existing) {
        existing.show()
        return
      }
      await open(context)
    }),
    vscode.commands.registerCommand("bolt.openNewTerminal", async () => {
      await open(context)
    }),
    vscode.commands.registerCommand("bolt.addFilepathToTerminal", () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showInformationMessage("Open a file to add its path to the Bolt terminal.")
        return
      }
      const terminal = vscode.window.terminals.find((t) => t.name === TERMINAL)
      if (!terminal) {
        vscode.window.showInformationMessage("No Bolt terminal is open. Run the Open Bolt command first.")
        return
      }
      terminal.sendText(reference(editor) + " ", false)
      terminal.show()
    }),
  )
}

export function deactivate() {}

// Builds the file reference the Bolt TUI prompt understands: @path, with an
// optional #start or #start-end line suffix when the editor has a selection.
export function reference(editor: vscode.TextEditor) {
  const uri = editor.document.uri
  const inside = vscode.workspace.getWorkspaceFolder(uri) !== undefined
  const file = inside ? vscode.workspace.asRelativePath(uri, false) : uri.fsPath
  const selection = editor.selection
  if (selection.isEmpty) {
    return `@${file}`
  }
  const start = selection.start.line + 1
  const end = selection.end.line + 1
  if (start === end) {
    return `@${file}#${start}`
  }
  return `@${file}#${start}-${end}`
}

async function open(context: vscode.ExtensionContext) {
  const found = await locate()
  if (!found) {
    const action = await vscode.window.showErrorMessage(
      "The Bolt CLI was not found on your PATH. Install it and try again.",
      "Open install docs",
    )
    if (action === "Open install docs") {
      vscode.env.openExternal(vscode.Uri.parse(DOCS))
    }
    return
  }

  const terminal = vscode.window.createTerminal({
    name: TERMINAL,
    iconPath: {
      light: vscode.Uri.file(context.asAbsolutePath("images/bolt-light.svg")),
      dark: vscode.Uri.file(context.asAbsolutePath("images/bolt-dark.svg")),
    },
    location: {
      viewColumn: vscode.ViewColumn.Beside,
      preserveFocus: false,
    },
    env: {
      // The CLI checks this exact variable to enable its IDE integration; see
      // packages/opencode/src/ide in the bolt-cli repository.
      OPENCODE_CALLER: "vscode",
    },
  })
  terminal.show()
  terminal.sendText(BINARY)
}

async function locate() {
  const dirs = (process.env["PATH"] ?? "").split(path.delimiter).filter(Boolean)
  const names = process.platform === "win32" ? [`${BINARY}.exe`, `${BINARY}.cmd`, `${BINARY}.bat`] : [BINARY]
  const checks = dirs.flatMap((dir) => names.map((name) => path.join(dir, name)))
  const results = await Promise.all(
    checks.map((file) =>
      access(file, constants.X_OK).then(
        () => file,
        () => undefined,
      ),
    ),
  )
  return results.find((file) => file !== undefined)
}
