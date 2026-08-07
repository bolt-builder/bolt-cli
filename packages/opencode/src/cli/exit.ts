/**
 * Stable exit codes per failure class so scripts can branch on `$?`.
 *
 * These are part of the CLI contract: never renumber an existing entry,
 * only append new classes.
 *
 * 0 success
 * 1 generic failure; also a FAIL verdict from verdict-style commands like
 *   `review` (kept at 1 for backward compatibility)
 * 2 no verdict could be determined from the model output
 * 3 a --max-cost or --max-tokens budget was hit
 * 4 authentication is missing, invalid, or expired
 * 5 an operation timed out
 */
export const OK = 0
export const ERROR = 1
export const VERDICT = 1
export const UNKNOWN = 2
export const BUDGET = 3
export const AUTH = 4
export const TIMEOUT = 5

export * as ExitCode from "./exit"
