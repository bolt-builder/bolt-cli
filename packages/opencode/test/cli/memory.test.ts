import { describe, expect, test } from "bun:test"
import { dossier } from "../../src/cli/cmd/memory"

describe("dossier", () => {
  test("renders entries with provenance and update dates", () => {
    const text = dossier({
      entries: [
        {
          file: "project.md",
          section: "Conventions",
          key: "commit_style",
          text: "Use conventional commit subjects.",
          updatedAt: Date.UTC(2026, 7, 1),
        },
      ],
      sessions: [],
    })
    expect(text).toBe(
      "## Memory entries\n- [project.md > Conventions > commit_style] (updated 2026-08-01) Use conventional commit subjects.",
    )
  })

  test("renders session digests with topic and learn time", () => {
    const text = dossier({
      entries: [],
      sessions: [
        { id: "ses_1", time: "2026-08-02T10-00-00", topic: "refactor", summary: "Moved retry logic." },
        { id: "ses_2", time: "2026-08-03T11-00-00", summary: "Fixed scroll state." },
      ],
    })
    expect(text).toBe(
      [
        "## Session digests",
        "- [session ses_1 > refactor] learned 2026-08-02T10-00-00: Moved retry logic.",
        "- [session ses_2] learned 2026-08-03T11-00-00: Fixed scroll state.",
      ].join("\n"),
    )
  })

  test("separates entry and digest blocks", () => {
    const text = dossier({
      entries: [{ file: "environment.md", section: "Env", key: "runtime", text: "Bun only." }],
      sessions: [{ id: "ses_3", time: "2026-08-04", summary: "Learned runtime." }],
    })
    expect(text.split("\n\n")).toHaveLength(2)
  })

  test("omits the date suffix when the timestamp is missing or zero", () => {
    const text = dossier({
      entries: [{ file: "project.md", section: "S", key: "k", text: "t", updatedAt: 0 }],
      sessions: [],
    })
    expect(text).toBe("## Memory entries\n- [project.md > S > k] t")
  })

  test("returns an empty string when memory is empty", () => {
    expect(dossier({ entries: [], sessions: [] })).toBe("")
  })
})
