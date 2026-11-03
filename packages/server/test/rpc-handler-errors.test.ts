import { expect } from "bun:test"
import { SdkPlugins } from "@opencode/core/plugin/sdk"
import { define } from "@opencode/plugin/effect/plugin"
import { Rpc } from "@opencode/schema/rpc"
import { Session } from "@opencode/schema/session"
import { Context, Effect, Layer, Schema } from "effect"
import { HttpEffect, HttpRouter, HttpServer } from "effect/http"
import { tmpdirScoped } from "../../core/test/fixture/tmpdir"
import { it } from "../../core/test/lib/effect"
import { createEmbeddedRoutes } from "../src/routes"

it.live("registers Bolt sandbox and process RPCs in a fresh server", () =>
  Effect.gen(function* () {
    const directory = yield* tmpdirScoped()
    const context = yield* Layer.build(
      createEmbeddedRoutes({
        database: { path: ":memory:" },
        models: { fetch: false },
        config: { directory: directory.path, project: false, content: "{}" },
        fs: { filewatcher: false },
      }).pipe(Layer.provide(HttpServer.layerServices)),
    )
    const handler = Context.get(context, HttpRouter.HttpRouter)
      .asHttpEffect()
      .pipe(HttpEffect.toWebHandlerWith(context))
    const request = (route: string, body: unknown) =>
      Effect.promise(() =>
        handler(
          new Request(`http://opencode.local${route}`, {
            method: "POST",
            headers: { "content-type": "application/json", "x-opencode-directory": encodeURIComponent(directory.path) },
            body: JSON.stringify(body),
          }),
        ),
      )
    const created = yield* request("/api/session", { location: { directory: directory.path } })
    expect(created.status).toBe(200)
    const session = Schema.decodeUnknownSync(Schema.Struct({ data: Session.Info }))(
      yield* Effect.promise(() => created.json()),
    ).data
    const enabled = (process.platform === "darwin" && !!Bun.which("sandbox-exec")) ||
      (process.platform === "linux" && !!Bun.which("bwrap"))
    const sandbox = yield* request("/api/rpc/bolt.sandbox/set", { input: { sessionID: session.id, enabled } })
    expect(sandbox.status).toBe(200)
    expect(yield* Effect.promise(() => sandbox.json())).toEqual({ output: { enabled } })
    const processList = yield* request("/api/rpc/bolt.process/list", { input: {} })
    expect(processList.status).toBe(200)
    expect(yield* Effect.promise(() => processList.json())).toEqual({ output: [] })
  }),
)

const Broken = Rpc.define({
  id: "broken",
  methods: {
    handler: { input: Schema.String, output: Schema.String },
    schema: {
      input: Schema.String.check(
        Schema.makeFilter(() => {
          throw new Error("private schema detail")
        }),
      ),
      output: Schema.String,
    },
  },
  events: {},
})

for (const method of ["handler", "schema"] as const) {
  it.live(`returns HTTP 500 without exposing the ${method} defect`, () =>
    Effect.gen(function* () {
      const directory = yield* tmpdirScoped()
      const context = yield* Layer.build(
        createEmbeddedRoutes({
          database: { path: ":memory:" },
          models: { fetch: false },
          config: { directory: directory.path, project: false, content: "{}" },
          fs: { filewatcher: false },
        }).pipe(Layer.provide(HttpServer.layerServices)),
      )
      const sdk = Context.get(context, SdkPlugins.Service)
      yield* sdk.register(
        define({
          id: "broken-rpc",
          effect: (ctx) =>
            ctx.rpc
              .register(Broken, {
                handler: () => Effect.die(new Error("private handler detail")),
                schema: Effect.succeed,
              })
              .pipe(Effect.asVoid, Effect.orDie),
        }),
      )
      const handler = Context.get(context, HttpRouter.HttpRouter)
        .asHttpEffect()
        .pipe(HttpEffect.toWebHandlerWith(context))
      const url = new URL(`/api/rpc/broken/${method}`, "http://opencode.local")
      url.searchParams.set("location[directory]", directory.path)
      const response = yield* Effect.promise(() =>
        handler(
          new Request(url, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ input: "hello" }),
          }),
        ),
      )
      expect(response.status).toBe(500)
      expect(yield* Effect.promise(() => response.json())).toEqual({
        _tag: "RpcInternalError",
        type: "rpc.internal",
        message: "RPC call failed",
      })
    }),
  )
}
