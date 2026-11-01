import type { OpenCodeClient } from "@opencode/client/promise"
import type { PermissionRule, SessionPromptInput } from "@opencode/client/promise"
import { parseSessionTargetModel } from "../session-target"
import { SessionMessage } from "@opencode/schema/session-message"

type Input = {
  client: OpenCodeClient
  text: string
  agent: string
  model?: string
  title: string
  directory?: string
  auto?: boolean
  sessionID?: string
  retain?: boolean
  files?: SessionPromptInput["files"]
  permissions?: PermissionRule[]
}

/** Run an agent in a disposable session, returning only its final answer. */
export async function answer(input: Input) {
  return (await execute(input)).text
}

/** Retain successful tool outcomes for commands that must verify their work before cleanup. */
export async function execute(input: Input) {
  const model = input.model ? parseSessionTargetModel(input.model) : undefined
  const session = input.sessionID
    ? await input.client.session.get({ sessionID: input.sessionID })
    : await input.client.session.create({
        title: input.title,
        agent: input.agent,
        model,
        location: { directory: input.directory ?? process.cwd() },
        permissions: [...(input.permissions ?? []), { action: "question", resource: "*", effect: "deny" }],
      })
  const controller = new AbortController()
  const stream = input.client.event.subscribe({ signal: controller.signal })[Symbol.asyncIterator]()
  const owned = new Map<string, Promise<boolean>>([[session.id, Promise.resolve(true)]])
  const owns = (id: string): Promise<boolean> => {
    const known = owned.get(id)
    if (known) return known
    const result = input.client.session
      .get({ sessionID: id })
      .then((info) => (info.parentID ? owns(info.parentID) : false))
      .catch(() => false)
    owned.set(id, result)
    return result
  }
  const names = new Map<string, string>()
  const tools: { name: string; metadata?: Record<string, unknown> }[] = []
  let finished = false
  let consuming: Promise<void> | undefined
  const interrupt = () => {
    process.exitCode = 130
    controller.abort()
  }
  process.once("SIGINT", interrupt)
  try {
    if ((await stream.next()).done) throw new Error("Event stream disconnected before prompt admission")
    consuming = (async () => {
      while (true) {
        const next = await stream.next()
        if (next.done) throw new Error("Event stream disconnected during prompt execution")
        const event = next.value
        if (event.type === "permission.asked" && (await owns(event.data.sessionID))) {
          await input.client.permission.reply({
            sessionID: event.data.sessionID,
            requestID: event.data.id,
            decision: input.auto ? "once" : "reject",
            message: input.auto
              ? undefined
              : "This one-shot command cannot request permission. Continue without this action.",
          })
          continue
        }
        if (event.type === "form.created" && (await owns(event.data.form.sessionID))) {
          await input.client.session.form.cancel({
            sessionID: event.data.form.sessionID,
            formID: event.data.form.id,
            message: "This one-shot command cannot ask questions. Continue without an answer.",
          })
          continue
        }
        if (!("sessionID" in event.data) || event.data.sessionID !== session.id) continue
        if (event.type === "session.tool.input.started") names.set(event.data.id, event.data.name)
        if (event.type === "session.tool.success") {
          const name = names.get(event.data.id)
          if (name) tools.push({ name, metadata: event.data.metadata })
        }
        if (event.type === "session.execution.succeeded") {
          finished = true
          return
        }
        if (event.type === "session.execution.failed") {
          finished = true
          throw new Error(event.data.error.message)
        }
        if (event.type === "session.execution.interrupted") {
          finished = true
          throw new Error(`Session interrupted: ${event.data.reason}`)
        }
      }
    })()
    // Attach a handler immediately; a failed event can arrive before prompt admission returns.
    void consuming.catch(() => {})
    await input.client.session.prompt(
      { sessionID: session.id, id: SessionMessage.ID.create(), text: input.text, files: input.files },
      { signal: controller.signal },
    )
    await consuming
    const page = await input.client.message.list({ sessionID: session.id, type: "assistant", order: "desc", limit: 1 })
    const message = page.data.find((item) => item.type === "assistant")
    const text =
      message?.type === "assistant"
        ? message.content
            .flatMap((item) => (item.type === "text" ? [item.text] : []))
            .join("\n")
            .trim()
        : ""
    if (!text) throw new Error("The model returned an empty answer.")
    return { text, tools, sessionID: session.id }
  } finally {
    process.off("SIGINT", interrupt)
    controller.abort()
    await consuming?.catch(() => {})
    if (!finished) await input.client.session.interrupt({ sessionID: session.id }).catch(() => {})
    await stream.return?.().catch(() => {})
    // Piped content and generated diffs must not remain in durable session history.
    if (!input.retain) await input.client.session.remove({ sessionID: session.id }).catch(() => {})
  }
}
