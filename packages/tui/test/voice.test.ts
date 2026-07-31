import { describe, expect, test } from "bun:test"
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
