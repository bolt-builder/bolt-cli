import { Down, Message, State, Up } from "../protocol"

declare function acquireVsCodeApi(): { postMessage: (message: Up) => void }

const vscode = acquireVsCodeApi()

const messages = element("messages")
const input = element("input") as HTMLTextAreaElement
const send = element("send") as HTMLButtonElement
const stop = element("stop") as HTMLButtonElement
const fresh = element("new") as HTMLButtonElement
const backend = element("backend")
const model = element("model")
const streaming = element("streaming")

let bubble: HTMLElement | undefined
let streamed = ""
let follow = true

window.addEventListener("message", (event: MessageEvent<Down>) => {
  const message = event.data
  if (message.type === "hydrate") {
    messages.textContent = ""
    bubble = undefined
    streamed = ""
    message.messages.forEach(add)
    state(message.state)
    scroll()
    return
  }
  if (message.type === "token") {
    streamed += message.text
    if (!bubble) {
      bubble = add({ role: "assistant", text: "" })
    }
    render(streamed, bubble)
    scroll()
    return
  }
  if (message.type === "state") {
    state(message.state)
    return
  }
  if (message.type === "error") {
    const item = document.createElement("div")
    item.className = "error"
    item.textContent = message.message
    messages.appendChild(item)
    scroll()
    return
  }
  input.value = input.value + message.text
  input.focus()
})

messages.addEventListener("scroll", () => {
  follow = messages.scrollTop + messages.clientHeight >= messages.scrollHeight - 8
})

input.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault()
    submit()
  }
})
send.addEventListener("click", submit)
stop.addEventListener("click", () => vscode.postMessage({ v: 1, type: "stop" }))
fresh.addEventListener("click", () => vscode.postMessage({ v: 1, type: "newSession" }))

vscode.postMessage({ v: 1, type: "ready" })

function submit() {
  const text = input.value.trim()
  if (!text) {
    return
  }
  input.value = ""
  add({ role: "user", text })
  scroll()
  vscode.postMessage({ v: 1, type: "prompt", text })
}

function add(message: Message) {
  const item = document.createElement("div")
  item.className = `bubble ${message.role}`
  render(message.text, item)
  messages.appendChild(item)
  return item
}

function state(next: State) {
  backend.textContent = next.backend
  backend.className = next.backend
  model.textContent = next.model ?? ""
  streaming.hidden = !next.streaming
  stop.hidden = !next.streaming
  if (!next.streaming) {
    bubble = undefined
    streamed = ""
  }
}

// Minimal markdown: fenced code blocks and inline code, everything built
// from text nodes so assistant output is never parsed as HTML.
function render(text: string, parent: HTMLElement) {
  parent.textContent = ""
  text.split("```").forEach((part, index) => {
    if (index % 2 === 1) {
      const pre = document.createElement("pre")
      const code = document.createElement("code")
      code.textContent = part.replace(/^[\w-]*\n/, "")
      pre.appendChild(code)
      parent.appendChild(pre)
      return
    }
    part.split(/`([^`\n]+)`/).forEach((piece, position) => {
      if (position % 2 === 1) {
        const code = document.createElement("code")
        code.textContent = piece
        parent.appendChild(code)
        return
      }
      parent.appendChild(document.createTextNode(piece))
    })
  })
}

function scroll() {
  if (follow) {
    messages.scrollTop = messages.scrollHeight
  }
}

function element(id: string) {
  const found = document.getElementById(id)
  if (!found) {
    throw new Error(`missing element ${id}`)
  }
  return found
}
