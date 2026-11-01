import { EOL } from "os"

/**
 * Version of the JSON envelope emitted by --json. Bump only on breaking
 * changes to the envelope shape; adding optional fields is not breaking.
 */
export const VERSION = 1

export const DESCRIBE = `emit a versioned JSON envelope on stdout: {"version":${VERSION},"ok":true,"result":...} on success, {"version":${VERSION},"ok":false,"error":{"name":...,"message":...}} on failure`

export function success(result: unknown) {
  return JSON.stringify({ version: VERSION, ok: true, result })
}

export function failure(name: string, message: string) {
  return JSON.stringify({ version: VERSION, ok: false, error: { name, message } })
}

export function print(result: unknown) {
  process.stdout.write(success(result) + EOL)
}

export function printError(name: string, message: string) {
  process.stdout.write(failure(name, message) + EOL)
}

export * as Envelope from "./envelope"
