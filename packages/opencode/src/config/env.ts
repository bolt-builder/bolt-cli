export * as ConfigEnv from "./env"

import { Exit, Option, Schema } from "effect"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import { ConfigParse } from "./parse"

const PREFIX = "BOLT_"

// BOLT_* env vars owned by other subsystems; never treated as config overrides.
const RESERVED = new Set(["BOLT_SQL_URL"])

const decode = Schema.decodeUnknownExit(ConfigV1.Info)
const json = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)

/** Environment variable name for a top-level config key, e.g. `logLevel` -> `BOLT_LOG_LEVEL`. */
export function variable(key: string) {
  return PREFIX + key.replace(/([a-z0-9])([A-Z])/g, "$1_$2").toUpperCase()
}

/** Top-level config keys that can be overridden from the environment. */
export function keys() {
  const ast = ConfigV1.Info.ast
  if (ast._tag !== "Objects") return []
  return ast.propertySignatures.map((item) => String(item.name)).filter((key) => key !== "$schema")
}

/**
 * Collect config overrides from BOLT_* environment variables. Every top-level config key
 * maps to one variable via `variable()`. Values are decoded as JSON when the parsed value
 * fits the schema, otherwise kept as raw strings, so `BOLT_SNAPSHOT=false` yields a boolean
 * while `BOLT_MODEL=anthropic/claude-3-5-sonnet` stays a string. Unknown BOLT_* vars close
 * to a real override name produce a typo warning instead of being silently ignored.
 */
export function overrides(env: Record<string, string | undefined>) {
  const map = new Map(keys().map((key) => [variable(key), key] as const))
  const config: Record<string, unknown> = {}
  const warnings: string[] = []
  for (const name of Object.keys(env).sort()) {
    const text = env[name]
    if (!name.startsWith(PREFIX) || RESERVED.has(name) || text === undefined) continue
    const key = map.get(name)
    if (!key) {
      const near = suggestion(name, [...map.keys()])
      if (near) warnings.push(`Ignoring unknown environment variable ${name}, did you mean ${near}?`)
      continue
    }
    config[key] = coerce(key, text)
  }
  return { config: ConfigParse.schema(ConfigV1.Info, config, "BOLT environment"), warnings }
}

function coerce(key: string, text: string): unknown {
  const parsed = json(text)
  if (Option.isNone(parsed)) return text
  const candidate = parsed.value
  if (typeof candidate === "string") return candidate
  return Exit.isSuccess(decode({ [key]: candidate }, { errors: "all" })) ? candidate : text
}

function suggestion(name: string, known: string[]) {
  const scored = known
    .map((candidate) => ({ candidate, distance: levenshtein(name, candidate) }))
    .filter((item) => item.distance > 0 && item.distance <= Math.max(2, Math.floor(item.candidate.length / 4)))
    .sort((a, b) => a.distance - b.distance)
  return scored[0]?.candidate
}

function levenshtein(a: string, b: string) {
  if (!a.length) return b.length
  if (!b.length) return a.length
  const previous = Array.from({ length: b.length + 1 }, (_, i) => i)
  for (let i = 1; i <= a.length; i++) {
    let corner = previous[0]
    previous[0] = i
    for (let j = 1; j <= b.length; j++) {
      const upper = previous[j]
      previous[j] = Math.min(upper + 1, previous[j - 1] + 1, corner + (a[i - 1] === b[j - 1] ? 0 : 1))
      corner = upper
    }
  }
  return previous[b.length]
}
