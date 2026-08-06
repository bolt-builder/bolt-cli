import { describe, expect, test } from "bun:test"
import {
  deleteCell,
  editCell,
  insertCell,
  outputsLabel,
  parse,
  renderCells,
  serialize,
  sourceText,
  splitSource,
} from "../../src/tool/notebook"

// A small notebook carrying unknown fields at every level (top-level, metadata,
// cell, and output) plus cell ids, formatted with the tool's own on-disk
// convention so byte-stability can be asserted exactly.
const notebook = {
  cells: [
    {
      cell_type: "code",
      execution_count: 2,
      id: "aaa11111",
      metadata: { collapsed: false, custom_cell_flag: "keep-me" },
      outputs: [
        {
          name: "stdout",
          output_type: "stream",
          text: ["hello\n"],
          custom_output_key: 42,
        },
      ],
      source: ["import math\n", "print('hello')"],
      unknown_cell_field: { nested: true },
    },
    {
      cell_type: "markdown",
      id: "bbb22222",
      metadata: {},
      source: ["# Title\n", "Some text"],
    },
  ],
  metadata: {
    kernelspec: { display_name: "Python 3", language: "python", name: "python3" },
    unknown_metadata_field: [1, 2, 3],
  },
  nbformat: 4,
  nbformat_minor: 5,
  unknown_top_level_field: "preserved",
}
const fixture = JSON.stringify(notebook, null, 1) + "\n"

describe("notebook.parse/serialize", () => {
  test("round-trips byte-stable when nothing is edited", () => {
    expect(serialize(parse(fixture))).toBe(fixture)
  })

  test("rejects non-object documents and missing cells", () => {
    expect(() => parse("[]")).toThrow("notebook must be a JSON object")
    expect(() => parse("{}")).toThrow("no cells array")
  })
})

describe("notebook.source helpers", () => {
  test("joins array sources and passes through string sources", () => {
    expect(sourceText({ source: ["a\n", "b"] })).toBe("a\nb")
    expect(sourceText({ source: "plain" })).toBe("plain")
    expect(sourceText({})).toBe("")
  })

  test("splits text into lines that keep their newlines", () => {
    expect(splitSource("a\nb\n")).toEqual(["a\n", "b\n"])
    expect(splitSource("a\nb")).toEqual(["a\n", "b"])
    expect(splitSource("")).toEqual([])
  })
})

describe("notebook.editCell", () => {
  test("round-trips byte-stable apart from the intended edit", () => {
    const edited = editCell(parse(fixture), 0, "print('changed')")
    const expected = structuredClone(notebook)
    expected.cells[0].source = ["print('changed')"]
    expected.cells[0].outputs = []
    ;(expected.cells[0] as { execution_count: number | null }).execution_count = null
    expect(serialize(edited)).toBe(JSON.stringify(expected, null, 1) + "\n")
  })

  test("clears outputs and execution_count only when the source changed", () => {
    const unchanged = editCell(parse(fixture), 0, "import math\nprint('hello')")
    expect(serialize(unchanged)).toBe(fixture)
  })

  test("does not add outputs to markdown cells", () => {
    const edited = editCell(parse(fixture), 1, "# New title")
    expect(edited.cells[1].outputs).toBeUndefined()
    expect(edited.cells[1].source).toEqual(["# New title"])
    expect(edited.cells[1].id).toBe("bbb22222")
  })

  test("rejects out-of-range indices", () => {
    expect(() => editCell(parse(fixture), 2, "x")).toThrow("out of range")
  })
})

describe("notebook.insertCell", () => {
  test("inserts a code cell with outputs scaffolding and shifts later cells", () => {
    const inserted = insertCell(parse(fixture), 1, "code", "x = 1\n", "ccc33333")
    expect(inserted.cells).toHaveLength(3)
    expect(inserted.cells[1]).toEqual({
      cell_type: "code",
      id: "ccc33333",
      metadata: {},
      source: ["x = 1\n"],
      outputs: [],
      execution_count: null,
    })
    expect(inserted.cells[2].id).toBe("bbb22222")
  })

  test("inserts a markdown cell without outputs and appends at cells.length", () => {
    const inserted = insertCell(parse(fixture), 2, "markdown", "tail", "ddd44444")
    expect(inserted.cells[2]).toEqual({
      cell_type: "markdown",
      id: "ddd44444",
      metadata: {},
      source: ["tail"],
    })
  })

  test("generates a cell id when none is passed", () => {
    const inserted = insertCell(parse(fixture), 0, "code", "y = 2")
    expect(typeof inserted.cells[0].id).toBe("string")
    expect((inserted.cells[0].id as string).length).toBeGreaterThan(0)
  })

  test("rejects out-of-range indices", () => {
    expect(() => insertCell(parse(fixture), 3, "code", "x")).toThrow("out of range")
  })
})

describe("notebook.deleteCell", () => {
  test("removes exactly the indexed cell and preserves everything else", () => {
    const deleted = deleteCell(parse(fixture), 0)
    const expected = structuredClone(notebook) as { cells: unknown[] }
    expected.cells.splice(0, 1)
    expect(serialize(deleted as never)).toBe(JSON.stringify(expected, null, 1) + "\n")
  })

  test("rejects out-of-range indices", () => {
    expect(() => deleteCell(parse(fixture), 5)).toThrow("out of range")
  })
})

describe("notebook.read rendering", () => {
  test("labels outputs with count, types, and a preview", () => {
    expect(outputsLabel(parse(fixture).cells[0])).toBe("1 output (stream): hello")
    expect(outputsLabel(parse(fixture).cells[1])).toBe("")
  })

  test("renders cells with index, type, and source", () => {
    const rendered = renderCells(parse(fixture))
    expect(rendered).toContain("[0] code | 1 output (stream): hello")
    expect(rendered).toContain("  print('hello')")
    expect(rendered).toContain("[1] markdown")
    expect(rendered).toContain("  # Title")
  })
})
