export * as CliAlias from "./alias"

import path from "node:path"
import fs from "node:fs"
import { parse } from "jsonc-parser"
import { Schema } from "effect"

const Aliases = Schema.Struct({ alias: Schema.Record(Schema.String, Schema.String) })
const decode = Schema.decodeUnknownOption(Aliases)
const names = ["opencode.json", "opencode.jsonc", "bolt.json", "bolt.jsonc"]

/** Preserve V1 quoting and expand once; alias values are argv, never shell code. */
export function tokenize(value: string) {
  return [...value.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3])
}

export function expand(args: string[], aliases: Record<string, string>) {
  const first = args[0]
  if (!first || first.startsWith("-") || first === "alias" || !Object.hasOwn(aliases, first) || !aliases[first])
    return args
  return [...tokenize(aliases[first]), ...args.slice(1)]
}

/** Root-to-leaf project precedence follows V1; current V2 CLI configuration owns global writes. */
export function load(directory: string, config: string, global: Record<string, string> = {}) {
  const up = (dir: string): string[] => (path.dirname(dir) === dir ? [dir] : [...up(path.dirname(dir)), dir])
  const globalFiles = ["config.json", ...names].map((name) => path.join(config, name))
  const projectFiles = up(path.resolve(directory)).flatMap((dir) => [
    ...names.map((name) => path.join(dir, name)),
    ...[".opencode", ".bolt"].flatMap((dot) => names.map((name) => path.join(dir, dot, name))),
  ])
  const read = (file: string): Record<string, string> => {
    if (!fs.existsSync(file)) return {}
    const data: unknown = parse(fs.readFileSync(file, "utf8"), [], { allowTrailingComma: true })
    // V1 ignored non-string entries without discarding other aliases in the same file.
    if (!data || typeof data !== "object" || !("alias" in data) || !data.alias || typeof data.alias !== "object")
      return {}
    const aliases = decode({
      alias: Object.fromEntries(Object.entries(data.alias).filter((entry) => typeof entry[1] === "string")),
    })
    return aliases._tag === "Some" ? aliases.value.alias : {}
  }
  return [...globalFiles.map(read), global, ...projectFiles.map(read)].reduce(
    (result, aliases) => ({ ...result, ...aliases }),
    {},
  )
}
