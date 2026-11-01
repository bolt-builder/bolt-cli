import { describe, expect, test } from "bun:test"
import { parsePluginSpecifier } from "../../src/plugin/shared"

describe("parsePluginSpecifier", () => {
  test("parses standard npm package without version", () => {
    expect(parsePluginSpecifier("acme")).toEqual({
      pkg: "acme",
      version: "latest",
    })
  })

  test("parses standard npm package with version", () => {
    expect(parsePluginSpecifier("acme@1.0.0")).toEqual({
      pkg: "acme",
      version: "1.0.0",
    })
  })

  test("parses scoped npm package without version", () => {
    expect(parsePluginSpecifier("@bolt/acme")).toEqual({
      pkg: "@bolt/acme",
      version: "latest",
    })
  })

  test("parses scoped npm package with version", () => {
    expect(parsePluginSpecifier("@bolt/acme@1.0.0")).toEqual({
      pkg: "@bolt/acme",
      version: "1.0.0",
    })
  })

  test("parses package with git+https url", () => {
    expect(parsePluginSpecifier("acme@git+https://github.com/opencode/acme.git")).toEqual({
      pkg: "acme",
      version: "git+https://github.com/opencode/acme.git",
    })
  })

  test("parses scoped package with git+https url", () => {
    expect(parsePluginSpecifier("@bolt/acme@git+https://github.com/opencode/acme.git")).toEqual({
      pkg: "@bolt/acme",
      version: "git+https://github.com/opencode/acme.git",
    })
  })

  test("parses package with git+ssh url containing another @", () => {
    expect(parsePluginSpecifier("acme@git+ssh://git@github.com/opencode/acme.git")).toEqual({
      pkg: "acme",
      version: "git+ssh://git@github.com/opencode/acme.git",
    })
  })

  test("parses scoped package with git+ssh url containing another @", () => {
    expect(parsePluginSpecifier("@bolt/acme@git+ssh://git@github.com/opencode/acme.git")).toEqual({
      pkg: "@bolt/acme",
      version: "git+ssh://git@github.com/opencode/acme.git",
    })
  })

  test("parses unaliased git+ssh url", () => {
    expect(parsePluginSpecifier("git+ssh://git@github.com/opencode/acme.git")).toEqual({
      pkg: "git+ssh://git@github.com/opencode/acme.git",
      version: "",
    })
  })

  test("parses npm alias using the alias name", () => {
    expect(parsePluginSpecifier("acme@npm:@bolt/acme@1.0.0")).toEqual({
      pkg: "acme",
      version: "npm:@bolt/acme@1.0.0",
    })
  })

  test("parses bare npm protocol specifier using the target package", () => {
    expect(parsePluginSpecifier("npm:@bolt/acme@1.0.0")).toEqual({
      pkg: "@bolt/acme",
      version: "1.0.0",
    })
  })

  test("parses unversioned npm protocol specifier", () => {
    expect(parsePluginSpecifier("npm:@bolt/acme")).toEqual({
      pkg: "@bolt/acme",
      version: "latest",
    })
  })
})
