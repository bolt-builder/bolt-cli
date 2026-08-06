import * as vscode from "vscode"
import { locate } from "./binary"
import { config } from "./config"
import { display, reference } from "./format"

const DOCS = "https://github.com/bolt-builder/bolt-cli"

const output = vscode.window.createOutputChannel("Bolt")

export function activate(context: vscode.ExtensionContext) {
  // Seed with terminals restored by VS Code across window reloads so reuse
  // and filepath insertion keep targeting them.
  const terminals: vscode.Terminal[] = vscode.window.terminals.filter((t) => /^Bolt( \(\d+\))?$/.test(t.name))

  context.subscriptions.push(
    output,
    vscode.window.onDidCloseTerminal((terminal) => {
      const index = terminals.indexOf(terminal)
      if (index === -1) {
        return
      }
      terminals.splice(index, 1)
      log(`terminal closed: ${terminal.name}`)
    }),
    vscode.commands.registerCommand("bolt.openTerminal", async () => {
      const existing = terminals.at(-1)
      if (config().reuse && existing) {
        existing.show()
        return
      }
      await launch(context, terminals)
    }),
    vscode.commands.registerCommand("bolt.openNewTerminal", async () => {
      await launch(context, terminals)
    }),
    vscode.commands.registerCommand("bolt.addFilepathToTerminal", () => {
      const editor = vscode.window.activeTextEditor
      if (!editor) {
        vscode.window.showInformationMessage("Open a file to add its path to the Bolt terminal.")
        return
      }
      const terminal = terminals.at(-1)
      if (!terminal) {
        vscode.window.showInformationMessage("No Bolt terminal is open. Run the Open Bolt command first.")
        return
      }
      terminal.sendText(active(editor) + " ", false)
      terminal.show()
    }),
  )
}

async function launch(context: vscode.ExtensionContext, terminals: vscode.Terminal[]) {
  const cfg = config()
  const found = await locate(cfg.path, process.env["PATH"] ?? "")
  log(`binary resolution: setting=${JSON.stringify(cfg.path)} resolved=${found ?? "not found"}`)
  if (!found) {
    const action = await vscode.window.showErrorMessage(
      cfg.path
        ? "The bolt.path setting does not point to an executable Bolt CLI."
        : "The Bolt CLI was not found on your PATH. Install it and try again.",
      "Open install docs",
      "Open Settings",
    )
    if (action === "Open install docs") {
      vscode.env.openExternal(vscode.Uri.parse(DOCS))
    }
    if (action === "Open Settings") {
      vscode.commands.executeCommand("workbench.action.openSettings", "bolt.path")
    }
    return
  }

  const folders = vscode.workspace.workspaceFolders ?? []
  const dir = folders.length > 1 ? await pick(context, folders) : folders[0]
  if (folders.length > 1 && !dir) {
    return
  }

  const terminal = vscode.window.createTerminal({
    name: terminals.length === 0 ? "Bolt" : `Bolt (${terminals.length + 1})`,
    cwd: dir?.uri,
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
  terminals.push(terminal)
  log(`terminal opened: ${terminal.name} cwd=${dir?.uri.fsPath ?? "none"}`)
  terminal.show()
  // Send the bare name when resolved via PATH so the shell handles quoting;
  // an explicit setting is sent as-is and may need quoting by the user.
  const command = cfg.path ? cfg.path : "bolt"
  terminal.sendText([command, ...cfg.args].join(" "))
}

async function pick(context: vscode.ExtensionContext, folders: readonly vscode.WorkspaceFolder[]) {
  const last = context.workspaceState.get<string>("bolt.folder")
  const items = folders
    .map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder }))
    .sort((a, b) => Number(b.folder.uri.toString() === last) - Number(a.folder.uri.toString() === last))
  const item = await vscode.window.showQuickPick(items, { placeHolder: "Select the folder to run Bolt in" })
  if (!item) {
    return
  }
  await context.workspaceState.update("bolt.folder", item.folder.uri.toString())
  return item.folder
}

function active(editor: vscode.TextEditor) {
  const uri = editor.document.uri
  const folder = vscode.workspace.getWorkspaceFolder(uri)
  const file = display(uri.fsPath, folder?.uri.fsPath)
  const selection = editor.selection
  if (selection.isEmpty) {
    return reference({ file })
  }
  return reference({ file, start: selection.start.line + 1, end: selection.end.line + 1 })
}

function log(text: string) {
  output.appendLine(`${new Date().toISOString()} ${text}`)
}
