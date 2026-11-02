export * as CliAlias from "./alias"

import path from "node:path"
import fs from "node:fs"
import { parse } from "jsonc-parser"
import { Schema } from "effect"
import { Global } from "@opencode/util/global"

const Aliases = Schema.Struct({ alias: Schema.Record(Schema.String, Schema.String) })
const decode = Schema.decodeUnknownOption(Aliases)
const names = ["opencode.json", "opencode.jsonc", "bolt.json", "bolt.jsonc"]

/** Preserve V1 quoting and expand once; alias values are argv, never shell code. */
export function tokenize(value: string) {
  return [...value.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3])
}

export function commandIndex(args: readonly string[]) {
  for (let i = 0; i < args.length; i++) {
    const arg = args[i]
    if (arg === "--server") {
      i++
      continue
    }
    if (arg.startsWith("--server=")) continue
    if (["--standalone", "--print-logs", "--auto", "--yolo", "--dangerously-skip-permissions"].includes(arg)) continue
    if (arg.startsWith("-")) return -1
    return i
  }
  return -1
}

export function expand(args: string[], aliases: Record<string, string>) {
  const index = commandIndex(args)
  const first = args[index]
  if (index < 0 || !first || first === "alias" || !Object.hasOwn(aliases, first) || !aliases[first]) return args
  return [...args.slice(0, index), ...tokenize(aliases[first]), ...args.slice(index + 1)]
}

/** Root-to-leaf project precedence follows V1; current V2 CLI configuration owns global writes. */
export function load(directory: string, config: string, global: Record<string, string> = {}, projectOnly = false) {
  const up = (dir: string): string[] => (path.dirname(dir) === dir ? [dir] : [...up(path.dirname(dir)), dir])
  const legacy = Global.boltDirectory(config)
  const globalFiles = [...(legacy ? [legacy] : []), config].flatMap((dir) =>
    ["config.json", ...names].map((name) => path.join(dir, name)),
  )
  const projectFiles = up(path.resolve(directory)).flatMap((dir) => [
    ...names.map((name) => path.join(dir, name)),
    ...[".opencode", ".bolt"].flatMap((dot) => names.map((name) => path.join(dir, dot, name))),
  ])
  const read = (file: string): Record<string, string> => {
    if (!fs.existsSync(file)) return {}
    const data: unknown = parse(fs.readFileSync(file, "utf8"), [], { allowTrailingComma: true })
    // V1 ignored non-string entries without discarding other aliases in the same file.
    if (
      !data ||
      typeof data !== "object" ||
      !("alias" in data) ||
      !data.alias ||
      typeof data.alias !== "object" ||
      Array.isArray(data.alias)
    )
      return {}
    const aliases = decode({
      alias: Object.fromEntries(Object.entries(data.alias).filter((entry) => typeof entry[1] === "string")),
    })
    return aliases._tag === "Some" ? aliases.value.alias : {}
  }
  return [...(projectOnly ? [] : [...globalFiles.map(read), global]), ...projectFiles.map(read)].reduce(
    (result, aliases) => ({ ...result, ...aliases }),
    {},
  )
}
