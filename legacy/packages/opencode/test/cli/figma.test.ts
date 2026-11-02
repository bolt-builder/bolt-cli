import { describe, expect, test } from "bun:test"
import { hex, parse, simplify } from "../../src/cli/cmd/figma"
import type { Node } from "../../src/cli/cmd/figma"

describe("parse", () => {
  test("parses a file URL with a node id", () => {
    expect(parse("https://www.figma.com/file/AbC123/My-File?node-id=12-34")).toEqual({
      key: "AbC123",
      node: "12:34",
    })
  })

  test("parses a design URL with a node id", () => {
    expect(parse("https://www.figma.com/design/Xyz789/Landing-Page?node-id=1-2&t=abcdef-0")).toEqual({
      key: "Xyz789",
      node: "1:2",
    })
  })

  test("keeps a node id that already uses colons", () => {
    expect(parse("https://www.figma.com/design/Xyz789/Name?node-id=12%3A34")?.node).toBe("12:34")
  })

  test("returns an undefined node when node-id is missing", () => {
    expect(parse("https://www.figma.com/design/Xyz789/Name")).toEqual({ key: "Xyz789", node: undefined })
  })

  test("rejects non-figma hosts", () => {
    expect(parse("https://example.com/design/Xyz789/Name?node-id=1-2")).toBeUndefined()
  })

  test("rejects figma paths that are not files or designs", () => {
    expect(parse("https://www.figma.com/proto/Xyz789/Name?node-id=1-2")).toBeUndefined()
  })

  test("rejects strings that are not URLs", () => {
    expect(parse("not a url")).toBeUndefined()
  })
})

describe("hex", () => {
  test("converts normalized rgb to hex", () => {
    expect(hex({ r: 1, g: 0, b: 0 })).toBe("#ff0000")
    expect(hex({ r: 1, g: 1, b: 1 })).toBe("#ffffff")
  })

  test("appends an alpha channel for translucent paints", () => {
    expect(hex({ r: 0, g: 0, b: 0 }, 0.5)).toBe("#00000080")
    expect(hex({ r: 0, g: 0, b: 0, a: 0.5 })).toBe("#00000080")
  })
})

describe("simplify", () => {
  const frame = {
    id: "1:2",
    type: "FRAME",
    name: "Card",
    layoutMode: "VERTICAL",
    itemSpacing: 8,
    paddingLeft: 16,
    paddingRight: 16,
    paddingTop: 12,
    paddingBottom: 12,
    cornerRadius: 8,
    absoluteBoundingBox: { x: 0, y: 0, width: 320, height: 200 },
    constraints: { vertical: "TOP", horizontal: "LEFT" },
    fills: [{ type: "SOLID", color: { r: 1, g: 1, b: 1 } }],
    children: [
      {
        id: "1:3",
        type: "TEXT",
        name: "Title",
        characters: "Hello",
        style: { fontFamily: "Inter", fontSize: 16, fontWeight: 600 },
        fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 } }],
      },
      {
        id: "1:4",
        type: "VECTOR",
        name: "Icon",
        fillGeometry: [{ path: "M0 0L10 10Z", windingRule: "NONZERO" }],
        strokeGeometry: [{ path: "M0 0L10 10Z", windingRule: "NONZERO" }],
        fills: [{ type: "SOLID", color: { r: 0.5, g: 0.5, b: 0.5 } }],
        children: [{ id: "1:5", type: "VECTOR", name: "Path" }],
      },
    ],
  }

  test("keeps layout, spacing, color, and structure", () => {
    const out = simplify(frame)
    expect(out).toEqual({
      type: "FRAME",
      name: "Card",
      layout: "vertical",
      gap: 8,
      padding: { left: 16, right: 16, top: 12, bottom: 12 },
      radius: 8,
      fills: ["#ffffff"],
      children: [
        {
          type: "TEXT",
          name: "Title",
          font: { family: "Inter", size: 16, weight: 600 },
          text: "Hello",
          fills: ["#000000"],
        },
        {
          type: "VECTOR",
          name: "Icon",
          fills: ["#808080"],
        },
      ],
    })
  })

  test("drops raw vector geometry and vector children", () => {
    const out = simplify(frame)
    const icon = out?.children?.at(1)
    expect(icon?.children).toBeUndefined()
    expect(JSON.stringify(out)).not.toContain("windingRule")
  })

  test("skips invisible and non-solid fills", () => {
    const out = simplify({
      type: "RECTANGLE",
      fills: [
        { type: "SOLID", visible: false, color: { r: 1, g: 0, b: 0 } },
        { type: "GRADIENT_LINEAR" },
        { type: "SOLID", color: { r: 0, g: 1, b: 0 } },
      ],
    })
    expect(out?.fills).toEqual(["#00ff00"])
  })

  test("applies paint opacity to fills", () => {
    const out = simplify({
      type: "RECTANGLE",
      fills: [{ type: "SOLID", color: { r: 0, g: 0, b: 0 }, opacity: 0.5 }],
    })
    expect(out?.fills).toEqual(["#00000080"])
  })

  test("caps recursion depth", () => {
    const chain = Array.from({ length: 20 }, (value, index) => index).reduce<Node>(
      (child, level) => ({ type: "FRAME", name: String(level), children: [child] }),
      { type: "TEXT", characters: "leaf" },
    )
    let out = simplify(chain)
    let depth = 0
    while (out?.children) {
      out = out.children[0]
      depth++
    }
    expect(depth).toBe(12)
  })

  test("caps the number of children", () => {
    const wide = {
      type: "FRAME",
      children: Array.from({ length: 100 }, () => ({ type: "TEXT", characters: "item" })),
    }
    expect(simplify(wide)?.children?.length).toBe(40)
  })

  test("truncates very long text", () => {
    const out = simplify({ type: "TEXT", characters: "x".repeat(10_000) })
    expect(out?.text?.length).toBe(2_000)
  })

  test("omits padding when all sides are zero", () => {
    expect(simplify({ type: "FRAME" })?.padding).toBeUndefined()
  })
})
