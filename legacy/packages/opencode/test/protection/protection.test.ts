import { describe, expect, test } from "bun:test"
import { Protection } from "@/protection"

describe("protection.match", () => {
  test("returns undefined when no patterns are configured", () => {
    expect(Protection.match(".env")).toBeUndefined()
    expect(Protection.match(".env", [])).toBeUndefined()
  })

  test("matches exact paths", () => {
    expect(Protection.match(".env", [".env"])).toBe(".env")
    expect(Protection.match("src/index.ts", [".env"])).toBeUndefined()
  })

  test("matches wildcard patterns", () => {
    expect(Protection.match(".env.production", [".env*"])).toBe(".env*")
    expect(Protection.match("secrets/key.pem", ["secrets/*"])).toBe("secrets/*")
    expect(Protection.match("infra/prod/main.tf", ["infra/*"])).toBe("infra/*")
  })

  test("directory patterns protect everything beneath them", () => {
    expect(Protection.match("secrets/key.pem", ["secrets"])).toBe("secrets")
    expect(Protection.match("secrets/nested/deep.txt", ["secrets/"])).toBe("secrets/")
  })

  test("does not protect sibling paths with a shared prefix", () => {
    expect(Protection.match("secrets-doc.md", ["secrets"])).toBeUndefined()
  })

  test("returns the first matching pattern", () => {
    expect(Protection.match(".env", ["*.lock", ".env", ".env*"])).toBe(".env")
  })

  test("ignores empty patterns", () => {
    expect(Protection.match("anything", ["", "/"])).toBeUndefined()
  })
})
