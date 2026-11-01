import { Effect, Layer, Schema } from "effect"
import { HttpRouter, HttpServerRequest, HttpServerResponse } from "effect/unstable/http"
import { InstanceStore } from "@/project/instance-store"
import { InstanceRef } from "@/effect/instance-ref"
import { SessionBundle } from "@/session/bundle"
import { ServerAuth } from "@/server/auth"
import { authorizationRouterMiddleware } from "./middleware/authorization"

// Session handoff (`bolt push` / `bolt pull`): move a session bundle in the
// existing export/import format through a running bolt server.
//
// Raw routes outside the typed API surface on purpose: the payload is the
// export format owned by SessionBundle, not an SDK contract. Auth is the
// same router middleware the /doc and UI fallback routes use. The instance
// is resolved from the x-opencode-directory header like the typed instance
// routes, defaulting to the server's working directory.

const HEADER = "x-opencode-directory"
// Bundles carry whole transcripts; cap the payload well above typical
// session sizes but below anything that could exhaust memory.
const LIMIT = 50 * 1024 * 1024

const json = Schema.decodeUnknownOption(Schema.UnknownFromJsonString)

function decode(input: string) {
  try {
    return decodeURIComponent(input)
  } catch {
    return input
  }
}

function directory(request: HttpServerRequest.HttpServerRequest) {
  const header = request.headers[HEADER]
  if (typeof header === "string" && header) return decode(header)
  return process.cwd()
}

function failure(status: number, error: string) {
  return HttpServerResponse.jsonUnsafe({ error }, { status })
}

export const handoffRoute = HttpRouter.use((router) =>
  Effect.gen(function* () {
    const store = yield* InstanceStore.Service

    yield* router.add("GET", "/handoff/session", (request) =>
      Effect.gen(function* () {
        const sessionID = new URL(request.url, "http://localhost").searchParams.get("sessionID")
        if (!sessionID) return failure(400, "sessionID query parameter is required")
        const ctx = yield* store.load({ directory: directory(request) })
        const data = yield* SessionBundle.dump(sessionID).pipe(
          Effect.provideService(InstanceRef, ctx),
          Effect.catchCause(() => Effect.succeed(undefined)),
        )
        if (!data) return failure(404, `Session not found: ${sessionID}`)
        return HttpServerResponse.jsonUnsafe(data)
      }),
    )

    yield* router.add("POST", "/handoff/session", (request) =>
      Effect.gen(function* () {
        const length = Number(request.headers["content-length"] ?? 0)
        if (length > LIMIT) return failure(413, "Session bundle exceeds the 50 MB limit")
        const body = yield* Effect.orDie(request.text)
        if (body.length > LIMIT) return failure(413, "Session bundle exceeds the 50 MB limit")
        const parsed = json(body)
        if (parsed._tag === "None") return failure(400, "Request body is not valid JSON")
        if (!SessionBundle.valid(parsed.value))
          return failure(400, "Request body is not a session bundle in the export format")
        const ctx = yield* store.load({ directory: directory(request) })
        const id = yield* SessionBundle.load(parsed.value, ctx).pipe(
          Effect.provideService(InstanceRef, ctx),
          Effect.catchCause(() => Effect.succeed(undefined)),
        )
        if (!id) return failure(400, "Session bundle could not be decoded")
        return HttpServerResponse.jsonUnsafe({ id })
      }),
    )
  }),
).pipe(Layer.provide(authorizationRouterMiddleware.layer.pipe(Layer.provide(ServerAuth.Config.layer))))
