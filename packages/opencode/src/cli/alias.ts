import path from "path"
import { existsSync, readFileSync } from "fs"
import { parse } from "jsonc-parser"
import { Global } from "@opencode-ai/core/global"
import { isRecord } from "@/util/record"

const NAMES = ["opencode.json", "opencode.jsonc", "bolt.json", "bolt.jsonc"]

/** Split an alias value into argv tokens, honoring single and double quotes. */
export function tokenize(value: string) {
  return [...value.matchAll(/'([^']*)'|"([^"]*)"|(\S+)/g)].map((match) => match[1] ?? match[2] ?? match[3])
}

/**
 * Expand a leading alias token once. Flags and the alias command itself are never expanded,
 * so `bolt alias` always manages aliases even when one shadows it.
 */
export function expand(args: string[], aliases: Record<string, string>) {
  const first = args[0]
  if (!first || first.startsWith("-") || first === "alias") return args
  const value = aliases[first]
  if (!value) return args
  return [...tokenize(value), ...args.slice(1)]
}

/**
 * Aliases visible from a directory: the global config plus project config files walking up
 * from the directory, nearest file winning. Reads config files directly because expansion
 * must happen before yargs parses argv, long before any service is available.
 */
export function load(directory: string): Record<string, string> {
  const files = [
    ...["config.json", ...NAMES].map((name) => path.join(Global.Path.config, name)),
    ...up(directory).flatMap((dir) => [
      ...NAMES.map((name) => path.join(dir, name)),
      ...NAMES.flatMap((name) => [path.join(dir, ".opencode", name), path.join(dir, ".bolt", name)]),
    ]),
  ]
  return files.reduce((result, file) => ({ ...result, ...aliases(file) }), {})
}

function up(directory: string): string[] {
  const parent = path.dirname(directory)
  if (parent === directory) return [directory]
  return [...up(parent), directory]
}

function aliases(file: string): Record<string, string> {
  if (!existsSync(file)) return {}
  const data = parse(readFileSync(file, "utf8"), [], { allowTrailingComma: true })
  if (!isRecord(data) || !isRecord(data.alias)) return {}
  return Object.fromEntries(
    Object.entries(data.alias).filter((entry): entry is [string, string] => typeof entry[1] === "string"),
  )
}

export * as CliAlias from "./alias"
