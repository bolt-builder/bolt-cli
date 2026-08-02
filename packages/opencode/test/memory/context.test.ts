import { describe, expect, test } from "bun:test"
import fs from "fs/promises"
import os from "os"
import path from "path"
import { Effect } from "effect"
import { BoltMemory } from "@opencode-ai/memory/effect"
import { MemoryControls } from "@opencode-ai/memory/controls"
import { InstanceRef } from "../../src/effect/instance-ref"
import type { InstanceContext } from "../../src/project/instance-context"
import { MemoryHost } from "@/memory/host"
import { SessionID } from "@/session/schema"
import type { Session } from "@/session/session"

const id = SessionID.make("ses_memory_context")

function sessions(metadata: Record<string, unknown>): Session.Interface {
  return { get: () => Effect.succeed({ metadata }) } as unknown as Session.Interface
}

async function fixture() {
  const dir = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-memory-context-"))
  return { dir, ctx: { directory: dir, worktree: dir } }
}

function run(ctx: { directory: string; worktree: string }, metadata: Record<string, unknown> = {}) {
  return Effect.runPromise(
    MemoryHost.context({ sessionID: id, sessions: sessions(metadata) }).pipe(
      Effect.provideService(InstanceRef, ctx as unknown as InstanceContext),
    ),
  )
}

describe("memory host context", () => {
  test("injects guidance and saved memory for an enabled store", async () => {
    const f = await fixture()
    await BoltMemory.enable({ ctx: f.ctx })
    await BoltMemory.remember({ ctx: f.ctx, text: "Deploys happen via the ship script" })
    const blocks = await run(f.ctx)
    expect(blocks).toHaveLength(1)
    expect(blocks[0]).toContain("memory_recall")
    expect(blocks[0]).toContain("ship script")
  })

  test("empty when the store is disabled", async () => {
    const f = await fixture()
    expect(await run(f.ctx)).toEqual([])
  })

  test("empty when the session opted out of memory use", async () => {
    const f = await fixture()
    await BoltMemory.enable({ ctx: f.ctx })
    await BoltMemory.remember({ ctx: f.ctx, text: "Deploys happen via the ship script" })
    expect(await run(f.ctx, { [MemoryControls.USE]: false })).toEqual([])
  })
})
