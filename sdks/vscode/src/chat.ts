import * as vscode from "vscode"
import { randomBytes } from "node:crypto"
import { Backend } from "./backend"
import { client, Event } from "./client"
import { Down, Message, State, up } from "./protocol"
import { append } from "./transcript"

// Sidebar chat: bridges the webview to the Bolt server through the typed
// message protocol. The host owns the transcript (persisted in
// workspaceState) and the session; the webview only renders chat text and
// status.

export class Chat implements vscode.WebviewViewProvider {
  static readonly id = "bolt.chat"

  private view: vscode.WebviewView | undefined
  private state: State = { backend: "starting", streaming: false }
  private session: string | undefined
  private api: ReturnType<typeof client> | undefined
  private abort: AbortController | undefined
  private pending: string | undefined

  constructor(
    private context: vscode.ExtensionContext,
    private backend: Backend,
    private log: (text: string) => void,
  ) {
    this.session = context.workspaceState.get("bolt.session")
  }

  resolveWebviewView(view: vscode.WebviewView) {
    this.view = view
    view.webview.options = {
      enableScripts: true,
      localResourceRoots: [
        vscode.Uri.joinPath(this.context.extensionUri, "dist"),
        vscode.Uri.joinPath(this.context.extensionUri, "media"),
      ],
    }
    view.webview.html = this.html(view.webview)
    view.webview.onDidReceiveMessage((raw) => this.receive(raw))
    view.onDidDispose(() => {
      if (this.view === view) {
        this.view = undefined
      }
    })
  }

  // Inserts text into the webview input, holding it until the webview has
  // signalled readiness when the view is still opening.
  insert(text: string) {
    if (!this.view) {
      this.pending = this.pending ? this.pending + text : text
      return
    }
    this.post({ v: 1, type: "insert", text })
  }

  dispose() {
    this.abort?.abort()
  }

  private async receive(raw: unknown) {
    const message = up(raw)
    if (!message) {
      this.log(`dropped malformed webview message`)
      return
    }
    if (message.type === "ready") {
      this.hydrate()
      if (this.pending) {
        this.post({ v: 1, type: "insert", text: this.pending })
        this.pending = undefined
      }
      return
    }
    if (message.type === "prompt") {
      await this.prompt(message.text)
      return
    }
    if (message.type === "stop") {
      if (this.api && this.session) {
        await this.api.interrupt(this.session).catch((error) => this.fail("interrupt", error))
      }
      return
    }
    this.abort?.abort()
    this.abort = undefined
    this.session = undefined
    await this.context.workspaceState.update("bolt.session", undefined)
    await this.context.workspaceState.update("bolt.transcript", undefined)
    await this.context.workspaceState.update("bolt.seq", undefined)
    this.update({ streaming: false })
    this.hydrate()
  }

  private async prompt(text: string) {
    const connected = await this.connect()
    if (!connected || !this.api) {
      return
    }
    await this.save({ role: "user", text })
    try {
      if (!this.session) {
        const folders = vscode.workspace.workspaceFolders ?? []
        this.session = (await this.api.create()).id
        await this.context.workspaceState.update("bolt.session", this.session)
        this.log(`created session ${this.session} (folders: ${folders.length})`)
      }
      this.subscribe()
      await this.api.prompt(this.session, text)
      this.update({ streaming: true })
    } catch (error) {
      this.fail("prompt", error)
    }
  }

  private async connect() {
    const folder = vscode.workspace.workspaceFolders?.[0]
    this.update({ backend: "starting" })
    const connection = await this.backend.start(folder?.uri.fsPath)
    if (!connection) {
      this.update({ backend: "error" })
      this.post({ v: 1, type: "error", message: "The Bolt server could not be started. Check the Bolt output channel." })
      return false
    }
    this.api = client(connection.url, connection.password)
    try {
      await this.api.health()
    } catch (error) {
      this.fail("health check", error)
      return false
    }
    this.update({ backend: "connected" })
    return true
  }

  // (Re)subscribes to the session event stream from the last durable
  // sequence so history is not replayed into the transcript.
  private subscribe() {
    if (this.abort || !this.api || !this.session) {
      return
    }
    const abort = new AbortController()
    this.abort = abort
    const after = this.context.workspaceState.get<number>("bolt.seq")
    this.api
      .events(this.session, after, abort.signal, (event) => this.event(event))
      .catch((error) => {
        if (!abort.signal.aborted) {
          this.fail("event stream", error)
        }
      })
      .finally(() => {
        if (this.abort === abort) {
          this.abort = undefined
        }
      })
  }

  private event(event: Event) {
    if (event.durable) {
      this.context.workspaceState.update("bolt.seq", event.durable.seq)
    }
    if (event.type === "session.next.step.started") {
      const model = event.data["model"] as { id: string; providerID: string } | undefined
      this.update({ streaming: true, model: model ? `${model.providerID}/${model.id}` : this.state.model })
      return
    }
    if (event.type === "session.next.text.delta") {
      this.post({ v: 1, type: "token", text: String(event.data["delta"] ?? "") })
      return
    }
    if (event.type === "session.next.text.ended") {
      this.save({ role: "assistant", text: String(event.data["text"] ?? "") })
      return
    }
    if (event.type === "session.next.step.ended") {
      this.update({ streaming: false })
      return
    }
    if (event.type === "session.next.step.failed") {
      this.update({ streaming: false })
      this.post({ v: 1, type: "error", message: "The agent step failed. Check the Bolt output channel." })
      this.log(`step failed: ${JSON.stringify(event.data["error"])}`)
    }
  }

  private hydrate() {
    this.post({ v: 1, type: "hydrate", messages: this.transcript(), state: this.state })
  }

  private transcript() {
    return this.context.workspaceState.get<Message[]>("bolt.transcript") ?? []
  }

  private async save(message: Message) {
    await this.context.workspaceState.update("bolt.transcript", append(this.transcript(), message))
  }

  private update(patch: Partial<State>) {
    this.state = { ...this.state, ...patch }
    this.post({ v: 1, type: "state", state: this.state })
  }

  private fail(operation: string, error: unknown) {
    this.log(`${operation} failed: ${error instanceof Error ? error.message : String(error)}`)
    this.update({ backend: "error", streaming: false })
    this.post({ v: 1, type: "error", message: `The ${operation} request failed. Check the Bolt output channel.` })
  }

  private post(message: Down) {
    this.view?.webview.postMessage(message)
  }

  private html(webview: vscode.Webview) {
    const nonce = randomBytes(16).toString("base64")
    const script = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "dist", "webview.js"))
    const style = webview.asWebviewUri(vscode.Uri.joinPath(this.context.extensionUri, "media", "webview.css"))
    return `<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta http-equiv="Content-Security-Policy" content="default-src 'none'; style-src ${webview.cspSource}; script-src 'nonce-${nonce}';">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<link rel="stylesheet" href="${style}">
<title>Bolt</title>
</head>
<body>
<div id="status"><span id="backend"></span><span id="model"></span><span id="streaming" hidden>streaming</span></div>
<div id="messages"></div>
<div id="composer">
<textarea id="input" rows="3" placeholder="Ask Bolt (Enter to send, Shift+Enter for a new line)"></textarea>
<div id="actions">
<button id="send">Send</button>
<button id="stop" hidden>Stop</button>
<button id="new">New session</button>
</div>
</div>
<script nonce="${nonce}" src="${script}"></script>
</body>
</html>`
  }
}
