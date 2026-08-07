#!/usr/bin/env bun
// Generates docs/reference/ from the CLI's own --help output.
// Usage: bun script/docs-reference.ts [path-to-bolt-binary]
// Re-run after adding or changing commands, then commit the updated pages.
import { $ } from "bun"
import path from "path"
import { fileURLToPath } from "url"

const bin = process.argv[2] ?? "bolt"
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const outdir = path.join(root, "docs", "reference")

function clean(text: string) {
  return text.replace(/\u001b\[[0-9;]*m/g, "").trimEnd()
}

async function help(args: string[]) {
  const result = await $`${bin} ${args} --help`.nothrow().quiet()
  return clean(result.stdout.toString() + result.stderr.toString())
}

type Entry = { name: string[]; usage: string; description: string }

function commands(text: string, prefix: string[]): Entry[] {
  const section = text.split(/^Commands:$/m)[1]
  if (!section) return []
  const body = section.split(/^(?:Positionals|Options):$/m)[0]
  const entries: Entry[] = []
  for (const line of body.split("\n")) {
    const match = line.match(/^ {2}bolt ((?:[a-z][a-z0-9-]*)(?: [a-z][a-z0-9-]*)*)((?: [<[][^ ]+)*)\s{2,}(.*)$/)
    if (!match) {
      // continuation lines extend the previous description
      const cont = line.match(/^\s{20,}(\S.*)$/)
      if (cont && entries.length) entries[entries.length - 1].description += ` ${cont[1].trim()}`
      continue
    }
    const name = match[1].split(" ")
    if (prefix.length && prefix.join(" ") !== name.slice(0, prefix.length).join(" ")) continue
    if (name.length !== prefix.length + 1) continue
    entries.push({ name, usage: `bolt ${match[1]}${match[2]}`.trim(), description: match[3].trim() })
  }
  return entries
}

const rootHelp = await help([])
const top = commands(rootHelp, [])
const index: string[] = [
  "# Command reference",
  "",
  "One page per `bolt` command, generated from `--help` output by `script/docs-reference.ts`.",
  "Run `bolt` with no command (or a project path) to start the TUI.",
  "",
  "| Command | Description |",
  "|---|---|",
]

for (const entry of top) {
  const name = entry.name.join(" ")
  const file = `${entry.name.join("-")}.md`
  const page: string[] = [`# ${entry.usage}`, "", entry.description, "", "```", await help(entry.name), "```"]
  const subs = commands(page[5], entry.name)
  for (const sub of subs) {
    page.push("", `## ${sub.usage}`, "", sub.description, "", "```", await help(sub.name), "```")
  }
  await Bun.write(path.join(outdir, file), page.join("\n") + "\n")
  index.push(`| [\`${name}\`](./${file}) | ${entry.description} |`)
  console.log(`wrote ${file}${subs.length ? ` (+${subs.length} subcommands)` : ""}`)
}

await Bun.write(path.join(outdir, "README.md"), index.join("\n") + "\n")
console.log(`wrote README.md index with ${top.length} commands`)
