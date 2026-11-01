import { describe, expect, test } from "bun:test"
import path from "node:path"
import { Option, Schema } from "effect"
import { Profile, aggregate, plan, render } from "../../src/tool/profile"

const fixture = path.join(__dirname, "fixtures", "profile.cpuprofile")

async function load() {
  const parsed = Schema.decodeUnknownOption(Profile)(await Bun.file(fixture).json())
  if (Option.isNone(parsed)) throw new Error("fixture did not decode as a V8 CPU profile")
  return parsed.value
}

describe("profile.aggregate", () => {
  test("returns frames sorted by self time with totals including callees", async () => {
    const frames = aggregate(await load(), 10)
    expect(frames).toEqual([
      { name: "hot", location: "file:///app/main.ts:10", self: 4000, total: 4000 },
      { name: "cold", location: "file:///app/main.ts:20", self: 500, total: 500 },
      { name: "main", location: "file:///app/main.ts:1", self: 250, total: 4750 },
    ])
  })

  test("excludes V8 bookkeeping frames like (root) and (garbage collector)", async () => {
    const frames = aggregate(await load(), 10)
    expect(frames.map((frame) => frame.name)).not.toContain("(root)")
    expect(frames.map((frame) => frame.name)).not.toContain("(garbage collector)")
  })

  test("respects the frame limit", async () => {
    const frames = aggregate(await load(), 1)
    expect(frames).toHaveLength(1)
    expect(frames[0].name).toBe("hot")
  })

  test("merges nodes that share a function and location", () => {
    const frames = aggregate(
      {
        nodes: [
          { id: 1, callFrame: { functionName: "(root)", url: "", lineNumber: -1 }, children: [2, 3] },
          { id: 2, callFrame: { functionName: "work", url: "file:///a.ts", lineNumber: 4 }, children: [] },
          { id: 3, callFrame: { functionName: "work", url: "file:///a.ts", lineNumber: 4 }, children: [] },
        ],
        samples: [2, 3],
        timeDeltas: [100, 200],
      },
      10,
    )
    expect(frames).toEqual([{ name: "work", location: "file:///a.ts:5", self: 300, total: 300 }])
  })

  test("labels frames without a url as native", () => {
    const frames = aggregate(
      {
        nodes: [{ id: 1, callFrame: { functionName: "memcpy", url: "", lineNumber: -1 } }],
        samples: [1],
        timeDeltas: [50],
      },
      10,
    )
    expect(frames).toEqual([{ name: "memcpy", location: "(native)", self: 50, total: 50 }])
  })
})

describe("profile.plan", () => {
  test("injects the V8 profiler flags after the bun runtime token", () => {
    const planned = plan("bun ./scripts/bench.ts --flag", "/tmp/prof")
    expect(planned.kind).toBe("cpuprofile")
    expect(planned.command).toBe("bun --cpu-prof --cpu-prof-dir=/tmp/prof ./scripts/bench.ts --flag")
  })

  test("recognizes node by basename even with an absolute path", () => {
    const planned = plan("/usr/local/bin/node server.js", "/tmp/prof")
    expect(planned.kind).toBe("cpuprofile")
    expect(planned.command).toBe("/usr/local/bin/node --cpu-prof --cpu-prof-dir=/tmp/prof server.js")
  })

  test("falls back to /usr/bin/time for non-JS commands", () => {
    const planned = plan("cargo build --release", "/tmp/prof")
    expect(planned.kind).toBe("time")
    expect(planned.command).toBe("/usr/bin/time -v cargo build --release")
  })
})

describe("profile.render", () => {
  test("renders an aligned table with millisecond times", () => {
    const out = render([{ name: "hot", location: "file:///app/main.ts:10", self: 4000, total: 4000 }])
    const lines = out.split("\n")
    expect(lines[0]).toContain("self(ms)")
    expect(lines[1]).toContain("4.0")
    expect(lines[1]).toContain("hot")
    expect(lines[1]).toContain("file:///app/main.ts:10")
  })
})
