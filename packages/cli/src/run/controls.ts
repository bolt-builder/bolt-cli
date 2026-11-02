import type { SessionMessageAssistantTool } from "@opencode/client/promise"
import { Envelope } from "../util/envelope"
import { Porcelain } from "../util/porcelain"
import { errorMessage } from "../util/error"
import { ExitCode } from "../util/exit"
import { Attempt } from "./attempt"
import { Budget } from "./budget"
import { Report } from "./report"
import { OutputSchema } from "./schema"
import { context } from "./emit"

export type Controls = {
  json?: boolean
  porcelain?: boolean
  emit?: "context"
  maxCost?: number
  maxTokens?: number
  timeout?: number
  retries?: number
  outputSchema?: string
  costReport?: boolean
  autoAgent?: boolean
}

export type Observer = {
  text?: (key: string, text: string) => void
  delta?: (key: string, delta: string) => void
  reasoning?: (text: string) => void
  tool?: (tool: SessionMessageAssistantTool) => void
  step?: (id: string, usage: Budget.StepUsage) => void
  error?: (message: string) => void
}

export function invalid(input: Controls & { format: "default" | "json"; bestOf?: string; agent?: string }) {
  const output = [input.json, input.porcelain, input.emit !== undefined, input.format === "json"].filter(Boolean)
  if (output.length > 1) return "Choose only one of --json, --porcelain, --emit context or --format json"
  if (input.maxCost !== undefined && (!Number.isFinite(input.maxCost) || input.maxCost <= 0))
    return "--max-cost must be a positive number"
  if (input.maxTokens !== undefined && (!Number.isSafeInteger(input.maxTokens) || input.maxTokens <= 0))
    return "--max-tokens must be a positive integer"
  const bounds = Attempt.invalid(input)
  if (bounds) return bounds
  if (input.autoAgent && input.agent !== undefined) return "--auto-agent cannot be used with --agent"
  if (input.bestOf !== undefined && active(input)) return "Run controls cannot be combined with --best-of"
}

export function active(input: Controls) {
  return Boolean(
    input.json ||
      input.porcelain ||
      input.emit ||
      input.maxCost !== undefined ||
      input.maxTokens !== undefined ||
      input.timeout !== undefined ||
      input.retries ||
      input.outputSchema !== undefined ||
      input.costReport ||
      input.autoAgent,
  )
}

/** One control loop around the ordinary V2 event consumer; every attempt retains the same durable session. */
export async function controlled(input: {
  controls: Controls
  format: "default" | "json"
  sessionID: string
  message: string
  schema?: unknown
  run: (next: {
    message: string
    first: boolean
    signal: AbortSignal
    quiet: boolean
    observer: Observer
  }) => Promise<void>
  stop: () => Promise<void>
}) {
  const started = Date.now()
  const seen = new Set<string>()
  let usage = Report.empty
  let budget = Budget.empty
  let breach: string | undefined
  let failure: string | undefined
  let finalTexts: string[] = []
  let prompt =
    input.schema === undefined ? input.message : `${input.message}\n\n${OutputSchema.instructions(input.schema)}`
  let sent = false
  if (input.controls.porcelain) Porcelain.print("session", input.sessionID)
  const event = (type: string, data: Record<string, unknown>) => {
    if (input.format !== "json") return false
    process.stdout.write(JSON.stringify({ type, timestamp: Date.now(), sessionID: input.sessionID, ...data }) + "\n")
    return true
  }
  const error = (message: string) => {
    if (input.controls.json) return
    if (input.controls.porcelain) return Porcelain.print("error", message)
    if (!event("error", { error: { type: "unknown", message } })) process.stderr.write(message + "\n")
  }
  for (let validation = 1; validation <= OutputSchema.ATTEMPTS; validation++) {
    failure = undefined
    for (let index = 1; index <= Attempt.attempts(input.controls); index++) {
      const texts = new Map<string, string>()
      const printed = new Map<string, string>()
      const controller = new AbortController()
      let timedOut = false
      let attemptError: string | undefined
      const timer =
        input.controls.timeout === undefined
          ? undefined
          : setTimeout(() => {
              timedOut = true
              controller.abort()
            }, input.controls.timeout * 1000)
      const observer: Observer = {
        text(key, text) {
          texts.set(key, text)
          if (!input.controls.porcelain || printed.get(key) === text) return
          const previous = printed.get(key) ?? ""
          Porcelain.print("text", text.startsWith(previous) ? text.slice(previous.length) : text)
          printed.set(key, text)
        },
        delta(key, delta) {
          texts.set(key, (texts.get(key) ?? "") + delta)
        },
        reasoning(text) {
          if (input.controls.porcelain) Porcelain.print("reasoning", text)
        },
        tool(tool) {
          if (input.controls.porcelain) Porcelain.print("tool", tool.name, tool.state.status)
        },
        step(id, part) {
          if (seen.has(id)) return
          seen.add(id)
          budget = Budget.add(budget, part)
          usage = Report.add(usage, part)
          breach ??= Budget.exceeded(budget, { cost: input.controls.maxCost, tokens: input.controls.maxTokens })
          if (breach) controller.abort()
        },
        error(message) {
          attemptError = message
          if (input.controls.porcelain) Porcelain.print("error", message)
        },
      }
      try {
        const first = !sent
        sent = true
        await input.run({
          message: prompt,
          first,
          signal: controller.signal,
          quiet: Boolean(input.controls.json || input.controls.porcelain || input.controls.emit),
          observer,
        })
      } catch (caught) {
        if (!controller.signal.aborted) {
          attemptError = errorMessage(caught)
          error(attemptError)
        }
      } finally {
        if (timer !== undefined) clearTimeout(timer)
      }
      finalTexts = [...texts.values()].filter((text) => text.trim())
      if (controller.signal.aborted) {
        // The base client remains usable after the attempt's requests are cancelled.
        // A failed stop must prevent a retry from overlapping the previous execution.
        try {
          await input.stop()
        } catch (caught) {
          failure = `Could not stop the interrupted session: ${errorMessage(caught)}`
          process.exitCode = ExitCode.ERROR
          error(failure)
          break
        }
      }
      if (process.exitCode === 130) {
        failure = "Run interrupted"
        break
      }
      if (breach) {
        failure = breach
        process.exitCode = ExitCode.BUDGET
        if (input.controls.porcelain) Porcelain.print("budget", breach)
        else if (!event("budget_exceeded", { budget, message: breach })) error(breach)
        break
      }
      if (timedOut) {
        failure = Attempt.report(index, input.controls)
        process.exitCode = ExitCode.TIMEOUT
        if (
          !event("timeout", {
            attempt: index,
            attempts: Attempt.attempts(input.controls),
            partial: finalTexts.join("\n\n"),
          })
        ) {
          error(failure)
          if (!input.controls.json && !input.controls.porcelain && finalTexts.length)
            process.stderr.write(`Partial result before the timeout:\n${finalTexts.join("\n\n")}\n`)
        }
      } else if (attemptError || process.exitCode) {
        failure = attemptError ?? "Run failed"
        process.exitCode = ExitCode.ERROR
      } else {
        failure = undefined
        break
      }
      if (!Attempt.again(index, input.controls)) break
      if (
        !event("retry", { attempt: index, attempts: Attempt.attempts(input.controls), message: failure }) &&
        !input.controls.json &&
        !input.controls.porcelain
      )
        process.stderr.write(`attempt ${index}/${Attempt.attempts(input.controls)} failed; retrying\n`)
      process.exitCode = ExitCode.OK
    }
    if (failure || input.schema === undefined) break
    const payload = OutputSchema.payload(finalTexts.join("\n\n"))
    const errors = payload ? OutputSchema.validate(input.schema, payload.value) : ["$: the answer is not valid JSON"]
    if (!errors.length) {
      event("schema_valid", { attempt: validation, value: payload?.value })
      break
    }
    if (validation === OutputSchema.ATTEMPTS) {
      failure = `The answer failed schema validation after ${validation} attempts: ${errors.join("; ")}`
      process.exitCode = ExitCode.ERROR
      if (!event("schema_invalid", { attempt: validation, errors })) error(failure)
      break
    }
    if (!event("schema_retry", { attempt: validation, errors }) && !input.controls.json && !input.controls.porcelain)
      process.stderr.write(
        `answer failed schema validation (attempt ${validation}/${OutputSchema.ATTEMPTS}); retrying\n`,
      )
    prompt = OutputSchema.feedback(errors)
  }
  if (input.controls.costReport) {
    const wall = Date.now() - started
    if (!event("cost_report", Report.json(usage, wall))) process.stderr.write(Report.render(usage, wall) + "\n")
  }
  if (input.controls.json) {
    if (failure) Envelope.printError("SessionError", failure)
    else Envelope.print({ sessionID: input.sessionID, text: finalTexts.join("\n\n") })
  }
  if (input.controls.emit === "context") process.stdout.write(context(input.sessionID, finalTexts) + "\n")
}
