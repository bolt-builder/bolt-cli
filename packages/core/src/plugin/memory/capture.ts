import type { Context } from "@opencode/plugin/effect/plugin"
import { MemoryError } from "@bolt-ai/memory/effect/errors"
import type { MemoryPorts } from "@bolt-ai/memory/effect/ports"
import { MemoryService } from "@bolt-ai/memory/effect/service"
import { MemoryTimers } from "@bolt-ai/memory/effect/timers"
import { MemoryTurn } from "@bolt-ai/memory/effect/turn"
import { MemoryRedact } from "@bolt-ai/memory/redact"
import { Model } from "@opencode/schema/model"
import { Session } from "@opencode/schema/session"
import type { SessionMessage } from "@opencode/schema/session-message"
import { Effect, Schema, Stream } from "effect"
import { Snapshot } from "../../snapshot.js"

/** The host extracts V2 transcripts; the original package retains capture policy and storage. */
export const attachCapture = Effect.fn(function* (
  ctx: Context,
  root: string,
  control: (id: string, field: "use" | "contribute") => Effect.Effect<boolean, unknown>,
) {
  const snapshots = yield* Snapshot.Service
  const memory = MemoryService.make()
  const session: MemoryPorts.SessionPort = {
    get: ({ sessionID }) =>
      ctx.session.get({ sessionID: Session.ID.make(sessionID) }).pipe(
        Effect.map((info) => ({ ...(info.parentID ? { parentID: info.parentID } : {}) })),
        Effect.mapError(MemoryError.from),
      ),
    readTurn: ({ sessionID, window }) =>
      Effect.gen(function* () {
        if (!(yield* control(sessionID, "contribute"))) return
        const messages = yield* ctx.session.context({ sessionID: Session.ID.make(sessionID) })
        const last = messages.findLastIndex((item) => item.type === "user")
        if (last < 0) return
        const user = messages[last]
        if (user?.type !== "user") return
        const assistants = messages
          .slice(last + 1)
          .filter(
            (item): item is SessionMessage.Assistant =>
              item.type === "assistant" && !item.error && Boolean(item.finish),
          )
        const assistant = assistants.at(-1)
        if (!assistant) return
        const from = assistants.find((item) => item.snapshot?.start)?.snapshot?.start
        const to = assistants.findLast((item) => item.snapshot?.end)?.snapshot?.end
        const diffs =
          from && to ? yield* snapshots.diff({ from, to }).pipe(Effect.catchCause(() => Effect.succeed([]))) : []
        return {
          user: MemoryRedact.text(user.text),
          assistant: assistants.map(body).join("\n"),
          recent: messages
            .filter((item) => item.type === "user" || item.type === "assistant")
            .slice(-window)
            .map((item) =>
              item.type === "user"
                ? `User: ${MemoryRedact.text(item.text)}`
                : item.type === "assistant" && !item.error
                  ? `Assistant: ${body(item)}`
                  : "",
            )
            .filter(Boolean)
            .join("\n\n"),
          lastAssistantID: assistant.id,
          sessionModel: { providerID: assistant.model.providerID, modelID: assistant.model.id },
          recalledMemory: assistants.some((item) =>
            item.content.some(
              (part) =>
                part.type === "tool" &&
                part.name === "memory_recall" &&
                part.state.status === "completed" &&
                typeof part.state.metadata?.count === "number" &&
                part.state.metadata.count > 0,
            ),
          ),
          diffs: [...diffs],
        }
      }).pipe(Effect.mapError(MemoryError.from)),
  }
  const model: MemoryPorts.ModelPort = {
    resolve: ({ configured, session }) =>
      Effect.try({
        try: () => ({ handle: Model.Ref.parse(configured ?? `${session.providerID}/${session.modelID}`) }),
        catch: MemoryError.from,
      }),
    run: async ({ handle, system, prompt, timeoutMs, signal }) => {
      const model = Schema.decodeUnknownSync(Model.Ref)(handle)
      const result = await Effect.runPromise(
        ctx.experimental.generate
          .text({
            model,
            prompt: `${system}\n\n${prompt}`,
          })
          .pipe(Effect.timeout(timeoutMs)),
        { signal },
      )
      // V2's public stateless generator returns text only; do not invent token/cost totals.
      return { text: result.text, usage: undefined }
    },
  }
  yield* Effect.addFinalizer(() => Effect.sync(() => MemoryTimers.clear(root)))
  yield* ctx.event
    .subscribe({
      types: [
        "session.execution.started",
        "session.execution.succeeded",
        "session.execution.failed",
        "session.execution.interrupted",
      ],
    })
    .pipe(
      Stream.runForEach((event) => {
        const sessionID = event.data.sessionID
        if (event.type === "session.execution.started") return Effect.sync(() => MemoryTurn.open({ sessionID }))
        return MemoryTurn.close({
          root,
          sessionID,
          session,
          model,
          reason:
            event.type === "session.execution.succeeded"
              ? "completed"
              : event.type === "session.execution.failed"
                ? "error"
                : "interrupted",
        }).pipe(Effect.provideService(MemoryService.Service, memory), Effect.forkScoped, Effect.asVoid)
      }),
      Effect.forkScoped({ startImmediately: true }),
    )
})

function body(message: SessionMessage.Assistant) {
  return message.content
    .flatMap((part) => {
      if (part.type === "text") return [MemoryRedact.text(part.text)]
      if (part.type !== "tool") return []
      const details =
        part.state.status === "streaming"
          ? []
          : Object.entries(part.state.input)
              .filter(
                ([key, value]) =>
                  ["command", "filePath", "pattern", "query"].includes(key) && typeof value === "string",
              )
              .map(([key, value]) => `${key}=${MemoryRedact.text(String(value)).slice(0, 220)}`)
      return [`Tool ${part.name} ${part.state.status}${details.length ? ` | ${details.join(" | ")}` : ""}`]
    })
    .filter(Boolean)
    .join("\n")
}
