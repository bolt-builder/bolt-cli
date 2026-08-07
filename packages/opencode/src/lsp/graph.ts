import * as path from "path"
import { fileURLToPath, pathToFileURL } from "url"
import { Effect } from "effect"
import { FSUtil } from "@opencode-ai/core/fs-util"
import { LSP } from "./lsp"

export const SYMBOLS = 8
export const FILES = 4

export interface Node {
  name: string
  refs: { file: string; count: number }[]
}

// Render a compact cross-file symbol graph. Symbols without external
// references are dropped; an empty graph renders as an empty string so
// callers can skip injection entirely.
export function format(input: { file: string; nodes: Node[] }) {
  const nodes = input.nodes.filter((node) => node.refs.length)
  if (!nodes.length) return ""
  const lines = nodes.map((node) => {
    const refs = node.refs.map((ref) => `${ref.file} (${ref.count})`).join(", ")
    return `${node.name} <- ${refs}`
  })
  return [`<symbol-graph file="${input.file}">`, ...lines, "</symbol-graph>"].join("\n")
}

// Build the symbol graph for a file: top-level document symbols, each with
// the external files that reference it. Best effort by construction; LSP
// failures surface as empty results, never as errors.
export const build = Effect.fnUntraced(function* (input: { lsp: LSP.Interface; file: string; root: string }) {
  const symbols = yield* input.lsp.documentSymbol(pathToFileURL(input.file).href)
  const own = FSUtil.normalizePath(input.file)
  const nodes: Node[] = []
  for (const symbol of symbols.slice(0, SYMBOLS)) {
    const range = "selectionRange" in symbol ? symbol.selectionRange : symbol.location.range
    const refs = yield* input.lsp.references({
      file: input.file,
      line: range.start.line,
      character: range.start.character,
    })
    const counts = new Map<string, number>()
    for (const ref of refs) {
      const uri = ref?.uri
      if (typeof uri !== "string" || !uri.startsWith("file://")) continue
      const file = fileURLToPath(uri)
      if (FSUtil.normalizePath(file) === own) continue
      const rel = path.relative(input.root, file)
      counts.set(rel, (counts.get(rel) ?? 0) + 1)
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, FILES)
    nodes.push({ name: symbol.name, refs: sorted.map((entry) => ({ file: entry[0], count: entry[1] })) })
  }
  return format({ file: path.relative(input.root, input.file), nodes })
})

export * as LspGraph from "./graph"
