import { Memory } from "@bolt-ai/memory/memory"
import { MemoryFiles } from "@bolt-ai/memory/store"
import { MemoryTeam } from "@bolt-ai/memory/team"
import { MemoryPaths } from "@bolt-ai/memory/paths"
import { MemoryToolchain } from "@bolt-ai/memory/toolchain"
import { MemorySearch } from "@bolt-ai/memory/search"
import { dossier } from "@bolt-ai/memory/dossier"
import type { BoltMemory } from "@opencode/schema/bolt-memory"

/** Keep memory files on the server that owns the project, including remote CLI clients. */
export async function manage(
  input: typeof BoltMemory.Management.Type,
  target: { root: string; worktree: string },
): Promise<typeof BoltMemory.ManagementResult.Type> {
  const root = target.root
  switch (input.action) {
    case "learn": {
      const status = await Memory.status({ root })
      if (!status.state.enabled)
        await Memory.enable({
          root,
          id: MemoryPaths.identity({ ctx: { directory: target.worktree, worktree: target.worktree } }),
        })
      const learned = await MemoryToolchain.learn(target)
      return {
        root,
        count: learned.applied,
        text: learned.entries.length
          ? `Auto-learned ${learned.entries.length} toolchain command${learned.entries.length === 1 ? "" : "s"}: ${learned.entries.map((item) => item.command).join(", ")}`
          : "No toolchain commands detected in repository manifests.",
      }
    }
    case "export": {
      const dumped = await Memory.dump({ root })
      if (!dumped.count) throw new Error("No project memory stored for this project yet.")
      return dumped
    }
    case "import": {
      const loaded = await Memory.load({ root, text: input.text })
      if (!loaded.ops) throw new Error("No memory entries found in that file.")
      return {
        root,
        text: [
          `Imported ${loaded.applied} of ${loaded.ops} memory entries (${loaded.added} added).`,
          ...loaded.skipped.map((name) => `Skipped unknown memory file: ${name}`),
        ].join("\n"),
      }
    }
    case "team": {
      if (input.operation === "init") {
        const output = await MemoryTeam.init(target.worktree)
        return {
          root,
          text: output.created
            ? `Created ${output.file}. Commit it to share project memory with your team.`
            : `Team memory already exists at ${output.file}.`,
        }
      }
      if (!input.query) throw new Error("Pass the key or id of the fact to share.")
      const inventory = await MemoryFiles.deriveInventory(root)
      const matched = MemoryTeam.match({
        items: Object.entries(inventory.items).map(([id, item]) => ({ id, ...item })),
        query: input.query,
      })
      if (!matched.length) throw new Error(`No stored fact matches "${input.query}".`)
      const shared = await MemoryTeam.share(target.worktree, matched)
      return {
        root,
        text: `Shared ${shared.count} fact${shared.count === 1 ? "" : "s"} into ${shared.file}.\nCommit the file so teammates pick it up in recall.`,
      }
    }
    case "diff": {
      if (input.apply && input.discard) throw new Error("Pass only one of --apply or --discard.")
      const output = await Memory.pending({ root })
      if (!output.items.length)
        return {
          root,
          text: output.review
            ? "No staged memory. Review mode is on; session captures will queue here."
            : "No staged memory. Review mode is off; enable it with bolt memory review on.",
        }
      if (input.apply) {
        const result = await Memory.approve({ root })
        return {
          root,
          text: [
            ...output.diff,
            "",
            `Applied ${result.applied} staged operation${result.applied === 1 ? "" : "s"}.`,
          ].join("\n"),
        }
      }
      if (input.discard) {
        const result = await Memory.discard({ root })
        return {
          root,
          text: [
            ...output.diff,
            "",
            `Discarded ${result.discarded} staged operation${result.discarded === 1 ? "" : "s"}.`,
          ].join("\n"),
        }
      }
      return {
        root,
        text: [
          ...output.diff,
          "",
          "Run bolt memory diff --apply to persist or bolt memory diff --discard to drop.",
        ].join("\n"),
      }
    }
    case "review": {
      const output = await Memory.review({ root, review: input.enabled })
      return {
        root,
        text: output.review
          ? "Review mode on: session captures stage in bolt memory diff before persisting."
          : `Review mode off: session captures persist directly.${output.staged ? ` ${output.staged} staged operation${output.staged === 1 ? "" : "s"} still pending in bolt memory diff.` : ""}`,
      }
    }
    case "search": {
      const output = await MemorySearch.search({ root, query: input.query, limit: input.limit })
      if (!output.enabled) throw new Error("Project memory is disabled. Enable it with /memory on or bolt learn.")
      return {
        root,
        text: output.hits.length
          ? output.hits
              .map((hit, index) => {
                const doc = hit.doc
                const where =
                  doc.source === "sessions" ? `session ${doc.key}` : `${doc.source} > ${doc.section} > ${doc.key}`
                const stamp =
                  doc.updatedAt && doc.updatedAt > 0
                    ? ` (updated ${new Date(doc.updatedAt).toISOString().slice(0, 10)})`
                    : ""
                return `${index + 1}. [${where}]${stamp} ${doc.text}`
              })
              .join("\n")
          : "No stored memory matches that query.",
      }
    }
    case "conflicts": {
      const output = await Memory.conflicts({ root, fix: input.fix })
      if (!output.conflicts.length) return { root, text: "No conflicting facts found in project memory." }
      const label = (item: { file: string; section: string; key: string; text: string }) =>
        `[${item.file} > ${item.section} > ${item.key}] ${item.text}`
      return {
        root,
        text: [
          ...output.conflicts.flatMap((conflict) => [
            `conflict (${conflict.reason}):`,
            `  ${label(conflict.left)}`,
            `  ${label(conflict.right)}`,
          ]),
          "",
          ...output.plan.resolutions.flatMap((item) => [
            `resolution: keep ${label(item.keep)}`,
            `            drop ${label(item.drop)}`,
          ]),
          ...output.plan.unresolved.map(
            (item) => `unresolved (${item.reason}): ${label(item.left)} vs ${label(item.right)}`,
          ),
          ...(output.applied
            ? [
                `Removed ${output.result.result.removed} superseded ${output.result.result.removed === 1 ? "fact" : "facts"}.`,
              ]
            : output.plan.resolutions.length
              ? ["Run bolt memory conflicts --fix to apply these resolutions."]
              : []),
        ].join("\n"),
      }
    }
    case "dossier": {
      const shown = await Memory.show({ root })
      const sessions = await MemoryFiles.recentSessions(root, 10, 200)
      const taught = await Memory.origins({ root })
      const text = dossier({
        entries: Object.entries(shown.inventory.items).map(([id, item]) => ({
          ...item,
          sessionID: taught.items[id]?.sessionID,
          messageID: taught.items[id]?.messageID,
        })),
        sessions,
      })
      if (!text)
        throw new Error("No project memory stored for this project yet. Run bolt learn or save memories first.")
      return { root, text }
    }
  }
}
