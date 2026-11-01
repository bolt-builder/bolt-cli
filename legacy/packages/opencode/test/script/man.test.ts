import { describe, expect, test } from "bun:test"
import { commands, escape, page } from "../../script/man"

describe("escape", () => {
  test("doubles backslashes", () => {
    expect(escape("a\\b")).toBe("a\\\\b")
  })

  test("neutralizes roff control lines", () => {
    expect(escape(".SH fake")).toBe("\\&.SH fake")
    expect(escape("'quoted")).toBe("\\&'quoted")
  })

  test("keeps plain lines untouched", () => {
    expect(escape("  --model  model to use")).toBe("  --model  model to use")
  })
})

describe("page", () => {
  const help = "bolt run [message..]\n\nrun bolt with a message\n\nOptions:\n  --model  model to use"

  test("renders the roff skeleton", () => {
    const output = page("bolt-run", "1.0.0", "2026-08-07", help)
    expect(output).toContain('.TH "BOLT-RUN" "1" "2026-08-07" "bolt 1.0.0" "Bolt Manual"')
    expect(output).toContain("bolt-run \\- run bolt with a message")
    expect(output).toContain(".B bolt run [message..]")
    expect(output).toContain(".nf")
  })

  test("embeds the full help output in the description", () => {
    expect(page("bolt-run", "1.0.0", "2026-08-07", help)).toContain("  --model  model to use")
  })
})

describe("commands", () => {
  test("parses top-level command names from root help", () => {
    const help = [
      "Commands:",
      "  bolt run [message..]  run bolt with a message",
      "  bolt review           review code changes",
      "  bolt models [provider]  list all available models",
      "  bolt run [message..]  duplicate alias line",
    ].join("\n")
    expect(commands(help)).toEqual(["run", "review", "models"])
  })
})
