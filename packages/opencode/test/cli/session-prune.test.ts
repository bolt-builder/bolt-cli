import { describe, expect, test } from "bun:test"
import { SessionProjector } from "@opencode-ai/core/session/projector"
import { Effect, Layer } from "effect"
import { Session as SessionNs } from "@/session/session"
import { cutoff } from "@/cli/cmd/session"
import { CrossSpawnSpawner } from "@opencode-ai/core/cross-spawn-spawner"
import { testEffect } from "../lib/effect"
import { RuntimeFlags } from "@/effect/runtime-flags"
import { EventV2Bridge } from "@/event-v2-bridge"
import { AppNodeBuilder } from "@opencode-ai/core/effect/app-node-builder"
import { LayerNode } from "@opencode-ai/core/effect/layer-node"
import { InstanceStore } from "@/project/instance-store"
import { InstanceBootstrap } from "@/project/bootstrap"

const day = 86_400_000
const now = Date.parse("2026-08-07T12:00:00.000Z")

describe("session.prune.cutoff", () => {
  test("computes the retention boundary", () => {
    expect(cutoff(30, now)).toBe(now - 30 * day)
    expect(cutoff(1, now)).toBe(now - day)
  })

  test("rejects non-positive and non-finite windows", () => {
    expect(cutoff(0, now)).toBeUndefined()
    expect(cutoff(-7, now)).toBeUndefined()
    expect(cutoff(Number.NaN, now)).toBeUndefined()
    expect(cutoff(Number.POSITIVE_INFINITY, now)).toBeUndefined()
  })
})

const it = testEffect(
  AppNodeBuilder.build(
    LayerNode.group([
      SessionNs.node,
      EventV2Bridge.node,
      SessionProjector.node,
      CrossSpawnSpawner.node,
      InstanceStore.node,
    ]),
    [
      [RuntimeFlags.node, RuntimeFlags.layer({ experimentalWorkspaces: false })],
      [
        InstanceBootstrap.node,
        Layer.succeed(InstanceBootstrap.Service, InstanceBootstrap.Service.of({ run: Effect.void })),
      ],
    ],
  ),
)

// The prune command selects stale sessions with listGlobal({ cursor }) and
// archives them with setArchived; archived sessions drop out of the next scan.
describe("session.prune", () => {
  it.instance("selects sessions older than the boundary and skips archived ones", () =>
    Effect.gen(function* () {
      const svc = yield* SessionNs.Service
      const session = yield* svc.create()

      const future = cutoff(1, Date.now() + 2 * day)!
      const past = cutoff(1, Date.now())!

      const stale = yield* svc.listGlobal({ roots: true, cursor: future })
      expect(stale.map((item) => item.id)).toContain(session.id)

      const fresh = yield* svc.listGlobal({ roots: true, cursor: past })
      expect(fresh.map((item) => item.id)).not.toContain(session.id)

      yield* svc.setArchived({ sessionID: session.id, time: Date.now() })
      const after = yield* svc.listGlobal({ roots: true, cursor: future })
      expect(after.map((item) => item.id)).not.toContain(session.id)

      const archived = yield* svc.get(session.id)
      expect(archived.time.archived).toBeDefined()
    }),
  )
})
