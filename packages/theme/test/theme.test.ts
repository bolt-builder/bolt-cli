import { expect, test } from "bun:test"
import { migrateV1, migrateV1NewDesigns, resolveThemeDocument } from "../src/tui/index.js"
import { resolveV1 } from "../src/tui/v1-migrate.js"
import type { ThemeV1Json } from "../src/tui/v1.js"

const source: ThemeV1Json = await Bun.file(new URL("../../tui/src/theme/assets/opencode.json", import.meta.url)).json()
const document = migrateV1(source)

test.each(["light", "dark"] as const)("resolves %s themes without status tokens", (mode) => {
  const theme = resolveThemeDocument(document, mode)
  expect("status" in theme.text).toBeFalse()
  expect(theme.hue.accent[800]).toBeDefined()
  expect(theme.hue.interactive[800]).toBeDefined()
})

test.each(["light", "dark"] as const)("keeps original brand endpoints under both %s migrations", (mode) => {
  for (const migrate of [migrateV1, migrateV1NewDesigns]) {
    const resolved = resolveThemeDocument(migrate(source), mode)
    const original = resolveV1(source, mode)
    expect(resolved.brand.primary.equals(original.primary)).toBe(true)
    expect(resolved.brand.accent.equals(original.accent)).toBe(true)
    expect(resolved.surface("dialog").brand.primary.equals(resolved.brand.primary)).toBe(true)
  }
})

test("custom V2 themes without brand tokens inherit their own hues", () => {
  const custom = {
    ...document,
    base: { ...document.base, brand: undefined },
    ...(document.dark ? { dark: { ...document.dark, brand: undefined } } : {}),
  }
  const resolved = resolveThemeDocument(custom, "dark")
  expect(resolved.brand.primary.equals(resolved.hue.interactive[200])).toBe(true)
  expect(resolved.brand.accent.equals(resolved.hue.accent[200])).toBe(true)
})
