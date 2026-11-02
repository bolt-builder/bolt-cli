import type { SessionMessageInfo } from "@opencode/client/promise"

/** Presentation data shared by the V1 Markdown/HTML formats and transcript search. */
export type Part =
  | { type: "text" | "reasoning"; text: string }
  | { type: "file"; filename?: string; url: string }
  | { type: "step-start" }
  | { type: "tool"; tool: string; state: ToolState }

export type ToolState =
  | { status: "pending" | "running"; input: unknown }
  | { status: "completed"; input: unknown; title: string; output: string }
  | { status: "error"; input: unknown; error: string }

export interface Turn {
  info: { id: string; time: { created: number } } & (
    | { role: "user" }
    | { role: "assistant"; agent: string; providerID: string; modelID: string }
  )
  parts: readonly Part[]
}

export function turns(messages: readonly SessionMessageInfo[]): Turn[] {
  return messages.flatMap((message): Turn[] => {
    if (message.type === "user")
      return [
        {
          info: { id: message.id, role: "user", time: message.time },
          parts: [
            { type: "text", text: message.text },
            ...(message.files ?? []).map(
              (file): Part => ({
                type: "file",
                filename: file.name,
                url: file.source.type === "uri" ? file.source.uri : (file.name ?? "attachment"),
              }),
            ),
          ],
        },
      ]
    if (message.type !== "assistant") return []
    return [
      {
        info: {
          id: message.id,
          role: "assistant",
          time: message.time,
          agent: message.agent,
          providerID: message.model.providerID,
          modelID: message.model.id,
        },
        parts: message.content.map((part): Part => {
          if (part.type !== "tool") return { type: part.type, text: part.text }
          const state = part.state
          const title =
            "metadata" in state && typeof state.metadata?.title === "string" ? state.metadata.title : part.name
          return {
            type: "tool",
            tool: part.name,
            state:
              state.status === "completed"
                ? {
                    status: "completed",
                    input: state.input,
                    title,
                    output: state.content
                      .flatMap((content) => (content.type === "text" ? [content.text] : []))
                      .join("\n"),
                  }
                : state.status === "error"
                  ? { status: "error", input: state.input, error: state.error.message }
                  : { status: state.status === "streaming" ? "pending" : "running", input: state.input },
          }
        }),
      },
    ]
  })
}
