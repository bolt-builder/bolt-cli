/**
 * Dry-run mode: sessions marked with `metadata.dryrun` report every file
 * write and shell command the plan would execute instead of performing it.
 * The marker travels on the session row (like the sandbox toggle) so it works
 * across the server boundary without protocol changes.
 */

/** True when the session opted into dry-run mode via `bolt run --dry-run`. */
export function enabled(metadata: Record<string, unknown> | null | undefined) {
  return metadata?.["dryrun"] === true
}

/** Tool output for a file write that was skipped in dry-run mode. */
export function describeWrite(file: string, diff: string) {
  return [
    `DRY RUN: no changes were made. This session is in dry-run mode, so file writes are reported instead of applied.`,
    "",
    `Would modify ${file}:`,
    "",
    diff.trim() || "(no content changes)",
  ].join("\n")
}

/** Tool output for a shell command that was skipped in dry-run mode. */
export function describeCommand(command: string, cwd: string) {
  return [
    `DRY RUN: command not executed. This session is in dry-run mode, so shell commands are reported instead of run.`,
    "",
    `Would run in ${cwd}:`,
    "",
    command.trim(),
    "",
    "Assume the command succeeds and continue describing the plan. Only read-only tools observe real state in dry-run mode.",
  ].join("\n")
}

export * as DryRun from "."
