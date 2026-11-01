import path from "node:path"
import fs from "node:fs/promises"
import { Effect, Option } from "effect"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { EffectFlock } from "@opencode/util/effect-flock"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { parseSessionTargetModel } from "../../session-target"
import { errorMessage } from "../../util/error"

const LIMIT = 60_000
const INSTRUCTIONS = [
  "You are resolving a git merge conflict by intent, not by picking lines.",
  "The file below contains conflict markers. Understand what each side is trying to accomplish and produce a resolution that preserves the intent of both sides. When the changes are independent, combine them. When they genuinely contradict, prefer the side whose change is more recent and explain why.",
  "First explain each conflict and your resolution in one or two sentences. Then output the complete resolved file in a single fenced code block. The block must contain the entire file with no conflict markers.",
].join("\n")

export type Hunk = {
  readonly ours: string
  readonly theirs: string
  readonly base?: string
  readonly ourl: string
  readonly theirl: string
}

/** Parse conflict-marker hunks out of a conflicted file, including diff3-style base sections. */
export function hunks(text: string) {
  const found: Hunk[] = []
  const lines = text.split("\n")
  let at = 0
  while (at < lines.length) {
    const line = lines[at]
    if (!line.startsWith("<<<<<<<")) {
      at += 1
      continue
    }
    const ourl = line.slice(7).trim()
    const ours: string[] = []
    const base: string[] = []
    const theirs: string[] = []
    let section = "ours"
    let closed = false
    at += 1
    while (at < lines.length && !closed) {
      const current = lines[at]
      if (current.startsWith("|||||||") && section === "ours") {
        section = "base"
        at += 1
        continue
      }
      if (current.startsWith("=======") && section !== "theirs") {
        section = "theirs"
        at += 1
        continue
      }
      if (current.startsWith(">>>>>>>") && section === "theirs") {
        found.push({
          ours: ours.join("\n"),
          theirs: theirs.join("\n"),
          ...(base.length ? { base: base.join("\n") } : {}),
          ourl,
          theirl: current.slice(7).trim(),
        })
        closed = true
        at += 1
        continue
      }
      if (section === "ours") ours.push(current)
      if (section === "base") base.push(current)
      if (section === "theirs") theirs.push(current)
      at += 1
    }
  }
  return found
}

/** Parse unmerged paths out of `git status --porcelain=v1` output. */
export function unmerged(text: string) {
  const codes = ["DD", "AU", "UD", "UA", "DU", "AA", "UU"]
  return text
    .split("\n")
    .filter((line) => codes.includes(line.slice(0, 2)))
    .map((line) => line.slice(3).trim())
    .filter(Boolean)
}

/** Extract the resolved file content from the last fenced code block of an agent response. */
export function merged(text: string) {
  const blocks = [...text.matchAll(/```[^\n]*\n([\s\S]*?)```/g)]
  const last = blocks.at(-1)
  if (!last) return undefined
  const content = last[1]
  if (!content.trim()) return undefined
  if (/^(<{7}|={7}$|>{7}|\|{7})/mu.test(content)) return undefined
  return content.endsWith("\n") ? content : `${content}\n`
}

export default Runtime.handler(Commands.commands.resolve, (input) =>
  Effect.gen(function* () {
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const cwd = root.stdout.toString().trim()
    const status = yield* git
      .run(["diff", "--name-only", "--diff-filter=U", "-z"], cwd)
      .pipe(Effect.flatMap(AppProcess.requireSuccess))
    const conflicted = status.stdout.toString().split("\0").filter(Boolean)
    const files = [
      ...new Set(
        input.files.length
          ? input.files.map((file) => path.relative(cwd, path.resolve(process.cwd(), file)).replaceAll("\\", "/"))
          : conflicted,
      ),
    ]
    if (!files.length) {
      process.stdout.write("No merge conflicts to resolve.\n")
      return
    }
    const unknown = files.filter((file) => !conflicted.includes(file))
    if (unknown.length) return yield* Effect.fail(new Error(`Not unmerged: ${unknown.join(", ")}`))
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    const lock = yield* EffectFlock.Service
    const failures: string[] = []
    for (const file of files) {
      yield* Effect.scoped(
        Effect.gen(function* () {
          const absolute = path.join(cwd, file)
          const stat = yield* Effect.tryPromise(() => fs.lstat(absolute))
          if (!stat.isFile()) return yield* Effect.fail(new Error("conflict is not a regular file"))
          yield* lock.acquire(`bolt.resolve:${absolute}`)
          const original = yield* Effect.tryPromise(async () => {
            const handle = await fs.open(absolute, "r")
            try {
              const buffer = Buffer.alloc(LIMIT + 1)
              const read = await handle.read(buffer, 0, buffer.length, 0)
              return buffer.subarray(0, read.bytesRead)
            } finally {
              await handle.close()
            }
          })
          if (original.length > LIMIT) return yield* Effect.fail(new Error("too large to resolve in one shot"))
          const found = hunks(original.toString())
          if (!found.length) return yield* Effect.fail(new Error("no conflict markers found"))
          const staged = yield* git
            .run(["ls-files", "--unmerged", "-z", "--", file], cwd)
            .pipe(Effect.flatMap(AppProcess.requireSuccess))
          process.stdout.write(`Resolving ${file} (${found.length} conflict${found.length === 1 ? "" : "s"})...\n`)
          const text = yield* Effect.tryPromise({
            try: () =>
              answer({
                client,
                model,
                agent: "plan",
                directory: cwd,
                title: `bolt resolve: ${file}`,
                permissions: [
                  { action: "edit", resource: "*", effect: "deny" },
                  { action: "shell", resource: "*", effect: "deny" },
                  { action: "subagent", resource: "*", effect: "deny" },
                  { action: "memory_save", resource: "*", effect: "deny" },
                  { action: "task_create", resource: "*", effect: "deny" },
                  { action: "task_update", resource: "*", effect: "deny" },
                ],
                text: `${INSTRUCTIONS}\n\nFile: ${file}\nOurs: ${found[0].ourl}\nTheirs: ${found[0].theirl}\n\n\`\`\`\n${original.toString()}\n\`\`\``,
              }),
            catch: (cause) => cause,
          })
          const resolution = merged(text)
          if (!resolution) return yield* Effect.fail(new Error("the model did not return a clean resolution"))
          const opening = text.lastIndexOf("```", text.lastIndexOf("```") - 1)
          process.stdout.write(`\n${opening > 0 ? text.slice(0, opening).trim() : `Resolved ${file}.`}\n\n`)
          if (!input.apply) {
            process.stdout.write(
              `Proposed resolution for ${file} (rerun with --apply to write and stage it):\n${resolution}`,
            )
            return
          }
          const current = yield* Effect.tryPromise(() => fs.lstat(absolute))
          if (!current.isFile() || current.size > LIMIT)
            return yield* Effect.fail(new Error("file changed while resolving; rerun to preserve the new content"))
          const content = yield* Effect.tryPromise(() => fs.readFile(absolute))
          const index = yield* git
            .run(["ls-files", "--unmerged", "-z", "--", file], cwd)
            .pipe(Effect.flatMap(AppProcess.requireSuccess))
          if (!content.equals(original) || !index.stdout.equals(staged.stdout))
            return yield* Effect.fail(
              new Error("file or index changed while resolving; rerun to preserve the new content"),
            )
          yield* Effect.tryPromise(() => fs.writeFile(absolute, resolution))
          const added = yield* git.run(["add", "--", file], cwd)
          if (added.exitCode !== 0)
            return yield* Effect.fail(new Error(`resolved but failed to stage: ${added.stderr.toString().trim()}`))
          process.stdout.write(`Resolved and staged ${file}.\n`)
        }),
      ).pipe(
        Effect.catch((error) =>
          Effect.sync(() => {
            failures.push(`${file}: ${errorMessage(error)}`)
          }),
        ),
      )
    }
    if (failures.length) return yield* Effect.fail(new Error(failures.join("\n")))
  }).pipe(Effect.provide(LayerNode.compile(LayerNode.group([AppProcess.node, EffectFlock.node])))),
)
