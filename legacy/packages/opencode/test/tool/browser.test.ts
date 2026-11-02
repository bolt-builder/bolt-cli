import { describe, expect, test } from "bun:test"
import { args, binary, normalize, strip } from "../../src/tool/browser"

describe("browser.normalize", () => {
  test("accepts http and https URLs", () => {
    expect(normalize("http://localhost:3000/settings")).toBe("http://localhost:3000/settings")
    expect(normalize("https://example.com/a?b=c")).toBe("https://example.com/a?b=c")
  })

  test("treats scheme-less hosts as http", () => {
    expect(normalize("localhost:3000/settings")).toBe("http://localhost:3000/settings")
    expect(normalize("127.0.0.1:8080")).toBe("http://127.0.0.1:8080/")
    expect(normalize("example.com/path")).toBe("http://example.com/path")
  })

  test("rejects non-http schemes and malformed input", () => {
    expect(normalize("file:///etc/passwd")).toBeUndefined()
    expect(normalize("chrome://settings")).toBeUndefined()
    expect(normalize("javascript:alert(1)")).toBeUndefined()
    expect(normalize("mailto:someone@example.com")).toBeUndefined()
    expect(normalize("")).toBeUndefined()
    expect(normalize("   ")).toBeUndefined()
  })
})

describe("browser.binary", () => {
  test("picks the first resolved candidate", () => {
    expect(binary([undefined, null, "/usr/bin/chromium", "/usr/bin/google-chrome"])).toBe("/usr/bin/chromium")
  })

  test("returns undefined when nothing resolves", () => {
    expect(binary([undefined, null, undefined])).toBeUndefined()
  })
})

describe("browser.args", () => {
  test("builds a headless screenshot invocation", () => {
    const built = args("screenshot", "http://localhost:3000", {
      out: "/tmp/shot.png",
      width: 1280,
      height: 800,
      sandbox: true,
    })
    expect(built).toContain("--headless=new")
    expect(built).toContain("--screenshot=/tmp/shot.png")
    expect(built).toContain("--window-size=1280,800")
    expect(built).not.toContain("--no-sandbox")
    expect(built).not.toContain("--dump-dom")
    expect(built[built.length - 1]).toBe("http://localhost:3000")
  })

  test("dumps the DOM for text captures", () => {
    const built = args("text", "http://localhost:3000", { width: 800, height: 600, sandbox: true })
    expect(built).toContain("--dump-dom")
    expect(built.some((arg) => arg.startsWith("--screenshot"))).toBe(false)
  })

  test("disables the chromium sandbox only when the environment cannot use it", () => {
    const built = args("text", "http://localhost:3000", { width: 800, height: 600, sandbox: false })
    expect(built).toContain("--no-sandbox")
  })
})

describe("browser.strip", () => {
  test("extracts visible text and drops scripts, styles, and tags", () => {
    const html = [
      "<html><head><style>body { color: red }</style>",
      "<script>console.log('hi')</script></head>",
      "<body><h1>Dashboard</h1><p>Jobs &amp; Runs</p></body></html>",
    ].join("")
    const text = strip(html)
    expect(text).toContain("Dashboard")
    expect(text).toContain("Jobs & Runs")
    expect(text).not.toContain("color: red")
    expect(text).not.toContain("console.log")
    expect(text).not.toContain("<h1>")
  })

  test("decodes common entities and collapses whitespace", () => {
    expect(strip("<p>a&nbsp;&lt;b&gt;   c&quot;d&#39;e</p>")).toBe(`a <b> c"d'e`)
  })
})
