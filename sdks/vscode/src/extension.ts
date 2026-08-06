import { commands, env, ExtensionContext, Terminal, TextEditor, Uri, ViewColumn, window, workspace, WorkspaceFolder } from "vscode"
import { locate } from "./binary"
import { config } from "./config"
import { display, reference } from "./format"

const DOCS = "https://github.com/bolt-builder/bolt-cli"

const output = window.createOutputChannel("Bolt")

export function activate(context: ExtensionContext) {
  // Seed with terminals restored by VS Code across window reloads so reuse
  // and filepath insertion keep targeting them.
  const terminals: Terminal[] = window.terminals.filter((t) => /^Bolt( \(\d+\))?$/.test(t.name))

  context.subscriptions.push(
    output,
    window.onDidCloseTerminal((terminal) => {
      const index = terminals.indexOf(terminal)
      if (index === -1) {
        return
      }
      terminals.splice(index, 1)
      log(`terminal closed: ${terminal.name}`)
    }),
    commands.registerCommand("bolt.openTerminal", async () => {
      const existing = terminals.at(-1)
      if (config().reuse && existing) {
        existing.show()
        return
      }
      await launch(context, terminals)
    }),
    commands.registerCommand("bolt.openNewTerminal", async () => {
      await launch(context, terminals)
    }),
    commands.registerCommand("bolt.addFilepathToTerminal", () => {
      const editor = window.activeTextEditor
      if (!editor) {
        window.showInformationMessage("Open a file to add its path to the Bolt terminal.")
        return
      }
      const terminal = terminals.at(-1)
      if (!terminal) {
        window.showInformationMessage("No Bolt terminal is open. Run the Open Bolt command first.")
        return
      }
      terminal.sendText(`${active(editor)} `, false)
      terminal.show()
    }),
  )
}

async function launch(context: ExtensionContext, terminals: Terminal[]) {
  const cfg = config()
  const found = await locate(cfg.path, process.env["PATH"] ?? "")
  log(`binary resolution: setting=${JSON.stringify(cfg.path)} resolved=${found ?? "not found"}`)
  if (!found) {
    await missing(cfg.path)
    return
  }

  const folders = workspace.workspaceFolders ?? []
  const dir = folders.length > 1 ? await pick(context, folders) : folders[0]
  if (folders.length > 1 && !dir) {
    return
  }

  const terminal = window.createTerminal({
    name: terminals.length === 0 ? "Bolt" : `Bolt (${terminals.length + 1})`,
    cwd: dir?.uri,
    iconPath: {
      light: Uri.file(context.asAbsolutePath("images/bolt-light.svg")),
      dark: Uri.file(context.asAbsolutePath("images/bolt-dark.svg")),
    },
    location: {
      viewColumn: ViewColumn.Beside,
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

// Tells the user the CLI could not be resolved and offers the docs or the
// bolt.path setting as fixes.
async function missing(explicit: string) {
  const action = await window.showErrorMessage(
    explicit
      ? "The bolt.path setting does not point to an executable Bolt CLI."
      : "The Bolt CLI was not found on your PATH. Install it and try again.",
    "Open install docs",
    "Open Settings",
  )
  if (action === "Open install docs") {
    env.openExternal(Uri.parse(DOCS))
  }
  if (action === "Open Settings") {
    commands.executeCommand("workbench.action.openSettings", "bolt.path")
  }
}

async function pick(context: ExtensionContext, folders: readonly WorkspaceFolder[]) {
  const last = context.workspaceState.get<string>("bolt.folder")
  const items = folders
    .map((folder) => ({ label: folder.name, description: folder.uri.fsPath, folder }))
    .sort((a, b) => Number(b.folder.uri.toString() === last) - Number(a.folder.uri.toString() === last))
  const item = await window.showQuickPick(items, { placeHolder: "Select the folder to run Bolt in" })
  if (!item) {
    return undefined
  }
  await context.workspaceState.update("bolt.folder", item.folder.uri.toString())
  return item.folder
}

function active(editor: TextEditor) {
  const uri = editor.document.uri
  const folder = workspace.getWorkspaceFolder(uri)
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
