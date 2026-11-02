import type { OpenCodeClient, SessionPromptInput } from "@opencode/client/promise"
import { execute } from "./answer"
import { createWorktreeLocation, parseSessionTargetModel } from "../session-target"
import { errorMessage } from "../util/error"

export const LABELS = "ABCDEFGH"
export const LIMIT = LABELS.length
export type Model = { providerID: string; modelID: string }

export function format(model: Model) {
  return `${model.providerID}/${model.modelID}`
}

export function parseCandidates(value: string): Model[] | string {
  return parseModels(value, false)
}

export function parseModels(value: string, duplicates = true): Model[] | string {
  const entries = value
    .split(",")
    .map((item) => item.trim())
    .filter(Boolean)
  const models = duplicates ? entries : [...new Set(entries)]
  const flag = duplicates ? "--models" : "--best-of"
  if (models.length < 2) return `${flag} needs at least two comma-separated provider/model entries`
  if (models.length > LIMIT) return `${flag} supports at most ${LIMIT} ${duplicates ? "entries" : "models"}`
  for (const entry of models) {
    try {
      if (!parseSessionTargetModel(entry)) return `${flag} entries must be in provider/model format, got: ${entry}`
    } catch {
      return `${flag} entries must be in provider/model format, got: ${entry}`
    }
  }
  return models.map((entry) => ({
    providerID: entry.slice(0, entry.indexOf("/")),
    modelID: entry.slice(entry.indexOf("/") + 1),
  }))
}

export function judgePrompt(task: string, outputs: { label: string; text: string }[]) {
  return [
    "You are judging anonymous candidate responses to the same task. Answer directly and do not use any tools.",
    "Rank the candidates from best to worst by correctness first, then completeness, then clarity.",
    "",
    "## Task",
    "",
    task,
    "",
    "## Candidates",
    "",
    ...outputs.map((item) => `### Candidate ${item.label}\n\n${item.text.trim() || "(empty output)"}\n`),
    "Reply with one short sentence per candidate explaining its rank.",
    `End with a final line of the form "RANKING: X > Y" listing every candidate label (${outputs.map((item) => item.label).join(", ")}) from best to worst.`,
  ].join("\n")
}

export function parseVerdict(text: string, labels: string[]): string[] | undefined {
  const match = [...text.matchAll(/RANKING:\s*([A-Z](?:\s*>\s*[A-Z])*)/gi)].at(-1)
  if (!match) return
  const order = match[1].split(">").map((item) => item.trim().toUpperCase())
  if (
    order.length !== labels.length ||
    new Set(order).size !== order.length ||
    !labels.every((label) => order.includes(label))
  )
    return
  return order
}

type Candidate = {
  label: string
  model: string
  sessionID?: string
  text?: string
  diff?: string
  worktree?: { directory: string }
  error?: string
}

/** Race V2 sessions; arena gives each contender its own V2-managed worktree. */
export async function tournament(input: {
  client: OpenCodeClient
  models: string
  judge?: string
  variant?: string
  message: string
  directory: string
  agent?: string
  files?: SessionPromptInput["files"]
  arena?: boolean
  cleanup?: boolean
  auto?: boolean
}) {
  const models = input.arena ? parseModels(input.models) : parseCandidates(input.models)
  if (typeof models === "string") throw new Error(models)
  const judge = input.judge ?? format(models[0])
  if (!parseSessionTargetModel(judge)) throw new Error("--judge must be in provider/model format")
  const variant = (model: string) => (input.variant ? `${model.split("#")[0]}#${input.variant}` : model)
  const type = input.arena ? "arena" : "best_of"
  const project = input.arena
    ? (await input.client.location.get({ location: { directory: input.directory } })).project
    : undefined
  const candidates = await Promise.all(
    models.map(async (model, index): Promise<Candidate> => {
      const candidate: Candidate = { label: LABELS[index], model: format(model) }
      try {
        const worktree = input.arena
          ? await createWorktreeLocation({
              client: input.client,
              location: { directory: input.directory },
              name: `arena-${candidate.label.toLowerCase()}`,
            })
          : undefined
        if (worktree) candidate.worktree = { directory: worktree.root }
        const result = await execute({
          client: input.client,
          text: input.message,
          title: `${input.arena ? "arena" : "best-of"} ${candidate.label}: ${candidate.model}`,
          model: variant(candidate.model),
          agent: input.agent ?? "build",
          directory: worktree?.directory ?? input.directory,
          files: input.files,
          retain: true,
          auto: input.auto,
        })
        candidate.text = result.text
        candidate.sessionID = result.sessionID
        if (worktree) {
          const changes = await input.client.vcs.diff({ location: { directory: worktree.root }, mode: "working" })
          const patch = changes.data.map((file) => file.patch).join("\n")
          candidate.diff = patch.length > 20_000 ? patch.slice(0, 20_000) + "\n[diff truncated]" : patch
        }
      } catch (error) {
        candidate.error = errorMessage(error)
        // Missing diff evidence makes this contender ineligible for code judging.
        delete candidate.text
      }
      return candidate
    }),
  )
  const done = candidates.filter((item): item is Candidate & { text: string } => item.text !== undefined)
  let judgeSessionID: string | undefined
  const ranking =
    done.length < 2
      ? done.map((item) => item.label)
      : await execute({
          client: input.client,
          model: judge,
          agent: "ask",
          directory: input.directory,
          retain: true,
          title: `${type} judge: ${judge}`,
          text: judgePrompt(
            input.message,
            done.map((item) => ({
              label: item.label,
              text: `${item.text}${item.diff ? `\n\n#### Diff\n\n\`\`\`diff\n${item.diff}\n\`\`\`` : ""}`,
            })),
          ),
          permissions: [{ action: "*", resource: "*", effect: "deny" }],
        })
          .then((result) => {
            judgeSessionID = result.sessionID
            return parseVerdict(
              result.text,
              done.map((item) => item.label),
            )
          })
          .catch(() => undefined)
  const order = ranking ?? done.map((item) => item.label)
  if (!ranking && done.length > 1)
    process.stderr.write(
      "Judge produced no usable verdict; keeping the first successful candidate in submission order.\n",
    )
  const winner = candidates.find((item) => item.label === order[0])
  let cleanupFailed = false
  if (input.cleanup && project && winner) {
    for (const item of candidates.filter((item) => item !== winner && item.worktree)) {
      await input.client.worktree
        .remove({ projectID: project.id, directory: item.worktree!.directory, force: true })
        .catch((error) => {
          cleanupFailed = true
          process.stderr.write(`Could not remove worktree ${item.worktree!.directory}: ${errorMessage(error)}\n`)
        })
    }
  }
  return {
    type,
    timestamp: Date.now(),
    winner,
    ranking: order,
    judge: { model: judge, sessionID: judgeSessionID },
    candidates,
    cleanupFailed,
  }
}
