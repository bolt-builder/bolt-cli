import { FSUtil } from "@opencode/util/fs-util"
import { open } from "node:fs/promises"
import path from "node:path"

export type FilePart = { url: string; filename: string; mime: string }

const ATTACH_FILE_MAX_BYTES = 10 * 1024 * 1024

export async function prepareFile(
  input: string,
  directory: string,
  options: { compatibility?: "v1"; attached?: boolean } = {},
): Promise<FilePart> {
  const file = path.resolve(directory, input)
  const handle = await open(file, "r").catch(() => fail(`File not found: ${input}`))
  try {
    const stat = await handle.stat()
    if (options.compatibility === "v1" && options.attached && stat.isDirectory())
      fail(`Cannot attach local directory without a shared filesystem: ${input}`)
    if (!stat.isFile() || stat.size > ATTACH_FILE_MAX_BYTES)
      fail(`Cannot attach a directory, special file, or file larger than 10 MiB: ${input}`)
    const content = Buffer.alloc(Number(stat.size))
    let offset = 0
    while (offset < content.length) {
      const read = await handle.read(content, offset, content.length - offset, offset)
      if (read.bytesRead === 0) break
      offset += read.bytesRead
    }
    const bytes = content.subarray(0, offset)
    const detected = FSUtil.mimeType(file)
    const text = bytes.toString("utf8")
    const mime =
      detected.startsWith("image/") || detected === "application/pdf"
        ? detected
        : !isBinaryContent(bytes) && Buffer.from(text, "utf8").equals(bytes)
          ? "text/plain"
          : detected
    return {
      url: `data:${mime};base64,${bytes.toString("base64")}`,
      filename: path.basename(file),
      mime,
    }
  } finally {
    await handle.close()
  }
}

function isBinaryContent(bytes: Uint8Array) {
  if (bytes.length === 0) return false
  if (bytes.includes(0)) return true
  return bytes.reduce((count, byte) => count + Number(byte < 9 || (byte > 13 && byte < 32)), 0) / bytes.length > 0.3
}

function fail(message: string): never {
  throw new Error(message)
}
