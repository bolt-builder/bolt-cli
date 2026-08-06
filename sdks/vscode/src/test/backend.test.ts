import * as assert from "node:assert"
import { Backend } from "../backend"

suite("backend", () => {
  test("a configured server url short-circuits spawning", async () => {
    const spawned: string[] = []
    const backend = new Backend({
      url: () => "http://127.0.0.1:4242",
      binary: async () => "/nowhere/bolt",
      spawn: (binary) => {
        spawned.push(binary)
        return { onLine: () => {}, onExit: () => {}, kill: () => {} }
      },
      log: () => {},
      onExit: () => {},
    })
    const connection = await backend.start()
    assert.strictEqual(connection?.url, "http://127.0.0.1:4242")
    assert.deepStrictEqual(spawned, [])
    backend.dispose()
  })

  test("an unresolved binary yields no connection", async () => {
    const backend = new Backend({
      url: () => "",
      binary: async () => undefined,
      spawn: () => {
        throw new Error("must not spawn")
      },
      log: () => {},
      onExit: () => {},
    })
    assert.strictEqual(await backend.start(), undefined)
    backend.dispose()
  })

  test("parses the listening address from server output", async () => {
    let emit: ((line: string) => void) | undefined
    const backend = new Backend({
      url: () => "",
      binary: async () => "/fake/bolt",
      spawn: () => ({
        onLine: (handler) => {
          emit = handler
        },
        onExit: () => {},
        kill: () => {},
      }),
      log: () => {},
      onExit: () => {},
    })
    const starting = backend.start("/tmp")
    // The line handler is registered after a few microtasks (binary
    // resolution is async); drain them until the fake child is wired up.
    for (let i = 0; i < 100 && !emit; i++) {
      await Promise.resolve()
    }
    assert.ok(emit, "spawner was not invoked")
    emit?.("some startup noise")
    emit?.("server listening on http://127.0.0.1:5150")
    const connection = await starting
    assert.strictEqual(connection?.url, "http://127.0.0.1:5150")
    backend.dispose()
  })
})
