import { expect, spyOn, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { TextareaRenderable } from "@opentui/core"
import { voice } from "../src/voice"
import { takeDraft } from "../src/component/prompt/draft-stash"
import { createAppFixture } from "./fixture/app"
import { directory, json } from "./fixture/tui-client"

test.skipIf(process.platform === "win32")(
  "a voice transcription never inserts into the prompt of a different route",
  async () => {
    takeDraft(undefined)
    const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-voice-route-"))
    const previousPath = process.env.PATH
    const ready = path.join(root, "ready")
    await Bun.write(
      path.join(root, "rec"),
      `#!${process.execPath}
const file = process.argv.find((arg) => arg.endsWith(".wav"))
await Bun.write(file, "fixture audio")
process.once("SIGINT", () => process.exit(0))
await Bun.write(${JSON.stringify(ready)}, "ready")
setInterval(() => {}, 1000)
`,
    )
    await fs.chmod(path.join(root, "rec"), 0o755)
    process.env.PATH = `${root}${path.delimiter}${previousPath ?? ""}`
    const originalWhich = Bun.which
    const recorder = spyOn(Bun, "which").mockImplementation((name, options) =>
      name === "rec" ? path.join(root, "rec") : originalWhich(name, options),
    )
    try {
      const requested = Promise.withResolvers<void>()
      const response = Promise.withResolvers<Response>()
      const session = {
        id: "ses_voice_old",
        title: "Original voice session",
        projectID: "project",
        location: { directory },
        cost: 0,
        tokens: { input: 0, output: 0, reasoning: 0, cache: { read: 0, write: 0 } },
        time: { created: 1, updated: 2 },
      }
      await using setup = await createAppFixture({
        args: { sessionID: session.id },
        config: { animations: false, keybinds: { "prompt.voice": "f6", "session.new": "f7" } },
        fetch: (url) => {
          if (url.pathname === `/api/session/${session.id}`) return json({ data: session })
          if (/^\/api\/session\/ses_voice_old\/(message|inbox|permission)$/.test(url.pathname))
            return json({ data: [], cursor: {} })
          if (url.pathname === "/api/rpc/bolt.voice/transcribe") {
            requested.resolve()
            return response.promise
          }
        },
      })
      await setup.ready
      await setup.waitForFrame((frame) => frame.includes("Original voice session"))
      setup.mockInput.pressKey("F6")
      await setup.waitForFrame((frame) => frame.includes("Recording"))
      const deadline = Date.now() + 5000
      while (!(await Bun.file(ready).exists())) {
        if (Date.now() >= deadline) throw new Error("recorder fixture did not start")
        await Bun.sleep(10)
      }
      setup.mockInput.pressKey("F6")
      await requested.promise
      setup.mockInput.pressKey("F7")
      await setup.waitForFrame((frame) => frame.includes("commands"))
      const editor = setup.renderer.currentFocusedEditor
      if (!(editor instanceof TextareaRenderable)) throw new Error("missing new route editor")
      await setup.mockInput.typeText("new route draft")
      response.resolve(json({ output: { text: "spoken words" } }))
      await setup.waitForFrame((frame) => frame.includes("prompt changed"))
      expect(editor.plainText).toBe("new route draft")
    } finally {
      await voice.reset()
      takeDraft(undefined)
      recorder.mockRestore()
      if (previousPath === undefined) delete process.env.PATH
      else process.env.PATH = previousPath
      await fs.rm(root, { recursive: true, force: true })
    }
  },
)
