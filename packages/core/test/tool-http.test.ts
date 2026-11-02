import { describe, expect, test } from "bun:test"
import { interpolate, redact, resolve, summarize } from "@opencode/core/tool/plugin/http"

describe("interpolate", () => {
  test("fills placeholders from the environment", () => {
    const out = interpolate("Bearer ${TOKEN}", { TOKEN: "abc123" })
    expect(out.value).toBe("Bearer abc123")
    expect(out.missing).toEqual([])
    expect(out.used).toEqual(["abc123"])
  })

  test("fills several placeholders in one template", () => {
    const out = interpolate("${USER}:${PASS}", { USER: "u", PASS: "p" })
    expect(out.value).toBe("u:p")
    expect(out.used).toEqual(["u", "p"])
  })

  test("reports missing variables", () => {
    const out = interpolate("Bearer ${TOKEN}", {})
    expect(out.missing).toEqual(["TOKEN"])
    expect(out.used).toEqual([])
  })

  test("leaves plain values untouched", () => {
    const out = interpolate("application/json", { TOKEN: "abc" })
    expect(out.value).toBe("application/json")
    expect(out.missing).toEqual([])
    expect(out.used).toEqual([])
  })

  test("ignores malformed placeholders", () => {
    expect(interpolate("$TOKEN and ${1BAD}", { TOKEN: "x" }).value).toBe("$TOKEN and ${1BAD}")
  })
})

describe("resolve", () => {
  const profiles = {
    github: { headers: { Authorization: "Bearer ${GITHUB_TOKEN}", Accept: "application/vnd.github+json" } },
    plain: {},
  }

  test("resolves a profile and collects injected secrets", () => {
    const out = resolve(profiles, "github", { GITHUB_TOKEN: "ghp_secret" })
    expect(out).toEqual({
      ok: true,
      headers: { Authorization: "Bearer ghp_secret", Accept: "application/vnd.github+json" },
      secrets: ["ghp_secret"],
    })
  })

  test("accepts a profile without headers", () => {
    expect(resolve(profiles, "plain", {})).toEqual({ ok: true, headers: {}, secrets: [] })
  })

  test("fails on an unknown profile and lists the available ones", () => {
    const out = resolve(profiles, "gitlab", {})
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("github, plain")
  })

  test("fails when a referenced environment variable is not set", () => {
    const out = resolve(profiles, "github", {})
    expect(out.ok).toBe(false)
    if (!out.ok) expect(out.reason).toContain("GITHUB_TOKEN")
  })

  test("fails on malformed profile files", () => {
    expect(resolve([], "github", {}).ok).toBe(false)
    expect(resolve("nope", "github", {}).ok).toBe(false)
    expect(resolve({ github: "nope" }, "github", {}).ok).toBe(false)
    expect(resolve({ github: { headers: { Authorization: 5 } } }, "github", {}).ok).toBe(false)
  })
})

describe("redact", () => {
  test("scrubs secret values wherever they appear", () => {
    expect(redact("token ghp_secret leaked into ghp_secret twice", ["ghp_secret"])).toBe(
      "token [redacted] leaked into [redacted] twice",
    )
  })

  test("redacts short secrets as well", () => {
    expect(redact("a 1 b", ["1"])).toBe("a [redacted] b")
  })

  test("handles several secrets", () => {
    expect(redact("user alpha pass beta1", ["alpha", "beta1"])).toBe("user [redacted] pass [redacted]")
  })
})

describe("summarize", () => {
  test("describes top-level keys and types", () => {
    expect(summarize({ id: 1, name: "x", tags: ["a", "b"], meta: { deep: true }, gone: null })).toBe(
      ["id: number", "name: string", "tags: array(2) of string", "meta: object", "gone: null"].join("\n"),
    )
  })

  test("describes top-level arrays", () => {
    expect(summarize([{ id: 1 }, { id: 2 }])).toBe("array(2) of object")
    expect(summarize([])).toBe("array(0)")
  })

  test("describes scalars", () => {
    expect(summarize("hi")).toBe("string")
    expect(summarize(42)).toBe("number")
    expect(summarize(null)).toBe("null")
  })

  test("describes empty objects", () => {
    expect(summarize({})).toBe("object (empty)")
  })
})

import { Duration, Effect, Fiber, Layer } from "effect"
import { TestClock } from "effect/testing"
import { HttpClient } from "effect/http"
import { HttpTool } from "@opencode/core/tool/plugin/http"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Environment } from "@opencode/core/environment/index"
import { FileAccess } from "@opencode/core/file-access"
import { Location } from "@opencode/core/location"
import { Permission } from "@opencode/core/permission"
import { AbsolutePath } from "@opencode/core/schema"
import { Session } from "@opencode/core/session"
import { Tool } from "@opencode/core/tool"
import { makeLocationNode } from "@opencode/util/effect/app-node"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { LayerNodePlatform } from "@opencode/util/effect/app-node-platform"
import { location, tempLocationLayer } from "./fixture/location"
import { tmpdirScoped } from "./fixture/tmpdir"
import { permissionLayer } from "./lib/permission"
import { testEffect } from "./lib/effect"
import { executeTool, registerToolPlugin, toolIdentity } from "./lib/tool"
import fs from "node:fs/promises"
import path from "node:path"

const httpNode = makeLocationNode({
  name: "test/bolt-http",
  layer: Layer.effectDiscard(registerToolPlugin(HttpTool.Plugin)),
  deps: [Tool.node, FileAccess.node, Environment.node, Location.node, Permission.node, LayerNodePlatform.httpClient],
})
const it = testEffect(Layer.empty)
it.live("HTTP executes real requests, profiles, guarded redirects and bounded output with approvals", () =>
  Effect.gen(function* () {
    const temp = yield* tmpdirScoped()
    yield* Effect.promise(async () => {
      await fs.mkdir(path.join(temp.path, ".bolt"))
      await Bun.write(
        path.join(temp.path, ".bolt/http-profiles.json"),
        JSON.stringify({
          fixture: { headers: { Authorization: "Bearer ${BOLT_HTTP_FIXTURE_KEY}", "x-fixture": "profile" } },
        }),
      )
    })
    const previous = process.env.BOLT_HTTP_FIXTURE_KEY
    process.env.BOLT_HTTP_FIXTURE_KEY = "synthetic-http-secret"
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        if (previous === undefined) delete process.env.BOLT_HTTP_FIXTURE_KEY
        else process.env.BOLT_HTTP_FIXTURE_KEY = previous
      }),
    )
    const received: {
      path: string
      method: string
      authorization: string | null
      fixture: string | null
      body: string
    }[] = []
    const destination = Bun.serve({
      port: 0,
      fetch: async (request) => {
        received.push({
          path: new URL(request.url).pathname,
          method: request.method,
          authorization: request.headers.get("authorization"),
          fixture: request.headers.get("x-fixture"),
          body: await request.text(),
        })
        return Response.json(
          { token: process.env.BOLT_HTTP_FIXTURE_KEY, auth: request.headers.get("authorization") },
          { status: 201, headers: { "set-cookie": "private-cookie-value" } },
        )
      },
    })
    const server = Bun.serve({
      port: 0,
      fetch: async (request) => {
        const pathname = new URL(request.url).pathname
        if (pathname === "/redirect")
          return new Response(null, { status: 307, headers: { location: destination.url.href } })
        if (pathname === "/metadata")
          return new Response(null, { status: 302, headers: { location: "http://169.254.169.254/latest/meta-data/" } })
        if (pathname === "/large") return new Response("x".repeat(HttpTool.MAX_RESPONSE_SIZE + 1))
        if (pathname === "/long") return new Response("x".repeat(20_100), { status: 400 })
        received.push({
          path: pathname,
          method: request.method,
          authorization: request.headers.get("authorization"),
          fixture: request.headers.get("x-fixture"),
          body: await request.text(),
        })
        return Response.json({ ok: true, nested: [1, 2] })
      },
    })
    yield* Effect.addFinalizer(() =>
      Effect.sync(() => {
        server.stop(true)
        destination.stop(true)
      }),
    )
    const actions: Permission.AssertInput[] = []
    let denied = ""
    const permission = permissionLayer({
      assert: (input) =>
        Effect.sync(() => actions.push(input)).pipe(
          Effect.andThen(
            input.action === denied
              ? Effect.fail(
                  new Permission.BlockedError({ rules: [], permission: input.action, resources: input.resources }),
                )
              : Effect.void,
          ),
        ),
    })
    yield* Effect.gen(function* () {
      const registry = yield* Tool.Service
      const run = (
        input: Omit<typeof HttpTool.Input.Type, "method"> & { method?: typeof HttpTool.Input.Type.method },
      ) =>
        executeTool(registry, {
          sessionID: Session.ID.make("ses_http"),
          ...toolIdentity,
          call: { type: "tool-call", id: "http", name: "http", input },
          progress: () => Effect.void,
        })
      const initial = yield* run({
        url: server.url.href,
        method: "POST",
        body: "payload",
        profile: "fixture",
        headers: { "X-Fixture": "explicit" },
      })
      expect(initial.status).toBe("completed")
      expect(initial.output).toMatchObject({ status: 200, json: true, truncated: false, profile: "fixture" })
      expect(initial.output.output).toContain("nested: array(2) of number")
      expect(initial.output.output).toContain("authorization: [redacted]")
      expect(received[0]).toMatchObject({
        method: "POST",
        body: "payload",
        fixture: "explicit",
        authorization: "Bearer synthetic-http-secret",
      })
      expect(actions.map((entry) => entry.action)).toEqual(["read", "http"])
      const redirect = yield* run({
        url: new URL("redirect", server.url).href,
        method: "PUT",
        body: "again",
        profile: "fixture",
      })
      expect(redirect.status).toBe("completed")
      expect(redirect.output.status).toBe(201)
      expect(redirect.output.output).not.toContain("synthetic-http-secret")
      expect(redirect.output.output).not.toContain("private-cookie-value")
      expect(received.at(-1)).toMatchObject({ method: "PUT", body: "again", authorization: null, fixture: null })
      expect(actions.at(-1)?.resources).toEqual([`PUT ${destination.url.href}`])
      expect((yield* run({ url: new URL("metadata", server.url).href })).status).toBe("error")
      expect((yield* run({ url: new URL("large", server.url).href })).status).toBe("error")
      const long = yield* run({ url: new URL("long", server.url).href })
      expect(long).toMatchObject({ status: "completed" })
      expect(long.output).toMatchObject({ status: 400, truncated: true, json: false })
      expect(long.output.output).toContain("showing first 20000 of 20100")
      const count = received.length
      denied = "http"
      expect((yield* run({ url: server.url.href })).status).toBe("error")
      expect(received).toHaveLength(count)
      denied = "read"
      expect((yield* run({ url: server.url.href, profile: "fixture" })).status).toBe("error")
      expect(received).toHaveLength(count)
      expect((yield* run({ url: "file:///etc/passwd" })).status).toBe("error")
      expect((yield* run({ url: "http://user:password@localhost/" })).status).toBe("error")
    }).pipe(
      Effect.provide(
        AppNodeBuilder.build(LayerNode.group([Tool.node, httpNode]), [
          Location.node.replace(Layer.succeed(Location.Service, location({ directory: AbsolutePath.make(temp.path) }))),
          Permission.node.replace(permission),
        ]),
      ),
    )
  }),
)

const timed = testEffect(
  AppNodeBuilder.build(LayerNode.group([Tool.node, httpNode]), [
    Location.node.replace(tempLocationLayer),
    Permission.node.replace(permissionLayer({ assert: () => Effect.void })),
    LayerNodePlatform.httpClient.replace(
      Layer.succeed(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.never),
      ),
    ),
  ]),
)
timed.effect("HTTP timeout interrupts the complete request, not only admission", () =>
  Effect.gen(function* () {
    const registry = yield* Tool.Service
    const request = yield* executeTool(registry, {
      sessionID: Session.ID.make("ses_http_timeout"),
      ...toolIdentity,
      call: { type: "tool-call", id: "timeout", name: "http", input: { url: "https://1.1.1.1/", timeout: 1 } },
      progress: () => Effect.void,
    }).pipe(Effect.forkChild({ startImmediately: true }))
    yield* TestClock.adjust(Duration.seconds(1))
    const result = yield* Fiber.join(request)
    expect(result.status).toBe("error")
    expect(JSON.stringify(result.error)).toContain("Request timed out")
  }),
)
