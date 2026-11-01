export * as HttpTool from "./http.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { Duration, Effect, Option, Schema } from "effect"
import { FetchHttpClient, HttpClient, HttpClientRequest } from "effect/http"
import path from "node:path"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { Location } from "../../location.js"
import { NetGuard } from "../../net-guard.js"
import { Permission } from "../../permission.js"
import { collectBoundedResponseBody } from "../http-body.js"
import DESCRIPTION from "./http.txt"

export const MAX_RESPONSE_SIZE = 5 * 1024 * 1024
const MAX_ECHO = 20_000
const PROFILES = ".bolt/http-profiles.json"

export const Input = Schema.Struct({
  method: Schema.Literals(["GET", "POST", "PUT", "PATCH", "DELETE", "HEAD", "OPTIONS"]).pipe(
    Schema.withDecodingDefaultKey(Effect.succeed("GET" as const)),
  ),
  url: Schema.String,
  headers: Schema.optionalKey(Schema.Record(Schema.String, Schema.String)),
  body: Schema.optionalKey(Schema.String),
  profile: Schema.optionalKey(Schema.String),
  timeout: Schema.optionalKey(Schema.Finite.check(Schema.isGreaterThan(0), Schema.isLessThanOrEqualTo(120))),
})
const Output = Schema.Struct({
  status: Schema.Number,
  bytes: Schema.Number,
  json: Schema.Boolean,
  profile: Schema.optionalKey(Schema.String),
  truncated: Schema.Boolean,
  output: Schema.String,
})

/** Fill ${VAR} placeholders from the environment, reporting missing variables and the injected values. */
export function interpolate(
  template: string,
  env: Record<string, string | undefined>,
): { value: string; missing: string[]; used: string[] } {
  const missing: string[] = []
  const used: string[] = []
  const value = template.replace(/\$\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (_, name: string) => {
    const found = env[name]
    if (found === undefined) {
      missing.push(name)
      return ""
    }
    used.push(found)
    return found
  })
  return { value, missing, used }
}

/**
 * Resolve a named profile from the parsed profile file into concrete headers.
 * Returns the env values that were injected so callers can redact them from
 * anything echoed back.
 */
export function resolve(
  raw: unknown,
  name: string,
  env: Record<string, string | undefined>,
): { ok: true; headers: Record<string, string>; secrets: string[] } | { ok: false; reason: string } {
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    return { ok: false, reason: `${PROFILES} must contain a JSON object of profiles` }
  }
  const profile = Object.hasOwn(raw, name) ? (raw as Record<string, unknown>)[name] : undefined
  if (profile === undefined) {
    const available = Object.keys(raw).join(", ")
    return { ok: false, reason: `unknown profile "${name}" (available: ${available || "none"})` }
  }
  if (typeof profile !== "object" || profile === null || Array.isArray(profile)) {
    return { ok: false, reason: `profile "${name}" must be an object` }
  }
  const templates = (profile as Record<string, unknown>)["headers"] ?? {}
  if (typeof templates !== "object" || templates === null || Array.isArray(templates)) {
    return { ok: false, reason: `profile "${name}" headers must be an object` }
  }
  const headers: Record<string, string> = {}
  const secrets: string[] = []
  const missing: string[] = []
  for (const [key, template] of Object.entries(templates)) {
    if (typeof template !== "string") return { ok: false, reason: `profile "${name}" header "${key}" must be a string` }
    const filled = interpolate(template, env)
    missing.push(...filled.missing)
    secrets.push(...filled.used)
    headers[key] = filled.value
  }
  if (missing.length) {
    return {
      ok: false,
      reason: `profile "${name}" needs environment variables that are not set: ${missing.join(", ")}`,
    }
  }
  return { ok: true, headers, secrets }
}

/** Scrub secret values out of text that will be echoed back to the model. */
export function redact(text: string, secrets: string[]): string {
  return secrets
    .filter((secret) => secret.length > 0)
    .reduce((acc, secret) => acc.replaceAll(secret, "[redacted]"), text)
}

/** One-line type description of a JSON value. */
function kind(value: unknown): string {
  if (value === null) return "null"
  if (Array.isArray(value)) {
    if (value.length === 0) return "array(0)"
    return `array(${value.length}) of ${kind(value[0])}`
  }
  return typeof value
}

/** Shape summary of a parsed JSON body: top-level keys and types. */
export function summarize(value: unknown): string {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return kind(value)
  const entries = Object.entries(value)
  if (entries.length === 0) return "object (empty)"
  return entries.map((entry) => `${entry[0]}: ${kind(entry[1])}`).join("\n")
}

export const Plugin = {
  id: "bolt.tool.http",
  effect: Effect.fn("HttpTool.Plugin")(function* (ctx: Context) {
    const http = yield* HttpClient.HttpClient
    const permission = yield* Permission.Service
    const access = yield* FileAccess.Service
    const environment = yield* Environment.Service
    const location = yield* Location.Service
    yield* ctx.tool
      .transform((editor) =>
        editor.add({
          name: "http",
          options: { codemode: false },
          description: DESCRIPTION,
          input: Input,
          output: Output,
          execute: (input, context) =>
            Effect.gen(function* () {
              const profile = yield* Effect.gen(function* () {
                if (!input.profile) return { headers: {}, secrets: [] as string[] }
                const target = yield* access.authorizeRead(path.join(location.directory, PROFILES), context)
                const file = yield* environment.files.read(target.absolute, { offset: 0, length: 1_000_001 })
                if (file.info.size > 1_000_000) return yield* Effect.fail(new Error(`${PROFILES} exceeds 1 MB`))
                const raw = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(
                  new TextDecoder().decode(file.bytes),
                )
                if (Option.isNone(raw)) return yield* Effect.fail(new Error(`${PROFILES} is not valid JSON`))
                const result = resolve(raw.value, input.profile, process.env)
                if (!result.ok) return yield* Effect.fail(new Error(result.reason))
                return result
              })
              // Headers normalizes casing so explicit headers replace profile values consistently.
              const headers = yield* Effect.try(() => {
                const value = new Headers(profile.headers)
                for (const [name, entry] of Object.entries(input.headers ?? {})) value.set(name, entry)
                return value
              })
              const injected = new Set(Object.keys(profile.headers).map((name) => name.toLowerCase()))
              const sensitive = (name: string) =>
                /^(authorization|proxy-authorization|cookie|set-cookie|x-api-key)$/i.test(name) ||
                injected.has(name.toLowerCase())
              const secrets = [
                ...profile.secrets,
                ...[...headers].flatMap(([name, value]) => (sensitive(name) ? [value] : [])),
              ]
              const check = (url: string, method: string) =>
                Effect.gen(function* () {
                  yield* Effect.try(() => {
                    const target = new URL(url)
                    if (!["http:", "https:"].includes(target.protocol))
                      throw new Error("URL must start with http:// or https://")
                    if (target.username || target.password)
                      throw new Error("Use request headers instead of credentials in the URL")
                  })
                  yield* permission.assert({
                    action: "http",
                    resources: [`${method} ${url}`],
                    save: ["*"],
                    metadata: { method, url, profile: input.profile },
                    sessionID: context.sessionID,
                    agent: context.agent,
                    source: { type: "tool", messageID: context.messageID, id: context.id },
                  })
                  yield* NetGuard.assertFetchable(new URL(url))
                })
              const result = yield* Effect.gen(function* () {
                let url = input.url
                let method: string = input.method
                let body = input.body
                const outgoing = new Headers(headers)
                for (let redirects = 0; ; redirects++) {
                  yield* check(url, method)
                  const request = HttpClientRequest.make(method as typeof input.method)(url).pipe(
                    body === undefined ? (self) => self : (self) => HttpClientRequest.bodyText(self, body!),
                    HttpClientRequest.setHeaders(Object.fromEntries(outgoing)),
                  )
                  const response = yield* http.execute(request).pipe(
                    Effect.provideService(FetchHttpClient.RequestInit, { redirect: "manual" }),
                    Effect.provideService(
                      FetchHttpClient.Fetch,
                      Object.assign(
                        (request: string | URL | Request, init?: RequestInit) =>
                          NetGuard.fetch(request instanceof Request ? request.url : request, init),
                        { preconnect: globalThis.fetch.preconnect },
                      ),
                    ),
                  )
                  if ([301, 302, 303, 307, 308].includes(response.status) && response.headers.location) {
                    if (redirects >= 10) return yield* Effect.fail(new Error("Too many redirects (more than 10)"))
                    const next = yield* Effect.try(() => new URL(response.headers.location!, url))
                    // Profile and authentication headers must not escape to another origin.
                    if (next.origin !== new URL(url).origin) {
                      for (const name of [...outgoing.keys()]) if (sensitive(name)) outgoing.delete(name)
                    }
                    if (
                      (response.status === 303 && method !== "HEAD") ||
                      ([301, 302].includes(response.status) && method === "POST")
                    ) {
                      method = "GET"
                      body = undefined
                      outgoing.delete("content-type")
                      outgoing.delete("content-length")
                    }
                    url = next.href
                    continue
                  }
                  const bytes = yield* collectBoundedResponseBody(
                    response,
                    MAX_RESPONSE_SIZE,
                    () => new Error("Response too large (exceeds 5MB limit)"),
                  )
                  const text = new TextDecoder().decode(bytes)
                  const parsed = Schema.decodeUnknownOption(Schema.fromJsonString(Schema.Unknown))(text)
                  const echo = [...headers].map(([name, value]) => `${name}: ${sensitive(name) ? "[redacted]" : value}`)
                  const lines = [
                    `status: ${response.status}`,
                    "",
                    "request headers:",
                    ...(echo.length ? echo : ["(none)"]),
                    "",
                    "response headers:",
                    ...Object.entries(response.headers).map(
                      ([name, value]) => `${name}: ${sensitive(name) ? "[redacted]" : value}`,
                    ),
                  ]
                  if (Option.isSome(parsed)) lines.push("", "body shape:", summarize(parsed.value))
                  lines.push("", "body:", text.slice(0, MAX_ECHO) || "(empty)")
                  if (text.length > MAX_ECHO)
                    lines.push(`(body truncated: showing first ${MAX_ECHO} of ${text.length} characters)`)
                  return {
                    status: response.status,
                    bytes: bytes.length,
                    json: Option.isSome(parsed),
                    ...(input.profile === undefined ? {} : { profile: input.profile }),
                    truncated: text.length > MAX_ECHO,
                    output: redact(lines.join("\n"), secrets),
                  }
                }
              }).pipe(
                Effect.timeoutOrElse({
                  duration: Duration.seconds(input.timeout ?? 30),
                  orElse: () => Effect.fail(new Error("Request timed out")),
                }),
              )
              return {
                output: result,
                content: result.output,
                metadata: { status: result.status, bytes: result.bytes, json: result.json, profile: result.profile },
              }
            }).pipe(Effect.mapError((error) => new ToolFailure({ message: "HTTP request failed", error }))),
        }),
      )
      .pipe(Effect.orDie)
  }),
}
