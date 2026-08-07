import { describe, expect, test } from "bun:test"
import { BUILTIN, applicable, generic, hops, markdown, version } from "../../src/cli/cmd/migrate"

const MANIFESTS = {
  "package.json": { name: "root", dependencies: { react: "^17.0.2" }, devDependencies: { eslint: "~8.57.0" } },
  "packages/app/package.json": { name: "app", dependencies: { express: "4.19.0" } },
}

describe("version", () => {
  test("finds declared versions with ranges stripped", () => {
    expect(version(MANIFESTS, "react")).toBe("17.0.2")
    expect(version(MANIFESTS, "eslint")).toBe("8.57.0")
    expect(version(MANIFESTS, "express")).toBe("4.19.0")
    expect(version(MANIFESTS, "ghost")).toBeUndefined()
  })
})

describe("hops", () => {
  test("chains curated playbooks across multiple majors", () => {
    const chain = hops("react", 17, 19, BUILTIN)
    expect(chain.map((book) => book.title)).toEqual(["React 17 to 18", "React 18 to 19"])
  })

  test("fills gaps with generic playbooks", () => {
    const chain = hops("react", 16, 18, BUILTIN)
    expect(chain[0].title).toBe("react 16 to 17 (generic)")
    expect(chain[1].title).toBe("React 17 to 18")
  })

  test("returns an empty chain when already at the target", () => {
    expect(hops("react", 19, 19, BUILTIN)).toEqual([])
  })
})

describe("generic", () => {
  test("produces actionable single-hop steps", () => {
    const book = generic("lodash", 4, 5)
    expect(book.steps.some((step) => step.includes("lodash"))).toBe(true)
    expect(book.steps.some((step) => step.includes("^5.0.0"))).toBe(true)
  })
})

describe("applicable", () => {
  test("lists curated playbooks whose from-major matches the declared major", () => {
    const found = applicable(MANIFESTS, BUILTIN)
    expect(found.map((entry) => entry.book.title).sort()).toEqual(["ESLint 8 to 9", "Express 4 to 5", "React 17 to 18"])
  })

  test("skips packages on other majors", () => {
    const found = applicable({ "package.json": { dependencies: { react: "^18.3.0", tailwindcss: "^2.0.0" } } }, BUILTIN)
    expect(found.map((entry) => entry.book.title)).toEqual(["React 18 to 19"])
  })
})

describe("markdown", () => {
  test("renders chained checklists with hop count", () => {
    const text = markdown("react", "17.0.2", hops("react", 17, 19, BUILTIN))
    expect(text).toContain("# Migration: react 17.0.2 to 19.x")
    expect(text).toContain("2 major hops. Land and verify each hop before starting the next.")
    expect(text).toContain("## React 17 to 18")
    expect(text).toContain("## React 18 to 19")
    expect(text).toContain(
      "- [ ] Replace `ReactDOM.render(el, node)` with `createRoot(node).render(el)` from `react-dom/client`",
    )
  })

  test("handles an empty chain", () => {
    expect(markdown("react", "19.1.0", [])).toContain("Already at or past the target major (currently 19.1.0).")
  })
})
