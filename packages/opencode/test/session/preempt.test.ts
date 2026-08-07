import { describe, expect, test } from "bun:test"
import { ConfigV1 } from "@opencode-ai/core/v1/config/config"
import type { Provider } from "@/provider/provider"
import { PREEMPT_RATIO, shouldPreempt, usable } from "@/session/overflow"

function createModel(opts: { context: number; output: number; input?: number }): Provider.Model {
  return {
    id: "test-model",
    providerID: "test",
    name: "Test",
    limit: {
      context: opts.context,
      input: opts.input,
      output: opts.output,
    },
    cost: { input: 0, output: 0, cache: { read: 0, write: 0 } },
    capabilities: {
      toolcall: true,
      attachment: false,
      reasoning: false,
      temperature: true,
      input: { text: true, image: false, audio: false, video: false },
      output: { text: true, image: false, audio: false, video: false },
    },
    api: { npm: "@ai-sdk/anthropic" },
    options: {},
  } as Provider.Model
}

function tokens(input: number) {
  return { input, output: 0, reasoning: 0, cache: { read: 0, write: 0 } }
}

const enabled: ConfigV1.Info = { compaction: { preemptive: true } } as ConfigV1.Info

describe("session.overflow.shouldPreempt", () => {
  test("returns false when preemptive is not enabled", () => {
    const model = createModel({ context: 100_000, output: 32_000 })
    const count = Math.ceil(usable({ cfg: {} as ConfigV1.Info, model }) * PREEMPT_RATIO)
    expect(shouldPreempt({ cfg: {} as ConfigV1.Info, tokens: tokens(count), model })).toBe(false)
    const off: ConfigV1.Info = { compaction: { preemptive: false } } as ConfigV1.Info
    expect(shouldPreempt({ cfg: off, tokens: tokens(count), model })).toBe(false)
  })

  test("returns true at the preempt threshold when enabled", () => {
    const model = createModel({ context: 100_000, output: 32_000 })
    const count = Math.ceil(usable({ cfg: enabled, model }) * PREEMPT_RATIO)
    expect(shouldPreempt({ cfg: enabled, tokens: tokens(count), model })).toBe(true)
  })

  test("returns false below the preempt threshold", () => {
    const model = createModel({ context: 100_000, output: 32_000 })
    const count = Math.floor(usable({ cfg: enabled, model }) * PREEMPT_RATIO) - 1
    expect(shouldPreempt({ cfg: enabled, tokens: tokens(count), model })).toBe(false)
  })

  test("returns false when auto compaction is disabled", () => {
    const model = createModel({ context: 100_000, output: 32_000 })
    const cfg: ConfigV1.Info = { compaction: { preemptive: true, auto: false } } as ConfigV1.Info
    expect(shouldPreempt({ cfg, tokens: tokens(90_000), model })).toBe(false)
  })

  test("returns false when the model reports no context limit", () => {
    const model = createModel({ context: 0, output: 32_000 })
    expect(shouldPreempt({ cfg: enabled, tokens: tokens(90_000), model })).toBe(false)
  })

  test("counts cache tokens toward the threshold", () => {
    const model = createModel({ context: 100_000, output: 32_000 })
    const threshold = Math.ceil(usable({ cfg: enabled, model }) * PREEMPT_RATIO)
    const split = {
      input: threshold - 10_000,
      output: 5_000,
      reasoning: 0,
      cache: { read: 5_000, write: 0 },
    }
    expect(shouldPreempt({ cfg: enabled, tokens: split, model })).toBe(true)
  })

  test("respects the input token limit when present", () => {
    const model = createModel({ context: 400_000, input: 272_000, output: 128_000 })
    const threshold = Math.ceil(usable({ cfg: enabled, model }) * PREEMPT_RATIO)
    expect(shouldPreempt({ cfg: enabled, tokens: tokens(threshold), model })).toBe(true)
    expect(shouldPreempt({ cfg: enabled, tokens: tokens(threshold - 1), model })).toBe(false)
  })
})
