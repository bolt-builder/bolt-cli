import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { Context, Effect, Layer, Stream } from "effect"
import { SessionV1 } from "@opencode-ai/core/v1/session"
import { LLMEvent } from "@opencode-ai/llm"
import { Provider } from "@/provider/provider"
import { LLM } from "@/session/llm"
import type { Agent } from "@/agent/agent"
import PROMPT from "./guardrail.txt"

const RULES: { reason: string; pattern: RegExp }[] = [
  { reason: "remote code execution", pattern: /\b(curl|wget)\b[^|;&]*\|\s*(sudo\s+)?(ba|z|da)?sh\b/i },
  {
    reason: "secret exfiltration",
    pattern: /(\.ssh\/|\.env\b|\bcredentials\b|\bprintenv\b|\benv\b\s*\|)(?=[\s\S]*\b(curl|wget|nc|scp)\b)/i,
  },
  { reason: "recursive delete", pattern: /\brm\b(?=.*\s-{1,2}\w*r)/i },
  {
    reason: "history rewrite",
    pattern: /\bgit\s+(push\b(?=.*\s(--force(?!-with-lease)|-f)\b)|reset\b(?=.*\s--hard\b)|clean\b(?=.*\s-\w*f))/i,
  },
  { reason: "privilege escalation", pattern: /(^|[;&|]\s*)sudo\b/ },
  {
    reason: "system file modification",
    pattern: /(>>?\s*\/(etc|usr|boot|var\/lib)\/|\btee\s+(-a\s+)?\/(etc|usr|boot)\/)/,
  },
  { reason: "recursive permission change", pattern: /\b(chmod|chown)\b(?=.*\s(-\w*R\w*|--recursive)\b)/ },
  { reason: "raw device access", pattern: /\b(dd|mkfs(\.\w+)?|fdisk|parted)\b(?=.*\/dev\/)/ },
  { reason: "package publish", pattern: /\b(npm|pnpm|yarn|bun)\s+publish\b|\bcargo\s+publish\b|\btwine\s+upload\b/ },
]

/** Classify a shell command; returns the reason it is considered risky, or undefined. */
export function risky(command: string) {
  return RULES.find((rule) => rule.pattern.test(command))?.reason
}

/** Parse the last guardrail marker from the agent's response. */
export function verdict(text: string) {
  const matches = [...text.matchAll(/verdict:\s*(allow|veto)/gi)]
  const last = matches.at(-1)
  if (!last) return undefined
  return last[1].toLowerCase() as "allow" | "veto"
}

export interface ReviewInput {
  command: string
  reason: string
  intent?: string
  sessionID: string
  user: SessionV1.User
  model: Provider.Model
}

export interface Interface {
  readonly review: (input: ReviewInput) => Effect.Effect<{ vetoed: boolean; feedback: string }>
}

export class Service extends Context.Service<Service, Interface>()("@opencode/Guardrail") {}

const layer = Layer.effect(
  Service,
  Effect.gen(function* () {
    const provider = yield* Provider.Service
    const llm = yield* LLM.Service

    const review = Effect.fn("Guardrail.review")(function* (input: ReviewInput) {
      const guardrail: Agent.Info = {
        name: "guardrail",
        mode: "primary",
        options: {},
        temperature: 0,
        permission: [],
        prompt: PROMPT,
      }
      const model =
        (yield* provider.getSmallModel(input.model.providerID).pipe(Effect.catch(() => Effect.succeed(undefined)))) ??
        input.model
      const text = yield* llm
        .stream({
          agent: guardrail,
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
                `A coding agent wants to run a shell command flagged as risky (${input.reason}).`,
                "",
                ...(input.intent ? ["The user's most recent request:", "```", input.intent, "```", ""] : []),
                "Command:",
                "```",
                input.command,
                "```",
                "",
                "Decide whether it may proceed.",
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
      // The guardrail is advisory unless it explicitly vetoes: an unreachable
      // or inconclusive reviewer must not brick every risky-but-normal command.
      return {
        vetoed: outcome === "veto",
        feedback: text.replace(/verdict:\s*(allow|veto)\s*$/i, "").trim(),
      }
    })

    return Service.of({ review })
  }),
)

export const node = LayerNode.make({ service: Service, layer: layer, deps: [Provider.node, LLM.node] })

export * as Guardrail from "."
