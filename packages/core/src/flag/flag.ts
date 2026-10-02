import { Config } from "effect"

export function truthy(key: string) {
  const value = process.env[key]?.toLowerCase()
  return value === "true" || value === "1"
}

const copy = process.env["BOLT_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"]
const fff = process.env["BOLT_DISABLE_FFF"]

function enabledByExperimental(key: string) {
  return process.env[key] === undefined ? truthy("BOLT_EXPERIMENTAL") : truthy(key)
}

export const Flag = {
  OTEL_EXPORTER_OTLP_ENDPOINT: process.env["OTEL_EXPORTER_OTLP_ENDPOINT"],
  OTEL_EXPORTER_OTLP_HEADERS: process.env["OTEL_EXPORTER_OTLP_HEADERS"],

  BOLT_AUTO_HEAP_SNAPSHOT: truthy("BOLT_AUTO_HEAP_SNAPSHOT"),
  BOLT_GIT_BASH_PATH: process.env["BOLT_GIT_BASH_PATH"],
  BOLT_CONFIG: process.env["BOLT_CONFIG"],
  BOLT_CONFIG_CONTENT: process.env["BOLT_CONFIG_CONTENT"],
  BOLT_DISABLE_AUTOUPDATE: truthy("BOLT_DISABLE_AUTOUPDATE"),
  BOLT_ALWAYS_NOTIFY_UPDATE: truthy("BOLT_ALWAYS_NOTIFY_UPDATE"),
  BOLT_DISABLE_PRUNE: truthy("BOLT_DISABLE_PRUNE"),
  BOLT_DISABLE_TERMINAL_TITLE: truthy("BOLT_DISABLE_TERMINAL_TITLE"),
  BOLT_SHOW_TTFD: truthy("BOLT_SHOW_TTFD"),
  BOLT_DISABLE_AUTOCOMPACT: truthy("BOLT_DISABLE_AUTOCOMPACT"),
  BOLT_DISABLE_MODELS_FETCH: truthy("BOLT_DISABLE_MODELS_FETCH"),
  BOLT_DISABLE_MOUSE: truthy("BOLT_DISABLE_MOUSE"),
  BOLT_FAKE_VCS: process.env["BOLT_FAKE_VCS"],
  BOLT_SERVER_PASSWORD: process.env["BOLT_SERVER_PASSWORD"],
  BOLT_SERVER_USERNAME: process.env["BOLT_SERVER_USERNAME"],
  BOLT_DISABLE_FFF: fff === undefined ? process.platform === "win32" : truthy("BOLT_DISABLE_FFF"),

  // Experimental
  BOLT_EXPERIMENTAL_FILEWATCHER: Config.boolean("BOLT_EXPERIMENTAL_FILEWATCHER").pipe(Config.withDefault(false)),
  BOLT_EXPERIMENTAL_DISABLE_FILEWATCHER: Config.boolean("BOLT_EXPERIMENTAL_DISABLE_FILEWATCHER").pipe(
    Config.withDefault(false),
  ),
  BOLT_EXPERIMENTAL_DISABLE_COPY_ON_SELECT:
    copy === undefined ? process.platform === "win32" : truthy("BOLT_EXPERIMENTAL_DISABLE_COPY_ON_SELECT"),
  BOLT_MODELS_URL: process.env["BOLT_MODELS_URL"],
  BOLT_MODELS_PATH: process.env["BOLT_MODELS_PATH"],
  BOLT_DB: process.env["BOLT_DB"],

  BOLT_WORKSPACE_ID: process.env["BOLT_WORKSPACE_ID"],
  BOLT_EXPERIMENTAL_WORKSPACES: enabledByExperimental("BOLT_EXPERIMENTAL_WORKSPACES"),

  // Evaluated at access time (not module load) because tests, the CLI, and
  // external tooling set these env vars at runtime.
  get BOLT_DISABLE_PROJECT_CONFIG() {
    return truthy("BOLT_DISABLE_PROJECT_CONFIG")
  },
  get BOLT_EXPERIMENTAL_REFERENCES() {
    return enabledByExperimental("BOLT_EXPERIMENTAL_REFERENCES")
  },
  get BOLT_TUI_CONFIG() {
    return process.env["BOLT_TUI_CONFIG"]
  },
  get BOLT_CONFIG_DIR() {
    return process.env["BOLT_CONFIG_DIR"]
  },
  get BOLT_PROFILE() {
    return process.env["BOLT_PROFILE"]
  },
  get BOLT_PURE() {
    return truthy("BOLT_PURE")
  },
  get BOLT_PERMISSION() {
    return process.env["BOLT_PERMISSION"]
  },
  get BOLT_PLUGIN_META_FILE() {
    return process.env["BOLT_PLUGIN_META_FILE"]
  },
  get BOLT_CLIENT() {
    return process.env["BOLT_CLIENT"] ?? "cli"
  },
}
