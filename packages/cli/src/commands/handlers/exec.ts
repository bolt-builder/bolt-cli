import path from "node:path"
import { Effect, Option } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { execute } from "../../services/answer"

export interface Step {
  title: string
  body: string
}

/**
 * Parse a markdown playbook into ordered steps. Level-2+ headings each start a
 * step (any preamble before the first heading is ignored). When the document
 * has no headings, top-level list items (`-`, `*`, `+`, `1.`, including task
 * checkboxes) become the steps instead. Markers inside fenced code blocks are
 * ignored.
 */
export function steps(markdown: string): Step[] {
  const lines = markdown.split("\n")
  const fences: boolean[] = []
  let fence: string | undefined
  for (const line of lines) {
    if (fence) {
      fences.push(true)
      const closing = /^\s*(`{3,}|~{3,})\s*$/.exec(line)?.[1]
      if (closing && closing[0] === fence[0] && closing.length >= fence.length) fence = undefined
      continue
    }
    fence = /^\s*(`{3,}|~{3,})/.exec(line)?.[1]
    fences.push(Boolean(fence))
  }

  const heading = /^#{2,6}\s+(.+)$/
  const item = /^(?:[-*+]|\d+[.)])\s+(?:\[[ xX]\]\s+)?(.+)$/

  const found: Step[] = []
  const hasHeading = lines.some((line, index) => !fences[index] && heading.test(line))
  const marker = hasHeading ? heading : item
  for (const [index, line] of lines.entries()) {
    const match = fences[index] ? null : line.match(marker)
    if (match) {
      found.push({ title: match[1].trim(), body: "" })
      continue
    }
    const last = found.at(-1)
    if (!last) continue
    if (!hasHeading && !fences[index] && /^\S/.test(line) && line.trim() !== "") continue
    last.body = last.body ? `${last.body}\n${line}` : line
  }
  return found.map((step) => ({ title: step.title, body: step.body.trim() })).filter((step) => step.title.length > 0)
}

/**
 * Parse the step outcome marker from the final non-empty line of an agent
 * response. Markers quoted or embedded mid-response do not count; the prompt
 * contract requires the response to end with the marker.
 */
export function outcome(text: string) {
  const match = /^step:\s*(done|failed)\s*$/i.exec(text.trimEnd().split("\n").at(-1) ?? "")
  if (!match) return undefined
  return match[1].toLowerCase() as "done" | "failed"
}

/** Prompt sent for one playbook step. */
export function prompt(step: Step, index: number, total: number) {
  return [
    `You are executing step ${index} of ${total} from a playbook, in order. Complete only this step, then stop.`,
    'End your final message with exactly one line: "Step: DONE" if the step was completed, or "Step: FAILED" if it could not be completed.',
    "",
    `Step ${index}: ${step.title}`,
    ...(step.body ? ["", step.body] : []),
  ].join("\n")
}

export default Runtime.handler(Commands.commands.exec, (input) =>
  Effect.gen(function* () {
    const file = Bun.file(path.resolve(input.file))
    if (!(yield* Effect.promise(() => file.exists())))
      return yield* Effect.fail(new Error(`Playbook not found: ${input.file}`))
    const list = steps(yield* Effect.promise(() => file.text()))
    if (!list.length)
      return yield* Effect.fail(
        new Error("No steps found in the playbook. Use level-2 headings or top-level list items."),
      )
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    let sessionID: string | undefined
    for (const [index, step] of list.entries()) {
      const position = `${index + 1}/${list.length}`
      process.stdout.write(`── step ${position}: ${step.title} ──\n`)
      const result = yield* Effect.tryPromise(() =>
        execute({
          client,
          sessionID,
          retain: true,
          text: prompt(step, index + 1, list.length),
          title: `bolt exec ${path.basename(input.file)}`,
          agent: Option.getOrElse(input.agent, () => "build"),
          model: Option.getOrUndefined(input.model),
          permissions: [
            { action: "edit", resource: "*", effect: "allow" },
            { action: "shell", resource: "*", effect: "allow" },
          ],
        }),
      )
      sessionID = result.sessionID
      process.stdout.write(result.text + "\n")
      const verdict = outcome(result.text)
      if (verdict === "failed")
        return yield* Effect.fail(new Error(`Step ${position} reported failure; stopping the playbook.`))
      if (verdict === undefined) {
        process.stderr.write(`Could not determine the outcome of step ${position}; stopping the playbook.\n`)
        process.exitCode = 2
        return
      }
    }
    process.stdout.write(`Completed ${list.length} step${list.length === 1 ? "" : "s"}.\n`)
  }),
)
