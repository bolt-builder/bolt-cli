import * as assert from "node:assert"
import { chmod, mkdtemp, writeFile } from "node:fs/promises"
import { tmpdir } from "node:os"
import path from "node:path"
import { locate } from "../binary"

const windows = process.platform === "win32"

async function fake(name: string) {
  const dir = await mkdtemp(path.join(tmpdir(), "bolt-test-"))
  const file = path.join(dir, name)
  await writeFile(file, "#!/bin/sh\n")
  await chmod(file, 0o755)
  return { dir, file }
}

suite("binary", function () {
  test("finds the binary on PATH", async () => {
    if (windows) {
      return
    }
    const { dir, file } = await fake("bolt")
    assert.strictEqual(await locate("", dir), file)
  })

  test("searches PATH directories in order", async () => {
    if (windows) {
      return
    }
    const first = await fake("bolt")
    const second = await fake("bolt")
    assert.strictEqual(await locate("", [first.dir, second.dir].join(path.delimiter)), first.file)
  })

  test("explicit setting wins over PATH", async () => {
    if (windows) {
      return
    }
    const onPath = await fake("bolt")
    const explicit = await fake("bolt")
    assert.strictEqual(await locate(explicit.file, onPath.dir), explicit.file)
  })

  test("invalid explicit setting resolves to nothing", async () => {
    if (windows) {
      return
    }
    const { dir } = await fake("bolt")
    assert.strictEqual(await locate(path.join(dir, "missing"), dir), undefined)
  })

  test("missing binary resolves to nothing", async () => {
    const dir = await mkdtemp(path.join(tmpdir(), "bolt-empty-"))
    assert.strictEqual(await locate("", dir), undefined)
  })
})
