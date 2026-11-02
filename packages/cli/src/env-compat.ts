// This module runs before CLI dependencies capture their startup environment.
// Existing V2 values always win, including an explicitly empty value.
const equivalents = [
  "CONFIG",
  "CONFIG_CONTENT",
  "CONFIG_DIR",
  "CLI_CONFIG_CONTENT",
  "CLIENT",
  "GIT_BASH_PATH",
  "DISABLE_AUTOUPDATE",
  "DISABLE_MODELS_FETCH",
  "DISABLE_FFF",
  "DISABLE_PROJECT_CONFIG",
  "MODELS_PATH",
  "MODELS_URL",
  "SHOW_TTFD",
  "PASSWORD",
  "SERVER_PASSWORD",
  "PRINT_LOGS",
  "LOG_LEVEL",
] as const

export function apply(environment: Record<string, string | undefined>) {
  for (const name of equivalents) {
    const value = environment[`BOLT_${name}`]
    if (value !== undefined) environment[`OPENCODE_${name}`] ??= value
  }
  if (environment.BOLT_EXPERIMENTAL_DISABLE_FILEWATCHER !== undefined)
    environment.OPENCODE_DISABLE_FILEWATCHER ??= environment.BOLT_EXPERIMENTAL_DISABLE_FILEWATCHER
  // An in-memory database has the same semantics in both versions. Disk histories
  // are imported by the Core migration rather than upgrading the original file.
  if (environment.BOLT_DB === ":memory:") environment.OPENCODE_DB ??= ":memory:"
}

apply(process.env)
