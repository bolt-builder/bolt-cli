#!/usr/bin/env bun

import { $ } from "bun"
import { rm } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"

process.chdir(fileURLToPath(new URL("..", import.meta.url)))
await rm("dist", { recursive: true, force: true })
await $`bun tsc -p tsconfig.build.json`

// Bundle relative imports and text prompts so the published package also loads under Node and workerd.
const root = path.resolve("src")
const entrypoints = await Array.fromAsync(new Bun.Glob("**/*.ts").scan({ cwd: root, absolute: true }))
const result = await Bun.build({
  entrypoints: entrypoints.filter((file) => !file.endsWith(".d.ts")),
  root,
  outdir: "dist",
  target: "node",
  format: "esm",
  packages: "external",
  splitting: true,
  loader: { ".txt": "text" },
  naming: { entry: "[dir]/[name].[ext]", chunk: "chunks/[name]-[hash].[ext]" },
})
if (!result.success) throw new AggregateError(result.logs, "Failed to build Bolt memory")
