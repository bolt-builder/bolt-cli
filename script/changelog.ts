#!/usr/bin/env bun
import path from "path"
import { parseArgs } from "util"

import { $ } from "bun"

const root = path.resolve(import.meta.dir, "..")
const file = path.join(root, "UPCOMING_CHANGELOG.md")

const { values } = parseArgs({
  args: Bun.argv.slice(2),
  options: {
    from: { type: "string", short: "f" },
    to: { type: "string", short: "t", default: "HEAD" },
  },
})

const args = ["script/raw-changelog.ts", "--to", values.to!]
if (values.from) args.push("--from", values.from)

const raw = await $`bun ${args}`.cwd(root).nothrow().text()

// raw-changelog prefixes machine metadata; keep a human "changes since" line instead
const lines = raw.split("\n")
const since = lines.find((line) => line.startsWith("Last release: "))?.slice("Last release: ".length)
const body = lines
  .filter((line) => !line.startsWith("Last release: ") && !line.startsWith("Target ref: "))
  .join("\n")
  .trim()

const empty = !body || body === "No notable changes."
const notes = empty ? "No notable changes" : since ? `Changes since ${since}\n\n${body}` : body

await Bun.write(file, notes + "\n")

process.exit(0)
