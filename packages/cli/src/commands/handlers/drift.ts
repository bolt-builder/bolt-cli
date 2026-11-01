import { Effect, Option } from "effect"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { errorMessage } from "../../util/error"

const println = (text = "") => process.stdout.write(text + "\n")

const SYMBOL_LIMIT = 50
const MENTION_LIMIT = 10

// Declaration shapes whose deletion suggests a symbol was removed or renamed.
const declarations = [
  /^export (?:async )?function\*? (\w+)/,
  /^export (?:const|let|var) (\w+)/,
  /^export (?:abstract )?class (\w+)/,
  /^export (?:type|interface|enum) (\w+)/,
  /^(?:async )?function\*? (\w+)/,
  /^class (\w+)/,
  /^def (\w+)\(/,
]

/** Extract symbols whose declarations were deleted by a unified diff. */
export function removed(diff: string) {
  const result: { file: string; name: string }[] = []
  let file = ""
  for (const line of diff.split("\n")) {
    const header = line.match(/^--- a\/(.+)$/)
    if (header) {
      file = header[1]
      continue
    }
    if (!line.startsWith("-") || line.startsWith("---")) continue
    const text = line.slice(1).trim()
    for (const declaration of declarations) {
      const match = text.match(declaration)
      if (!match) continue
      if (result.some((entry) => entry.name === match[1])) continue
      result.push({ file, name: match[1] })
    }
  }
  return result
}

/** True for documentation files where mentions of removed code go stale. */
export function docfile(file: string) {
  return /\.(?:md|mdx|markdown|rst|adoc)$/i.test(file)
}

/** True when a source line is a comment. */
export function comment(text: string) {
  const trimmed = text.trimStart()
  return (
    trimmed.startsWith("//") ||
    trimmed.startsWith("*") ||
    trimmed.startsWith("/*") ||
    trimmed.startsWith("#") ||
    trimmed.startsWith("<!--")
  )
}

export type Ref = {
  path: string
  line: number
  text: string
}

/** Split references to a symbol into live code usage and doc/comment mentions. */
export function classify(refs: Ref[]) {
  const alive = refs.some((ref) => !docfile(ref.path) && !comment(ref.text))
  const mentions = refs.filter((ref) => docfile(ref.path) || comment(ref.text))
  return { alive, mentions }
}

export default Runtime.handler(Commands.commands.drift, (args) =>
  Effect.gen(function* () {
    if (Option.isSome(args.branchTarget) && (Option.isNone(args.branch) || args.branch.value))
      return yield* Effect.fail(new Error(`Unexpected argument: ${args.branchTarget.value}`))
    const branch = Option.isSome(args.branchTarget) ? args.branchTarget : args.branch
    if (args.staged && Option.isSome(branch))
      return yield* Effect.fail(new Error("--staged and --branch cannot be used together"))
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"])
    if (root.exitCode !== 0)
      return yield* Effect.fail(
        new Error("Could not find git repository. Please run this command from a git repository."),
      )
    const cwd = root.stdout.toString().trim()
    const range = yield* Effect.gen(function* () {
      if (args.staged) return ["diff", "--cached"]
      if (Option.isNone(branch)) return ["diff", "HEAD"]
      const base = branch.value || (yield* git.defaultBranch(cwd))
      if (!base)
        return yield* Effect.fail(new Error("Could not determine the default branch. Pass one with --branch <name>."))
      const merge = yield* git.run(["merge-base", base, "HEAD"], cwd)
      if (merge.exitCode !== 0) return yield* Effect.fail(new Error(`Could not find a merge base with ${base}.`))
      return ["diff", `${merge.stdout.toString().trim()}..HEAD`]
    })
    const diff = yield* git.run(range, cwd).pipe(Effect.flatMap(AppProcess.requireSuccess))
    const symbols = removed(diff.stdout.toString()).slice(0, SYMBOL_LIMIT)
    if (symbols.length === 0) {
      println("The diff removed no declarations. Nothing to check.")
      return
    }
    println(`Checking ${symbols.length} removed declaration${symbols.length === 1 ? "" : "s"} against docs...`)
    const findings: { file: string; name: string; mentions: Ref[] }[] = []
    const uncertain: { file: string; name: string; mentions: Ref[]; code: Ref[] }[] = []
    let hasLiveMentions = false
    for (const symbol of symbols) {
      // Git already owns this command's repository. Its grep honors ignore rules for untracked files
      // and avoids importing the server's Ripgrep service into the frontend.
      const matches = yield* git.run(
        ["grep", "-n", "-z", "-I", "-w", "--untracked", "--exclude-standard", "-e", symbol.name, "--", "."],
        cwd,
      )
      if (matches.exitCode !== 0 && matches.exitCode !== 1)
        return yield* Effect.fail(new Error(matches.stderr.toString().trim() || "git grep failed"))
      const refs = [...matches.stdout.toString().matchAll(/([^\0]+)\0(\d+)\0([^\n]*)(?:\n|$)/g)]
        .slice(0, 200)
        .map((match) => ({ path: match[1], line: Number(match[2]), text: match[3] }))
      const outcome = classify(refs)
      if (outcome.mentions.length === 0) continue
      if (outcome.alive) {
        hasLiveMentions = true
        // A text match in another file may be an unrelated homonym or a moved symbol.
        // Preserve V1's success status, but surface both locations for manual review.
        const code = refs.filter((ref) => !docfile(ref.path) && !comment(ref.text) && ref.path !== symbol.file)
        if (code.length) uncertain.push({ ...symbol, mentions: outcome.mentions, code })
        continue
      }
      findings.push({ file: symbol.file, name: symbol.name, mentions: outcome.mentions })
    }
    println()
    if (uncertain.length) {
      println(
        "Some names also occur in other code; verify whether these docs refer to the removed or surviving symbol:",
      )
      for (const item of uncertain) {
        println(`  ${item.name} (former declaration: ${item.file}):`)
        for (const ref of item.code.slice(0, MENTION_LIMIT))
          println(`    code ${ref.path}:${ref.line} ${ref.text.trim().slice(0, 120)}`)
        for (const ref of item.mentions.slice(0, MENTION_LIMIT))
          println(`    docs ${ref.path}:${ref.line} ${ref.text.trim().slice(0, 120)}`)
      }
      println()
    }
    if (findings.length === 0) {
      println(
        hasLiveMentions
          ? "No confirmed stale docs found."
          : "No stale docs found. Every removed symbol is gone from docs and comments too.",
      )
      return
    }
    println(
      `Found ${findings.length} removed symbol${findings.length === 1 ? "" : "s"} still mentioned in docs or comments:`,
    )
    for (const finding of findings) {
      println(`  ${finding.name} (removed from ${finding.file}):`)
      for (const mention of finding.mentions.slice(0, MENTION_LIMIT))
        println(`    ${mention.path}:${mention.line} ${mention.text.trim().slice(0, 120)}`)
      if (finding.mentions.length > MENTION_LIMIT) println(`    ...and ${finding.mentions.length - MENTION_LIMIT} more`)
    }
    println()
    println("Update or delete these references before handing off the diff.")
    process.exitCode = 1
  }).pipe(
    Effect.provide(LayerNode.compile(AppProcess.node)),
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
