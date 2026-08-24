import path from "node:path"
import type { CliCommand, Hooks } from "@opencode-ai/plugin"

// Plugin-defined top-level subcommands: `bolt <name> [args...]` dispatches to
// a plugin's `cli` hook registration when <name> is not a builtin command and
// not an existing local path (`bolt <dir>` keeps opening the TUI there).
// Dispatch runs before yargs parses, so plugins extend the CLI without
// touching the builtin command table. Keep top-level imports type-only or
// trivial: this module loads on every CLI startup.

type Module = {
  command?: string | readonly string[]
  aliases?: string | readonly string[]
}

/** Collect the first words and aliases of the builtin command modules. */
export function known(commands: Module[]): Set<string> {
  const names = commands
    .flatMap((command) => [command.command, command.aliases].flat())
    .filter((value): value is string => typeof value === "string")
    .map((value) => value.split(" ")[0])
    .filter((name) => name !== "$0")
  return new Set(names)
}

/** The dispatch candidate: the first argv token when it is not a flag or builtin. */
export function candidate(argv: string[], builtin: Set<string>): string | undefined {
  const name = argv[0]
  if (!name || name.startsWith("-")) return undefined
  if (builtin.has(name)) return undefined
  return name
}

/** Find the first plugin registration for a command name. */
export function match(hooks: Hooks[], name: string): CliCommand | undefined {
  return hooks.map((hook) => hook.cli?.[name]).find((command) => command !== undefined)
}

/**
 * Load plugins for the current directory and run a matching registration.
 * Returns false when nothing claims the command, so the caller can fall
 * through to the normal yargs behavior (TUI with a project path).
 */
export async function dispatch(input: { name: string; args: string[]; directory: string }): Promise<boolean> {
  const { Filesystem } = await import("@/util/filesystem")
  if (await Filesystem.exists(path.resolve(input.directory, input.name))) return false
  const { Effect } = await import("effect")
  const { AppRuntime } = await import("@/effect/app-runtime")
  const { InstanceStore } = await import("@/project/instance-store")
  const { InstanceRef } = await import("@/effect/instance-ref")
  const { Plugin } = await import("@/plugin")
  const loaded = await AppRuntime.runPromise(
    InstanceStore.Service.use((store) =>
      store.load({ directory: input.directory }).pipe(Effect.map((ctx) => ({ store, ctx }))),
    ),
  )
  try {
    const hooks = await AppRuntime.runPromise(
      Plugin.Service.use((plugin) => plugin.list()).pipe(Effect.provideService(InstanceRef, loaded.ctx)),
    )
    const command = match(hooks, input.name)
    if (!command) return false
    await command.run({ args: input.args, directory: input.directory })
    return true
  } finally {
    await AppRuntime.runPromise(loaded.store.dispose(loaded.ctx))
  }
}

export * as PluginCli from "./cli"
