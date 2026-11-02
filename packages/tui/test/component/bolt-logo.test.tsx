/** @jsxImportSource @opentui/solid */
import { testRender } from "@opentui/solid"
import { RGBA } from "@opentui/core"
import { expect, test } from "bun:test"
import { Logo } from "../../src/component/logo"
import { ConfigProvider } from "../../src/config"
import { ThemeProvider } from "../../src/context/theme"
import { compact, logo } from "../../src/logo"
import { emptyThemeSource, tmpdir } from "../fixture/fixture"
import { TestTuiContexts } from "../fixture/tui-environment"
import { createTuiResolvedConfig } from "../fixture/tui-runtime"

test.each([
  [44, 40],
  [100, 40],
  [44, 14],
])("renders the Bolt logo at %s by %s", async (width, height) => {
  await using temporary = await tmpdir()
  const app = await testRender(
    () => (
      <TestTuiContexts paths={{ state: temporary.path }}>
        <ConfigProvider config={createTuiResolvedConfig({})}>
          <ThemeProvider mode="dark" source={emptyThemeSource}>
            <Logo />
          </ThemeProvider>
        </ConfigProvider>
      </TestTuiContexts>
    ),
    { width, height },
  )
  try {
    await app.renderOnce()
    const frame = app.captureCharFrame()
    if (height < 16) {
      expect(frame).toContain(compact[0])
      expect(frame).not.toContain(logo.left[1])
      return
    }
    expect(frame).toContain(logo.left[1])
    expect(frame).toContain(logo.right[1])
    expect(frame).toContain("$$__")
  } finally {
    app.renderer.destroy()
  }
})

for (const mode of ["dark", "light"] as const) {
  test(`original Bolt gradient and literal strokes in ${mode} mode`, async () => {
    await using temporary = await tmpdir()
    const app = await testRender(
      () => (
        <TestTuiContexts paths={{ state: temporary.path }}>
          <ConfigProvider config={createTuiResolvedConfig({ theme: { name: "bolt", mode } })}>
            <ThemeProvider mode={mode} source={emptyThemeSource}>
              <Logo />
            </ThemeProvider>
          </ConfigProvider>
        </TestTuiContexts>
      ),
      { width: 100, height: 40 },
    )
    try {
      await app.renderOnce()
      const spans = app.captureSpans().lines.flatMap((line) => line.spans)
      expect(spans.some((span) => span.fg.equals(RGBA.fromHex(mode === "dark" ? "#63d9ff" : "#1f5fbf")))).toBe(true)
      expect(spans.some((span) => span.fg.equals(RGBA.fromHex(mode === "dark" ? "#2d7bff" : "#3b7dd8")))).toBe(true)
      expect(app.captureCharFrame()).toContain("|_______/")
    } finally {
      app.renderer.destroy()
    }
  })
}
