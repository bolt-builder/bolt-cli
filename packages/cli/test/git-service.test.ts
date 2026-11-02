import { expect, test } from "bun:test"
import { Effect } from "effect"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Git } from "../src/services/git"

test("defaultBranch finds the local default branch even when a tag shares its name", async () => {
  const cwd = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-git-service-"))
  const git = async (...args: string[]) => {
    const child = Bun.spawn(["git", "-c", "commit.gpgsign=false", ...args], { cwd, stdout: "pipe", stderr: "pipe" })
    const stderr = await new Response(child.stderr).text()
    expect({ code: await child.exited, stderr }).toEqual({ code: 0, stderr: "" })
  }
  try {
    await git("init", "-q", "-b", "main")
    await git(
      "-c",
      "user.name=Test",
      "-c",
      "user.email=test@example.invalid",
      "commit",
      "-qm",
      "initial",
      "--allow-empty",
    )
    await git("tag", "main")
    const branch = await Effect.runPromise(
      Git.make.pipe(
        Effect.flatMap((service) => service.defaultBranch(cwd)),
        Effect.provide(LayerNode.compile(AppProcess.node)),
      ),
    )
    expect(branch).toBe("main")
  } finally {
    await fs.rm(cwd, { recursive: true, force: true })
  }
})
