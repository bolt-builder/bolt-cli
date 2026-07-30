/**
 * The `/memory` (alias `/mem`) prompt command.
 *
 * Parses the typed command with the memory package's shared parser, runs the
 * matching server memory endpoint, and reports results as toasts. Help, show,
 * and status render dialogs supplied by the caller so this module stays free
 * of UI imports.
 */

import { MEMORY_USAGE, parseMemoryCommand, type ParsedMemoryCommand } from "@opencode-ai/memory/commands"
import type { OpencodeClient } from "@opencode-ai/sdk/v2"
import { errorMessage } from "./error"

export { MEMORY_USAGE }
export type MemoryCommand = ParsedMemoryCommand

type Toast = {
  show(input: { message: string; variant: "error" | "info" | "success"; duration?: number }): void
}

type Result<T> = {
  data?: T
  error?: unknown
}

function read<T>(result: Result<T>) {
  if (result.error) throw new Error(errorMessage(result.error))
  if (result.data === undefined) throw new Error("Memory command returned no data")
  return result.data
}

function tokens(count: number) {
  return `${count.toLocaleString()} memory ${count === 1 ? "token" : "tokens"}`
}

function changes(count: number) {
  return `${count} ${count === 1 ? "change" : "changes"}`
}

export async function runMemoryCommand(input: {
  text: string
  client: OpencodeClient
  sessionID?: string
  toast: Toast
  inspect?(root: string): void | Promise<void>
  show(): void
  status(): void
  usage(message?: string): void
}) {
  const parsed = parseMemoryCommand(input.text)
  if (!parsed) return false

  try {
    if (parsed.kind === "help") {
      input.usage()
      return true
    }
    if (parsed.kind === "show") {
      input.show()
      return true
    }
    if (parsed.kind === "usage") {
      input.usage(parsed.reason)
      return true
    }
    if (parsed.operation === "enable") {
      read(await input.client.memory.enable())
      input.toast.show({ variant: "success", message: "Memory enabled" })
      return true
    }
    if (parsed.operation === "status") {
      input.status()
      return true
    }
    if (parsed.operation === "inspect") {
      const status = read(await input.client.memory.status())
      if (!status.state.enabled) throw new Error("Memory is disabled. Run /memory on first.")
      if (!input.inspect) throw new Error("Memory folder inspection is unavailable")
      input.toast.show({ variant: "info", message: `Memory folder: ${status.root}` })
      await input.inspect(status.root)
      return true
    }
    if (parsed.operation === "auto") {
      const result = read(await input.client.memory.configure({ autoConsolidate: parsed.mode === "on" }))
      input.toast.show({
        variant: "info",
        message: `Memory auto-save ${result.state.autoConsolidate ? "on" : "off"}`,
      })
      return true
    }
    if (parsed.operation === "disable") {
      read(await input.client.memory.disable())
      input.toast.show({ variant: "info", message: "Memory disabled" })
      return true
    }
    if (parsed.operation === "rebuild") {
      const result = read(await input.client.memory.rebuild())
      input.toast.show({ variant: "success", message: `Memory rebuilt (${tokens(result.index.tokens)})` })
      return true
    }
    if (parsed.operation === "purge") {
      read(await input.client.memory.purge({ confirm: true }))
      input.toast.show({ variant: "success", message: "Memory purged" })
      return true
    }
    if (parsed.operation === "remember") {
      const result = read(
        await input.client.memory.remember({
          ...(input.sessionID ? { sessionID: input.sessionID } : {}),
          text: parsed.text,
        }),
      )
      input.toast.show({ variant: "success", message: `Memory saved · ${changes(result.operationCount)}` })
      return true
    }
    if (parsed.operation === "correct") {
      const result = read(
        await input.client.memory.correct({
          ...(input.sessionID ? { sessionID: input.sessionID } : {}),
          text: parsed.text,
        }),
      )
      input.toast.show({ variant: "success", message: `Correction saved · ${changes(result.operationCount)}` })
      return true
    }
    if (parsed.operation === "forget") {
      const result = read(
        await input.client.memory.forget({
          ...(input.sessionID ? { sessionID: input.sessionID } : {}),
          query: parsed.query,
        }),
      )
      input.toast.show({ variant: "success", message: `Memory updated · ${result.removed.toLocaleString()} removed` })
    }
    return true
  } catch (error) {
    input.toast.show({ variant: "error", message: `Memory command failed: ${errorMessage(error)}`, duration: 5000 })
    return true
  }
}
