import { expect } from "bun:test"
import { SdkPlugins } from "@opencode/core/plugin/sdk"
import { define } from "@opencode/plugin/effect/plugin"
import { Rpc } from "@opencode/schema/rpc"
import { Context, Effect, Layer, Schema } from "effect"
import { HttpEffect, HttpRouter, HttpServer } from "effect/http"
import { tmpdirScoped } from "../../core/test/fixture/tmpdir"
import { it } from "../../core/test/lib/effect"
import { createEmbeddedRoutes } from "../src/routes"

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

it.live("serves built-in Bolt command RPCs at the project location", () =>
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
    const handler = Context.get(context, HttpRouter.HttpRouter).asHttpEffect().pipe(HttpEffect.toWebHandlerWith(context))
    const call = (route: string, input: unknown) => {
      const url = new URL(route, "http://opencode.local")
      url.searchParams.set("location[directory]", directory.path)
      return Effect.promise(() => handler(new Request(url, {
        method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ input }),
      })))
    }
    const memory = yield* call("/api/rpc/bolt.memory/command", { text: "status" })
    expect(memory.status).toBe(200)
    expect(yield* Effect.promise(() => memory.json())).toMatchObject({ output: { text: expect.stringContaining("Project memory") } })
    const processes = yield* call("/api/rpc/bolt.process/list", {})
    expect(processes.status).toBe(200)
    expect(yield* Effect.promise(() => processes.json())).toEqual({ output: [] })
    const created = yield* Effect.promise(() => handler(new Request("http://opencode.local/api/session", {
      method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ location: { directory: directory.path } }),
    })))
    const session = yield* Effect.promise(() => created.json())
    const sandbox = yield* call("/api/rpc/bolt.sandbox/set", { sessionID: session.data.id, enabled: true })
    expect(sandbox.status).toBe(200)
    expect(yield* Effect.promise(() => sandbox.json())).toEqual({ output: { enabled: true } })
  }),
)

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
