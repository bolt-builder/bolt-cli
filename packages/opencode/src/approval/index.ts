import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer, Stream } from "effect"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { LLMEvent } from "@opencode-ai/llm"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import type { Agent } from "@/agent/agent"
import PROMPT from "./approval.txt"

const RULES: { reason: string; pattern: RegExp }[] = [
  { reason: "recursive force delete", pattern: /\brm\b(?=.*\s-{1,2}\w*r)(?=.*\s(-\w*f\w*|--force)\b)/i },
  { reason: "remote force push", pattern: /\bgit\s+push\b(?=.*\s(--force(?!-with-lease)|-f)\b)/i },
  { reason: "hard reset", pattern: /\bgit\s+reset\b(?=.*\s--hard\b)/i },
  { reason: "forced git clean", pattern: /\bgit\s+clean\b(?=.*\s-\w*f)/i },
  { reason: "forced branch delete", pattern: /\bgit\s+branch\b(?=.*\s-D\b)/ },
  { reason: "destructive sql statement", pattern: /\bdrop\s+(table|database|schema)\b/i },
  { reason: "destructive sql statement", pattern: /\btruncate\s+table\b/i },
  { reason: "unfiltered sql delete", pattern: /\bdelete\s+from\s+\S+(?![\s\S]*\bwhere\b)/i },
  { reason: "filesystem format", pattern: /(^|[;&|]\s*)(sudo\s+)?mkfs(\.\w+)?\b/ },
  { reason: "raw device write", pattern: /\bdd\b(?=.*\bof=\/dev\/)/ },
  { reason: "world-writable permissions", pattern: /\bchmod\b(?=.*\s-\w*R)(?=.*\b777\b)/ },
  { reason: "system power command", pattern: /(^|[;&|]\s*)(sudo\s+)?(shutdown|reboot|halt|poweroff)\b/ },
]

/** Classify a shell command; returns the reason it is considered destructive, or undefined. */
export function destructive(command: string) {
  return RULES.find((rule) => rule.pattern.test(command))?.reason
}

/** Parse the last sign-off marker from the reviewer's response. */
export function verdict(text: string) {
  const matches = [...text.matchAll(/verdict:\s*(approve|reject)/gi)]
  const last = matches.at(-1)
  if (!last) return undefined
  return last[1].toLowerCase() as "approve" | "reject"
}

export interface ReviewInput {
  command: string
  reason: string
  sessionID: string
  user: SessionV1.User
  model: Provider.Model
}

export interface Interface {
  readonly review: (input: ReviewInput) => Effect.Effect<{ approved: boolean; feedback: string }>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Approval") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const provider = yield* Provider.Service
    const llm = yield* LLM.Service

    const review = Effect.fn("Approval.review")(function* (input: ReviewInput) {
      const reviewer: Agent.Info = {
        name: "approval",
        mode: "primary",
        options: {},
        temperature: 0,
        permission: [],
        prompt: PROMPT,
      }
      // Prefer the provider's small model for cheap sign-offs; fall back to the
      // model already running the session so approval works everywhere.
      const model =
        (yield* provider.getSmallModel(input.model.providerID).pipe(Effect.catch(() => Effect.succeed(undefined)))) ??
        input.model
      const text = yield* llm
        .stream({
          agent: reviewer,
          user: input.user,
          system: [],
          small: true,
          tools: {},
          model,
          sessionID: input.sessionID,
          retries: 1,
          messages: [
            {
              role: "user",
              content: [
                `A coding agent wants to run a shell command classified as destructive (${input.reason}).`,
                "",
                "Command:",
                "```",
                input.command,
                "```",
                "",
                "Review it and give your verdict.",
              ].join("\n"),
            },
          ],
        })
        .pipe(
          Stream.filter(LLMEvent.is.textDelta),
          Stream.map((event) => event.text),
          Stream.mkString,
          Effect.catch(() => Effect.succeed("")),
        )
      const outcome = verdict(text)
      const feedback = text.replace(/verdict:\s*(approve|reject)\s*$/i, "").trim()
      // Fail closed: no verdict means no sign-off.
      return {
        approved: outcome === "approve",
        feedback: feedback || "The approval reviewer did not return a verdict; rejecting by default.",
      }
    })

    return Service.of({ review })
  }),
)

export const node = LayerNode.make({ service: Service, layer: layer, deps: [Provider.node, LLM.node] })

export * as Approval from "."
