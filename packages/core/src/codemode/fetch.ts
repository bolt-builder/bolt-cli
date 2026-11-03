export * as CodeModeFetch from "./fetch.js"

import { Extension } from "@opencode/codemode"
import { isRecord } from "@opencode/util/record"
import { Effect } from "effect"
import { Permission } from "../permission.js"
import { NetGuard } from "../net-guard.js"
import { CodeModeExecution } from "./execution.js"

const TIMEOUT_MS = 30_000

type Init = {
  readonly method?: string
  readonly headers?: Record<string, string> | Array<[string, string]>
  readonly body?: string | Uint8Array<ArrayBuffer> | URLSearchParams
}

const fetch = (input: string | URL, init: Init = {}) =>
  Effect.gen(function* () {
    // Rules are matched against the URL that is requested, so `HTTPS://EVIL.COM` meets a rule for `https://evil.com/*`.
    const parsed = URL.parse(String(input))
    if (parsed === null) return yield* Effect.fail(new TypeError(`fetch received an invalid URL: ${String(input)}`))
    if (parsed.protocol === "file:") return yield* Effect.fail(new Error("fetch cannot be used for filesystem access."))
    const url = parsed.href
    const execution = yield* CodeModeExecution.Service
    const permission = yield* Permission.Service
    const source = { type: "tool" as const, messageID: execution.messageID, id: execution.id }
    // The same rules as the webfetch tool, so a URL denied there is denied here.
    yield* permission
      .assert({
        action: "webfetch",
        resources: [url],
        save: ["*"],
        metadata: display([url, init]),
        sessionID: execution.sessionID,
        agent: execution.agent,
        source,
      })
      .pipe(
        // The feedback is the user talking to the model, so it must reach the program as the error's message.
        Effect.catchTag("Permission.CorrectedError", (error) =>
          Effect.fail(new Error(`The user rejected fetching ${url}: ${error.feedback}`)),
        ),
      )
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), TIMEOUT_MS)
    return yield* Effect.gen(function* () {
      let current = url
      let request: Init = init
      let redirected = false
      for (let count = 0; ; count++) {
        const response = yield* Effect.tryPromise({
          try: (signal) =>
            NetGuard.fetch(current, { ...request, signal: AbortSignal.any([controller.signal, signal]) }),
          catch: (error) => error,
        })
        const destination = response.headers.get("location")
        if (![301, 302, 303, 307, 308].includes(response.status) || !destination)
          return yield* Effect.tryPromise({ try: () => read(response, current, redirected), catch: (error) => error })
        if (count >= 10) return yield* Effect.fail(new Error("Too many redirects"))
        const next = yield* Effect.try({ try: () => new URL(destination, current).href, catch: (error) => error })
        yield* permission.assertNotDenied({
          action: "webfetch",
          resources: [next],
          metadata: { ...display([input, init]), url: next },
          sessionID: execution.sessionID,
          agent: execution.agent,
          source: { type: "tool", messageID: execution.messageID, id: execution.id },
        })
        yield* NetGuard.assertFetchable(new URL(next))
        yield* Effect.promise(() => response.body?.cancel() ?? Promise.resolve())
        const method = (request.method ?? "GET").toUpperCase()
        const headers = new Headers(request.headers)
        if (new URL(current).origin !== new URL(next).origin) {
          headers.delete("authorization")
          headers.delete("cookie")
          headers.delete("proxy-authorization")
        }
        const dropBody =
          (response.status === 303 && method !== "HEAD") || ([301, 302].includes(response.status) && method === "POST")
        if (dropBody) {
          headers.delete("content-length")
          headers.delete("content-type")
        }
        request = {
          ...request,
          method: dropBody ? "GET" : request.method,
          body: dropBody ? undefined : request.body,
          headers: [...headers.entries()],
        }
        current = next
        redirected = true
      }
    }).pipe(Effect.ensuring(Effect.sync(() => clearTimeout(timeout))))
  })

const read = async (response: Response, url: string, redirected: boolean) => {
  const bytes = await response.bytes()
  const headers = Object.fromEntries(response.headers)
  const text = () => new TextDecoder().decode(bytes)
  return {
    url,
    status: response.status,
    statusText: response.statusText,
    ok: response.ok,
    redirected,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] ?? null,
      has: (name: string) => name.toLowerCase() in headers,
      entries: () => Object.entries(headers),
    },
    text: async () => text(),
    json: async () => JSON.parse(text()) as unknown,
    bytes: async () => bytes,
  }
}

export const extension = Extension.make({ name: "fetch", globals: { fetch: Extension.async(fetch) } })

/** What to show for a fetch call: its method and URL. */
export const display = (args: ReadonlyArray<unknown>) => {
  const [input, init] = args
  const method = isRecord(init) && typeof init.method === "string" ? init.method.toUpperCase() : "GET"
  return { method, url: String(input) }
}
