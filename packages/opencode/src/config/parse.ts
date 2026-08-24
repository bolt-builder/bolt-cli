export * as ConfigParse from "./parse"

import { type ParseError as JsoncParseError, parse as parseJsoncImpl, printParseErrorCode } from "jsonc-parser"
import { Cause, Exit, Schema as EffectSchema, SchemaIssue } from "effect"
import type { DeepMutable } from "@opencode-ai/core/schema"
import { InvalidError, JsonError } from "@opencode-ai/core/v1/config/error"

export function jsonc(text: string, filepath: string): unknown {
  const errors: JsoncParseError[] = []
  const data = parseJsoncImpl(text, errors, { allowTrailingComma: true })
  if (errors.length) {
    const lines = text.split("\n")
    const issues = errors
      .map((e) => {
        const beforeOffset = text.substring(0, e.offset).split("\n")
        const line = beforeOffset.length
        const column = beforeOffset[beforeOffset.length - 1].length + 1
        const problemLine = lines[line - 1]

        const error = `${printParseErrorCode(e.error)} at line ${line}, column ${column}`
        if (!problemLine) return error

        return `${error}\n   Line ${line}: ${problemLine}\n${"".padStart(column + 9)}^`
      })
      .join("\n")
    throw new JsonError({
      path: filepath,
      message: `\n--- JSONC Input ---\n${text}\n--- Errors ---\n${issues}\n--- End ---`,
    })
  }

  return data
}

export function schema<S extends EffectSchema.Decoder<unknown, never>>(
  schema: S,
  data: unknown,
  source: string,
): DeepMutable<S["Type"]> {
  const extra = extraKeys(schema.ast, data, [])
  if (extra.length) {
    throw new InvalidError({
      path: source,
      issues: extra.map((item) => ({
        code: "unrecognized_keys",
        keys: [item.key],
        path: item.path,
        message:
          `Unrecognized key${item.path.length ? ` in "${item.path.join(".")}"` : ""}: ${item.key}` +
          (item.suggestion ? ` (did you mean "${item.suggestion}"?)` : ""),
      })),
    })
  }

  const decoded = EffectSchema.decodeUnknownExit(schema)(data, { errors: "all", propertyOrder: "original" })
  if (Exit.isSuccess(decoded)) return decoded.value as DeepMutable<S["Type"]>
  const error = Cause.squash(decoded.cause)

  throw new InvalidError(
    {
      path: source,
      issues: EffectSchema.isSchemaError(error)
        ? SchemaIssue.makeFormatterStandardSchemaV1()(error.issue).issues.map((issue) => ({
            ...issue,
            message: issue.message,
            path: issue.path?.map(String) ?? [],
          }))
        : [{ message: String(error), path: [] }],
    },
    { cause: error },
  )
}

type Extra = { path: string[]; key: string; suggestion?: string }

// Walks the schema AST alongside the data and reports keys the schema does not know about.
// Only closed structs (no index signatures) are checked; records and struct-with-rest shapes
// like `agent` or `permission` accept arbitrary keys by design and are skipped.
function extraKeys(ast: EffectSchema.Top["ast"], data: unknown, path: string[]): Extra[] {
  if (typeof data !== "object" || data === null || Array.isArray(data)) return []
  if (ast._tag !== "Objects" || ast.indexSignatures.length > 0) return []
  const known = ast.propertySignatures.map((item) => String(item.name))
  const set = new Set(known)
  const record = data as Record<string, unknown>
  const found = Object.keys(record)
    .filter((key) => !set.has(key))
    .map((key): Extra => ({ path, key, suggestion: suggest(key, known) }))
  return [
    ...found,
    ...ast.propertySignatures.flatMap((item) => {
      const key = String(item.name)
      const child = objects(item.type)
      if (!child) return []
      return extraKeys(child, record[key], [...path, key])
    }),
  ]
}

// Unwraps optional fields (Union of the real type and Undefined) and unions like
// `boolean | struct` down to a single closed struct AST worth descending into.
function objects(ast: EffectSchema.Top["ast"]): EffectSchema.Top["ast"] | undefined {
  if (ast._tag === "Objects") return ast
  if (ast._tag !== "Union") return undefined
  const members = ast.types.filter((item) => item._tag === "Objects")
  if (members.length !== 1) return undefined
  return members[0]
}

function suggest(key: string, known: string[]) {
  const scored = known
    .map((candidate) => ({ candidate, distance: levenshtein(key.toLowerCase(), candidate.toLowerCase()) }))
    .filter((item) => item.distance > 0 && item.distance <= Math.max(2, Math.floor(item.candidate.length / 3)))
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
