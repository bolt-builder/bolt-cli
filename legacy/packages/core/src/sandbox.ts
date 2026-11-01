export * as Sandbox from "./sandbox"

import os from "os"
import { Effect, Schema } from "effect"

export class UnsupportedError extends Schema.TaggedErrorClass<UnsupportedError>()("SandboxUnsupportedError", {
  message: Schema.String,
}) {}

export type Wrapped = { exe: string; args: string[] }

/** True when the session opted into sandboxed execution via the `/sandbox` toggle. */
export function enabled(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.["sandbox"] === true
}

/** Directories a sandboxed command may write: the given roots plus temp and device locations. */
export function writable(dirs: string[]) {
  const set = new Set<string>()
  for (const dir of [...dirs, os.tmpdir(), "/tmp", "/private/tmp", "/var/folders", "/private/var/folders"]) {
    if (dir && dir !== "/") set.add(dir)
  }
  return [...set]
}

/** bwrap argv: read-only root with the writable roots (and /dev, /proc) re-bound on top. */
export function linux(input: { command: string; shell: string; writable: string[] }, exe: string): Wrapped {
  return {
    exe,
    args: [
      "--ro-bind",
      "/",
      "/",
      "--dev-bind",
      "/dev",
      "/dev",
      "--proc",
      "/proc",
      // No --unshare-pid: remounting procfs in a new PID namespace fails inside
      // containers (CI, devcontainers), and this sandbox only isolates the filesystem.
      ...input.writable.flatMap((dir) => ["--bind-try", dir, dir]),
      "--die-with-parent",
      "--",
      input.shell,
      "-c",
      input.command,
    ],
  }
}

function escape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll('"', '\\"')
}

/** Seatbelt profile: allow everything except file writes outside the writable roots. */
export function profile(writable: string[]) {
  const rules = [...writable, "/dev"].map((dir) => `  (subpath "${escape(dir)}")`).join("\n")
  return `(version 1)\n(allow default)\n(deny file-write*)\n(allow file-write*\n${rules}\n)`
}

/** sandbox-exec argv with an inline seatbelt profile. */
export function darwin(input: { command: string; shell: string; writable: string[] }, exe: string): Wrapped {
  return { exe, args: ["-p", profile(input.writable), input.shell, "-c", input.command] }
}

/** Wrap a shell command so it runs with a read-only filesystem outside the writable roots.
 * Fails closed: unsupported platforms and missing wrapper binaries refuse to run. */
export const wrap = Effect.fn("Sandbox.wrap")(function* (input: {
  command: string
  shell: string
  writable: string[]
}) {
  if (process.platform === "linux") {
    const exe = Bun.which("bwrap")
    if (!exe)
      return yield* new UnsupportedError({
        message:
          "Sandbox is enabled for this session but bubblewrap (bwrap) is not installed. Install it or disable the sandbox with /sandbox.",
      })
    return linux(input, exe)
  }
  if (process.platform === "darwin") {
    const exe = Bun.which("sandbox-exec")
    if (!exe)
      return yield* new UnsupportedError({
        message:
          "Sandbox is enabled for this session but sandbox-exec is not available. Disable the sandbox with /sandbox.",
      })
    return darwin(input, exe)
  }
  return yield* new UnsupportedError({
    message: `Sandbox is enabled for this session but sandboxed execution is not supported on ${process.platform}. Disable the sandbox with /sandbox.`,
  })
})
