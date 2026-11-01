import { describe, expect, test } from "bun:test"
import { panes, plan } from "../../src/cli/cmd/mux"

describe("panes", () => {
  test("uses one pane per directory when directories are given", () => {
    const result = panes({ dirs: ["/a", "/b"], count: 4, cwd: "/cwd", command: "bolt" })
    expect(result).toEqual([
      { directory: "/a", command: "bolt" },
      { directory: "/b", command: "bolt" },
    ])
  })

  test("falls back to count panes in the current directory", () => {
    const result = panes({ dirs: [], count: 3, cwd: "/cwd", command: "bolt" })
    expect(result).toHaveLength(3)
    expect(result.every((pane) => pane.directory === "/cwd" && pane.command === "bolt")).toBe(true)
  })
})

describe("plan", () => {
  const two = panes({ dirs: ["/a", "/b"], count: 2, cwd: "/cwd", command: "bolt" })

  test("splits the current window when inside tmux", () => {
    const steps = plan({ panes: two, inside: true, name: "bolt", layout: "tiled", attach: false })
    expect(steps).toEqual([
      ["split-window", "-d", "-c", "/a", "bolt"],
      ["split-window", "-d", "-c", "/b", "bolt"],
      ["select-layout", "tiled"],
    ])
  })

  test("creates a detached session and attaches when outside tmux", () => {
    const steps = plan({ panes: two, inside: false, name: "work", layout: "even-vertical", attach: true })
    expect(steps).toEqual([
      ["new-session", "-d", "-s", "work", "-c", "/a", "bolt"],
      ["split-window", "-d", "-t", "work", "-c", "/b", "bolt"],
      ["select-layout", "-t", "work", "even-vertical"],
      ["attach-session", "-t", "work"],
    ])
  })

  test("skips the attach step without a tty", () => {
    const steps = plan({ panes: two, inside: false, name: "work", layout: "tiled", attach: false })
    expect(steps.some((step) => step[0] === "attach-session")).toBe(false)
  })

  test("lays out a single pane without splits", () => {
    const one = panes({ dirs: [], count: 1, cwd: "/cwd", command: "bolt" })
    const steps = plan({ panes: one, inside: false, name: "bolt", layout: "tiled", attach: false })
    expect(steps).toEqual([
      ["new-session", "-d", "-s", "bolt", "-c", "/cwd", "bolt"],
      ["select-layout", "-t", "bolt", "tiled"],
    ])
  })
})
