import { describe, expect, test } from "bun:test"
import { OpenApi } from "effect/unstable/httpapi"
import { Api } from "@opencode-ai/server/api"
import { ROUTES, VERSION, surface } from "../../src/server/surface"

const spec = OpenApi.fromApi(Api)

describe("surface", () => {
  test("every pinned route exists in the real API definition", () => {
    for (const route of ROUTES) {
      const operations = spec.paths[route.path]
      expect(operations, `missing path ${route.path}`).toBeDefined()
      expect(Object.keys(operations ?? {}), `missing ${route.method} ${route.path}`).toContain(route.method)
    }
  })

  test("covers sessions, prompts, and events", () => {
    const names = ROUTES.map((route) => route.name)
    expect(names).toContain("session.create")
    expect(names).toContain("session.prompt")
    expect(names).toContain("event.subscribe")
  })

  test("descriptor carries version, base, openapi url, and absolute route urls", () => {
    const result = surface("http://127.0.0.1:4096/")
    expect(result.version).toBe(VERSION)
    expect(result.base).toBe("http://127.0.0.1:4096")
    expect(result.openapi).toBe("http://127.0.0.1:4096/doc")
    expect(result.routes[0].url).toBe("http://127.0.0.1:4096" + result.routes[0].path)
    expect(result.routes).toHaveLength(ROUTES.length)
  })

  test("route names are unique", () => {
    const names = ROUTES.map((route) => route.name)
    expect(new Set(names).size).toBe(names.length)
  })
})
