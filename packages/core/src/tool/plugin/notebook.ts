export * as NotebookTool from "./notebook.js"

import type { Context } from "@opencode/plugin/effect/plugin"
import { ToolFailure } from "@opencode/ai/effect"
import { Effect, Schema } from "effect"
import path from "node:path"
import { Environment } from "../../environment/index.js"
import { FileAccess } from "../../file-access.js"
import { FileMutation } from "../../file-mutation.js"
import { Permission } from "../../permission.js"
import { fileDiff } from "./file-diff.js"
import DESCRIPTION from "./notebook.txt"

const MAX_SOURCE_LINES = 50
const MAX_OUTPUT_PREVIEW = 200

export type Cell = { [key: string]: unknown }
export type Notebook = { [key: string]: unknown; cells: Cell[] }

/**
 * Parse .ipynb JSON text. The result keeps every field of the original
 * document (nbformat, metadata, cell ids, unknown keys) because nothing is
 * projected into a narrower shape; manipulation functions only touch the
 * fields they must.
 */
export function parse(text: string): Notebook {
  const raw: unknown = JSON.parse(text)
  if (typeof raw !== "object" || raw === null || Array.isArray(raw)) {
    throw new Error("notebook must be a JSON object")
  }
  const nb = raw as { [key: string]: unknown }
  if (!Array.isArray(nb.cells)) throw new Error("notebook has no cells array")
  for (const cell of nb.cells) {
    if (typeof cell !== "object" || cell === null || Array.isArray(cell)) {
      throw new Error("notebook cells must be JSON objects")
    }
  }
  return nb as Notebook
}

/** Serialize with Jupyter's on-disk convention: indent 1 and a trailing newline. */
export function serialize(nb: Notebook): string {
  return `${JSON.stringify(nb, null, 1)}\n`
}

/** Join a cell's source (string or array-of-lines) into one string. */
export function sourceText(cell: Cell): string {
  if (typeof cell.source === "string") return cell.source
  if (Array.isArray(cell.source)) return cell.source.filter((line) => typeof line === "string").join("")
  return ""
}

/** Split source text into nbformat's array-of-lines shape, each line keeping its newline. */
export function splitSource(text: string): string[] {
  if (text === "") return []
  return text.split(/(?<=\n)/)
}

function requireCell(nb: Notebook, index: number): Cell {
  const cell = nb.cells[index]
  if (cell === undefined) {
    throw new Error(
      `cell index ${index} is out of range (notebook has ${nb.cells.length} cell${nb.cells.length === 1 ? "" : "s"})`,
    )
  }
  return cell
}

/**
 * Replace the source of the cell at index. Outputs and execution_count are
 * cleared only when the cell is a code cell and its source actually changed;
 * an identical source leaves the notebook byte-identical.
 */
export function editCell(nb: Notebook, index: number, source: string): Notebook {
  const existing = requireCell(nb, index)
  const out = structuredClone(nb)
  if (sourceText(existing) === source) return out
  const cell = out.cells[index]
  cell.source = splitSource(source)
  if (cell.cell_type === "code") {
    cell.outputs = []
    cell.execution_count = null
  }
  return out
}

/**
 * Insert a new cell at index (existing cells shift down; index === cells.length
 * appends). A cell id is generated unless one is passed, matching nbformat 4.5+.
 */
export function insertCell(
  nb: Notebook,
  index: number,
  type: "code" | "markdown",
  source: string,
  id?: string,
): Notebook {
  if (index < 0 || index > nb.cells.length) {
    throw new Error(
      `insert index ${index} is out of range (notebook has ${nb.cells.length} cells; valid indices are 0 to ${nb.cells.length})`,
    )
  }
  const out = structuredClone(nb)
  const cell: Cell = {
    cell_type: type,
    id: id ?? Math.random().toString(36).slice(2, 10),
    metadata: {},
    source: splitSource(source),
    ...(type === "code" ? { outputs: [], execution_count: null } : {}),
  }
  out.cells.splice(index, 0, cell)
  return out
}

/** Remove the cell at index. */
export function deleteCell(nb: Notebook, index: number): Notebook {
  requireCell(nb, index)
  const out = structuredClone(nb)
  out.cells.splice(index, 1)
  return out
}

/** One-line summary of a code cell's outputs, with a capped text preview. */
export function outputsLabel(cell: Cell): string {
  if (cell.cell_type !== "code") return ""
  const outputs = Array.isArray(cell.outputs) ? cell.outputs : []
  if (outputs.length === 0) return "no outputs"
  const types = outputs
    .map((output) =>
      typeof output === "object" && output !== null ? String((output as Cell).output_type ?? "unknown") : "unknown",
    )
    .join(", ")
  const first = outputs[0]
  const text = typeof first === "object" && first !== null ? previewText(first as Cell) : ""
  const preview = text.length > MAX_OUTPUT_PREVIEW ? `${text.slice(0, MAX_OUTPUT_PREVIEW)}...` : text
  const label = `${outputs.length} output${outputs.length === 1 ? "" : "s"} (${types})`
  return preview ? `${label}: ${preview.trimEnd()}` : label
}

function previewText(output: Cell): string {
  if (typeof output.text === "string") return output.text
  if (Array.isArray(output.text)) return output.text.join("")
  if (typeof output.data === "object" && output.data !== null) {
    const plain = (output.data as Cell)["text/plain"]
    if (typeof plain === "string") return plain
    if (Array.isArray(plain)) return plain.join("")
  }
  if (typeof output.ename === "string")
    return `${output.ename}: ${typeof output.evalue === "string" ? output.evalue : ""}`
  return ""
}

/** Render every cell with its index, type, source, and outputs summary. */
export function renderCells(nb: Notebook): string {
  if (nb.cells.length === 0) return "notebook has no cells"
  return nb.cells
    .map((cell, index) => {
      const type = typeof cell.cell_type === "string" ? cell.cell_type : "unknown"
      const outputs = outputsLabel(cell)
      const header = `[${index}] ${type}${outputs ? ` | ${outputs}` : ""}`
      const lines = sourceText(cell).split("\n")
      const shown = lines.slice(0, MAX_SOURCE_LINES)
      const body = shown.map((line) => `  ${line}`).join("\n")
      const more = lines.length > MAX_SOURCE_LINES ? `\n  ... (${lines.length - MAX_SOURCE_LINES} more lines)` : ""
      return `${header}\n${body}${more}`
    })
    .join("\n\n")
}

export const Input = Schema.Struct({
  filePath: Schema.String,
  action: Schema.Literals(["read", "edit", "insert", "delete"]),
  index: Schema.optional(Schema.Int.check(Schema.isGreaterThanOrEqualTo(0))),
  source: Schema.optional(Schema.String),
  cellType: Schema.optional(Schema.Literals(["code", "markdown"])),
})
export const Output = Schema.Struct({
  action: Schema.String,
  file: Schema.String,
  cells: Schema.Int,
  text: Schema.String,
})

export const Plugin = {
  id: "bolt.tool.notebook",
  effect: Effect.fn("NotebookTool.Plugin")(function* (ctx: Context) {
    const access = yield* FileAccess.Service
    const environment = yield* Environment.Service
    const mutation = yield* FileMutation.Service
    const permission = yield* Permission.Service
    yield* ctx.tool.transform((editor) =>
      editor.add({
        name: "notebook",
        options: { codemode: false },
        description: DESCRIPTION,
        input: Input,
        output: Output,
        execute: (input, context) =>
          Effect.gen(function* () {
            if (!input.filePath.endsWith(".ipynb"))
              return yield* Effect.fail(
                new Error("the notebook tool only works with .ipynb files; use read/edit/write for other files"),
              )
            const target = yield* access.authorizeRead(input.filePath, context)
            return yield* mutation.withLock([target.absolute])(
              Effect.gen(function* () {
                const original = yield* FileMutation.readText(environment.files, target.absolute)
                const notebook = yield* Effect.try({ try: () => parse(original.text), catch: (error) => error })
                if (input.action === "read")
                  return {
                    action: input.action,
                    file: target.resource,
                    cells: notebook.cells.length,
                    text: renderCells(notebook),
                  }
                if (input.index === undefined)
                  return yield* Effect.fail(new Error(`${input.action} requires the index parameter`))
                const next = yield* Effect.try({
                  try: () => {
                    if (input.action === "delete") return deleteCell(notebook, input.index!)
                    if (input.source === undefined) throw new Error(`${input.action} requires the source parameter`)
                    if (input.action === "edit") return editCell(notebook, input.index!, input.source)
                    if (!input.cellType) throw new Error("insert requires the cellType parameter")
                    return insertCell(notebook, input.index!, input.cellType, input.source)
                  },
                  catch: (error) => error,
                })
                const content = serialize(next)
                yield* permission.assert({
                  action: "edit",
                  resources: [target.resource],
                  save: ["*"],
                  metadata: { files: [fileDiff(target.resource, original.text, content, "modified")] },
                  sessionID: context.sessionID,
                  agent: context.agent,
                  source: { type: "tool", messageID: context.messageID, id: context.id },
                })
                // Preserve the original bytes (including formatting and outputs) on a no-op edit.
                if (sourceText(notebook.cells[input.index] ?? {}) !== input.source || input.action !== "edit")
                  yield* mutation.writeTextPreservingBom({ target, content })
                return {
                  action: input.action,
                  file: target.resource,
                  cells: next.cells.length,
                  text: `${input.action === "edit" ? "Edited" : input.action === "insert" ? "Inserted" : "Deleted"} cell ${input.index} in ${path.basename(target.resource)}. Notebook now has ${next.cells.length} cell${next.cells.length === 1 ? "" : "s"}.`,
                }
              }),
            )
          }).pipe(
            Effect.map((output) => ({ output, content: output.text })),
            Effect.mapError(
              (error) => new ToolFailure({ message: `Unable to ${input.action} notebook ${input.filePath}`, error }),
            ),
          ),
      }),
    )
  }),
}
