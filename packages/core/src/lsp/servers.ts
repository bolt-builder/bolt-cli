export * as LspServers from "./servers.js"

import { Effect } from "effect"
import path from "node:path"
import type { Entry } from "@opencode/schema/config"
import type { ConfigLSP } from "@opencode/schema/config/lsp"
import { Environment } from "../environment/index.js"

export type Server = {
  id: string
  command: string[]
  extensions: string[]
  env?: Record<string, string>
  initialization?: Record<string, unknown>
  markers?: string[]
  exclude?: string[]
  npm?: { package: string; bin: string }
  custom?: boolean
  strict?: boolean
  experimental?: "ty"
}

// Executables are resolved in the execution environment. Custom commands retain
// their declared argv/environment and can override every built-in entry.
export const builtins: Server[] = [
  {
    id: "deno",
    command: ["deno", "lsp"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs"],
    markers: ["deno.json", "deno.jsonc"],
    strict: true,
  },
  {
    id: "typescript",
    command: ["typescript-language-server", "--stdio"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts"],
    markers: ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
    exclude: ["deno.json", "deno.jsonc"],
    npm: {
      package: "typescript-language-server",
      bin: "typescript-language-server",
    },
  },
  {
    id: "vue",
    command: ["vue-language-server", "--stdio"],
    extensions: [".vue"],
    markers: ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
    npm: {
      package: "@vue/language-server",
      bin: "vue-language-server",
    },
  },
  {
    id: "eslint",
    command: ["vscode-eslint-language-server", "--stdio"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue"],
    markers: ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
  },
  {
    id: "oxlint",
    command: ["oxc_language_server"],
    extensions: [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".mts", ".cts", ".vue", ".astro", ".svelte"],
    markers: [
      ".oxlintrc.json",
      "package-lock.json",
      "bun.lockb",
      "bun.lock",
      "pnpm-lock.yaml",
      "yarn.lock",
      "package.json",
    ],
  },
  {
    id: "biome",
    command: ["biome", "lsp-proxy", "--stdio"],
    extensions: [
      ".ts",
      ".tsx",
      ".js",
      ".jsx",
      ".mjs",
      ".cjs",
      ".mts",
      ".cts",
      ".json",
      ".jsonc",
      ".vue",
      ".astro",
      ".svelte",
      ".css",
      ".graphql",
      ".gql",
      ".html",
    ],
    markers: ["biome.json", "biome.jsonc", "package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
  },
  {
    id: "gopls",
    command: ["gopls"],
    extensions: [".go"],
    markers: ["go.work", "go.mod"],
  },
  {
    id: "ruby-lsp",
    command: ["rubocop", "--lsp"],
    extensions: [".rb", ".rake", ".gemspec", ".ru"],
    markers: ["Gemfile"],
  },
  {
    id: "ty",
    command: ["ty", "server"],
    extensions: [".py", ".pyi"],
    markers: [
      "pyproject.toml",
      "ty.toml",
      "setup.py",
      "setup.cfg",
      "requirements.txt",
      "Pipfile",
      "pyrightconfig.json",
    ],
    experimental: "ty",
  },
  {
    id: "pyright",
    command: ["pyright-langserver", "--stdio"],
    extensions: [".py", ".pyi"],
    markers: ["pyproject.toml", "setup.py", "setup.cfg", "requirements.txt", "Pipfile", "pyrightconfig.json"],
    npm: {
      package: "pyright",
      bin: "pyright-langserver",
    },
  },
  {
    id: "elixir-ls",
    command: ["elixir-ls"],
    extensions: [".ex", ".exs"],
    markers: ["mix.exs", "mix.lock"],
  },
  {
    id: "zls",
    command: ["zls"],
    extensions: [".zig", ".zon"],
    markers: ["build.zig"],
  },
  {
    id: "csharp",
    command: ["roslyn-language-server", "--stdio", "--autoLoadProjects"],
    extensions: [".cs", ".csx"],
    markers: ["*.slnx", "*.sln", "*.csproj", "global.json"],
  },
  {
    id: "razor",
    command: ["roslyn-language-server", "--stdio", "--autoLoadProjects"],
    extensions: [".razor", ".cshtml"],
    markers: ["*.slnx", "*.sln", "*.csproj", "global.json"],
  },
  {
    id: "fsharp",
    command: ["fsautocomplete"],
    extensions: [".fs", ".fsi", ".fsx", ".fsscript"],
    markers: ["*.slnx", "*.sln", "*.fsproj", "global.json"],
  },
  {
    id: "sourcekit-lsp",
    command: ["sourcekit-lsp"],
    extensions: [".swift", ".objc", ".objcpp"],
    markers: ["Package.swift", "*.xcodeproj", "*.xcworkspace"],
  },
  {
    id: "rust",
    command: ["rust-analyzer"],
    extensions: [".rs"],
    markers: ["Cargo.toml"],
  },
  {
    id: "clangd",
    command: ["clangd", "--background-index", "--clang-tidy"],
    extensions: [".c", ".cpp", ".cc", ".cxx", ".c++", ".h", ".hpp", ".hh", ".hxx", ".h++"],
    markers: ["compile_commands.json", "compile_flags.txt", ".clangd"],
  },
  {
    id: "svelte",
    command: ["svelteserver", "--stdio"],
    extensions: [".svelte"],
    markers: ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
    npm: {
      package: "svelte-language-server",
      bin: "svelteserver",
    },
  },
  {
    id: "astro",
    command: ["astro-ls", "--stdio"],
    extensions: [".astro"],
    markers: ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
    npm: {
      package: "@astrojs/language-server",
      bin: "astro-ls",
    },
  },
  {
    id: "jdtls",
    command: ["jdtls"],
    extensions: [".java"],
    markers: [
      "settings.gradle",
      "settings.gradle.kts",
      "gradlew",
      "gradlew.bat",
      "build.gradle",
      "build.gradle.kts",
      "pom.xml",
      ".project",
      ".classpath",
    ],
    strict: true,
  },
  {
    id: "kotlin-ls",
    command: ["kotlin-lsp", "--stdio"],
    extensions: [".kt", ".kts"],
    markers: [
      "settings.gradle.kts",
      "settings.gradle",
      "gradlew",
      "gradlew.bat",
      "build.gradle.kts",
      "build.gradle",
      "pom.xml",
    ],
  },
  {
    id: "yaml-ls",
    command: ["yaml-language-server", "--stdio"],
    extensions: [".yaml", ".yml"],
    markers: ["package-lock.json", "bun.lockb", "bun.lock", "pnpm-lock.yaml", "yarn.lock"],
    npm: {
      package: "yaml-language-server",
      bin: "yaml-language-server",
    },
  },
  {
    id: "lua-ls",
    command: ["lua-language-server"],
    extensions: [".lua"],
    markers: [".luarc.json", ".luarc.jsonc", ".luacheckrc", ".stylua.toml", "stylua.toml", "selene.toml", "selene.yml"],
  },
  {
    id: "php intelephense",
    command: ["intelephense", "--stdio"],
    extensions: [".php"],
    markers: ["composer.json", "composer.lock", ".php-version"],
    npm: {
      package: "intelephense",
      bin: "intelephense",
    },
  },
  {
    id: "prisma",
    command: ["prisma", "language-server"],
    extensions: [".prisma"],
    markers: ["schema.prisma", "prisma/schema.prisma", "prisma"],
    exclude: ["package.json"],
  },
  {
    id: "dart",
    command: ["dart", "language-server", "--lsp"],
    extensions: [".dart"],
    markers: ["pubspec.yaml", "analysis_options.yaml"],
  },
  {
    id: "ocaml-lsp",
    command: ["ocamllsp"],
    extensions: [".ml", ".mli"],
    markers: ["dune-project", "dune-workspace", ".merlin", "opam"],
  },
  {
    id: "bash",
    command: ["bash-language-server", "start"],
    extensions: [".sh", ".bash", ".zsh", ".ksh"],
    npm: {
      package: "bash-language-server",
      bin: "bash-language-server",
    },
  },
  {
    id: "terraform",
    command: ["terraform-ls", "serve"],
    extensions: [".tf", ".tfvars"],
    markers: [".terraform.lock.hcl", "terraform.tfstate", "*.tf"],
  },
  {
    id: "texlab",
    command: ["texlab"],
    extensions: [".tex", ".bib"],
    markers: [".latexmkrc", "latexmkrc", ".texlabroot", "texlabroot"],
  },
  {
    id: "dockerfile",
    command: ["docker-langserver", "--stdio"],
    extensions: [".dockerfile", "Dockerfile"],
    npm: {
      package: "dockerfile-language-server-nodejs",
      bin: "docker-langserver",
    },
  },
  {
    id: "gleam",
    command: ["gleam", "lsp"],
    extensions: [".gleam"],
    markers: ["gleam.toml"],
  },
  {
    id: "clojure-lsp",
    command: ["clojure-lsp", "listen"],
    extensions: [".clj", ".cljs", ".cljc", ".edn"],
    markers: ["deps.edn", "project.clj", "shadow-cljs.edn", "bb.edn", "build.boot"],
  },
  {
    id: "nixd",
    command: ["nixd"],
    extensions: [".nix"],
    markers: ["flake.nix", "shell.nix", "default.nix"],
  },
  {
    id: "tinymist",
    command: ["tinymist"],
    extensions: [".typ", ".typc"],
    markers: ["typst.toml"],
  },
  {
    id: "haskell-language-server",
    command: ["haskell-language-server-wrapper", "--lsp"],
    extensions: [".hs", ".lhs"],
    markers: ["stack.yaml", "cabal.project", "hie.yaml", "*.cabal"],
  },
  {
    id: "julials",
    command: ["julia", "--startup-file=no", "--history-file=no", "-e", "using LanguageServer; runserver()"],
    extensions: [".jl"],
    markers: ["Project.toml", "Manifest.toml", "*.jl"],
  },
]

export function resolve(entries: readonly Entry[]) {
  let configured: typeof ConfigLSP.Info.Type = true
  for (const entry of entries) {
    if (entry.type !== "document" || entry.info.lsp === undefined) continue
    const value = entry.info.lsp
    configured =
      typeof value === "boolean" ? value : { ...(typeof configured === "object" ? configured : {}), ...value }
  }
  if (configured === false) return []
  const ty = ["true", "1"].includes(
    process.env.BOLT_EXPERIMENTAL_LSP_TY ?? process.env.OPENCODE_EXPERIMENTAL_LSP_TY ?? "",
  )
  const servers = new Map(
    builtins
      .filter((server) => (ty ? server.id !== "pyright" : !server.experimental))
      .map((server) => [server.id, server]),
  )
  if (configured !== true)
    for (const [id, value] of Object.entries(configured)) {
      if (value.disabled) {
        servers.delete(id)
        continue
      }
      const previous = servers.get(id)
      servers.set(id, {
        ...previous,
        id,
        custom: true,
        command: [...value.command],
        extensions: [...(value.extensions ?? previous?.extensions ?? [])],
        env: value.env,
        initialization: value.initialization,
        npm: undefined,
      })
    }
  return [...servers.values()]
}

const matches = (name: string, pattern: string) =>
  new RegExp(
    "^" +
      pattern
        .split("*")
        .map((part) =>
          [...part].map((character) => ("\\^$.*+?()[]{}|".includes(character) ? "\\" + character : character)).join(""),
        )
        .join(".*") +
      "$",
  ).test(name)
const present = Effect.fn("LspServers.present")(function* (
  files: Environment.Files,
  directory: string,
  markers: string[],
) {
  for (const marker of markers) {
    if (!marker.includes("*")) {
      if (yield* Environment.exists(files, path.join(directory, marker))) return true
      continue
    }
    if ((yield* files.list(directory)).some((entry) => matches(entry.name, marker))) return true
  }
  return false
})

export const root = Effect.fn("LspServers.root")(function* (
  files: Environment.Files,
  file: string,
  boundary: string,
  server: Server,
) {
  const relative = path.relative(boundary, file)
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) return undefined
  let directory = path.dirname(file)
  let nearest: string | undefined
  while (true) {
    if (server.exclude && (yield* present(files, directory, server.exclude))) return undefined
    if (!nearest && server.markers?.length && (yield* present(files, directory, server.markers))) nearest = directory
    if (directory === boundary || path.dirname(directory) === directory)
      return nearest ?? (server.strict ? undefined : boundary)
    directory = path.dirname(directory)
  }
})
