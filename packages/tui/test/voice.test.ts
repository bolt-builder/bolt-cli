import { describe, expect, test } from "bun:test"
import fs from "node:fs/promises"
import os from "node:os"
import path from "node:path"
import { measure } from "../src/voice"

function wav(input: { rate?: number; channels?: number; bits?: number; samples: Int16Array }) {
  const rate = input.rate ?? 16000
  const channels = input.channels ?? 1
  const bits = input.bits ?? 16
  const data = input.samples.byteLength
  const buffer = new ArrayBuffer(44 + data)
  const view = new DataView(buffer)
  view.setUint32(0, 0x52494646, false)
  view.setUint32(4, 36 + data, true)
  view.setUint32(8, 0x57415645, false)
  view.setUint32(12, 0x666d7420, false)
  view.setUint32(16, 16, true)
  view.setUint16(20, 1, true)
  view.setUint16(22, channels, true)
  view.setUint32(24, rate, true)
  view.setUint32(28, (rate * channels * bits) / 8, true)
  view.setUint16(32, (channels * bits) / 8, true)
  view.setUint16(34, bits, true)
  view.setUint32(36, 0x64617461, false)
  view.setUint32(40, data, true)
  new Int16Array(buffer, 44, input.samples.length).set(input.samples)
  return buffer
}

describe("voice measure", () => {
  test("reports duration and peak for 16-bit mono wav", () => {
    const samples = new Int16Array(16000)
    samples[8000] = 16384
    const result = measure(wav({ samples }))
    expect(result?.duration).toBeCloseTo(1)
    expect(result?.peak).toBeCloseTo(0.5)
  })

  test("detects silent audio", () => {
    const result = measure(wav({ samples: new Int16Array(16000) }))
    expect(result?.peak).toBe(0)
  })

  test("fails open on non-wav bytes", () => {
    expect(measure(new TextEncoder().encode("not a wav").buffer as ArrayBuffer)).toBeUndefined()
  })

  test("fails open on unsupported bit depth", () => {
    expect(measure(wav({ bits: 8, samples: new Int16Array(100) }))).toBeUndefined()
  })

  test("accounts for channel count in duration", () => {
    const result = measure(wav({ channels: 2, samples: new Int16Array(32000) }))
    expect(result?.duration).toBeCloseTo(1)
  })
})

// These fixtures are POSIX executables; they exercise the real recorder process without a microphone.
test.skipIf(process.platform === "win32")("recorder failure and reset remove takes and terminate capture", async () => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), "bolt-voice-lifecycle-"))
  const module = path.resolve(import.meta.dir, "../src/voice.ts")
  try {
    await fs.mkdir(path.join(root, "audio"))
    await Bun.write(
      path.join(root, "rec"),
      `#!${process.execPath}
      const file = process.argv.find((arg) => arg.endsWith(".wav"))
      await Bun.write(file, "unfinished recording")
      await Bun.write(process.env.READY_FILE, String(process.pid))
      if (process.env.RECORDER_FAIL === "1") process.exit(1)
      process.once("SIGINT", () => process.exit(0))
      setInterval(() => {}, 1000)
    `,
    )
    await fs.chmod(path.join(root, "rec"), 0o755)
    for (const fail of ["1", "0"]) {
      const ready = path.join(root, "ready")
      await fs.rm(ready, { force: true })
      const child = Bun.spawn(
        [
          process.execPath,
          "--eval",
          `
        import { voice } from ${JSON.stringify(module)}
        const error = voice.start()
        if (error) throw new Error(error)
        const deadline = Date.now() + 10000
        while (!await Bun.file(process.env.READY_FILE).exists()) {
          if (Date.now() > deadline) throw new Error("Recorder never started")
          await Bun.sleep(1)
        }
        if (process.env.RECORDER_FAIL === "0") await voice.reset()
        while (voice.status() !== "idle") {
          if (Date.now() > deadline) throw new Error("Recorder never stopped")
          await Bun.sleep(1)
        }
        console.log(voice.status())
      `,
        ],
        {
          cwd: root,
          env: { ...process.env, PATH: root, TMPDIR: path.join(root, "audio"), READY_FILE: ready, RECORDER_FAIL: fail },
          stdout: "pipe",
          stderr: "pipe",
        },
      )
      const [code, stdout, stderr] = await Promise.all([
        child.exited,
        new Response(child.stdout).text(),
        new Response(child.stderr).text(),
      ])
      expect({ code, stdout, stderr }).toEqual({ code: 0, stdout: "idle\n", stderr: "" })
      expect(await fs.readdir(path.join(root, "audio"))).toEqual([])
      const pid = Number(await Bun.file(ready).text())
      expect(() => process.kill(pid, 0)).toThrow()
    }
  } finally {
    await fs.rm(root, { recursive: true, force: true })
  }
})

test("malformed fmt chunks do not throw during audio analysis", () => {
  const bytes = wav({ samples: new Int16Array(0) })
  const view = new DataView(bytes)
  view.setUint32(12, 0x64617461, false)
  view.setUint32(16, 8, true)
  view.setUint32(28, 0x666d7420, false)
  view.setUint32(32, 16, true)
  expect(measure(bytes)).toBeUndefined()
})
