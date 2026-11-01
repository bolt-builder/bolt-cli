export * as Redact from "./redact"

/**
 * Secrets firewall: redacts well-known credential formats from text before it
 * leaves the machine (prompts) or lands on disk (logs). Rules are limited to
 * high-precision token formats so ordinary code is never mangled.
 */

const RULES: { kind: string; pattern: RegExp }[] = [
  { kind: "aws-key", pattern: /\b(AKIA|ASIA)[0-9A-Z]{16}\b/g },
  { kind: "github-token", pattern: /\bgh[pousr]_[A-Za-z0-9]{20,255}\b/g },
  { kind: "github-token", pattern: /\bgithub_pat_[A-Za-z0-9_]{22,255}\b/g },
  // Covers OpenAI (sk-, sk-proj-) and Anthropic (sk-ant-) style keys.
  { kind: "api-key", pattern: /\bsk-[A-Za-z0-9_-]{20,}\b/g },
  { kind: "slack-token", pattern: /\bxox[baprs]-[A-Za-z0-9-]{10,}\b/g },
  { kind: "stripe-key", pattern: /\b[sr]k_live_[A-Za-z0-9]{16,}\b/g },
  { kind: "google-key", pattern: /\bAIza[0-9A-Za-z_-]{35}\b/g },
  { kind: "npm-token", pattern: /\bnpm_[A-Za-z0-9]{36}\b/g },
  { kind: "jwt", pattern: /\beyJ[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{10,}\.[A-Za-z0-9_-]{5,}\b/g },
  {
    kind: "private-key",
    pattern: /-----BEGIN [A-Z ]*PRIVATE KEY-----[\s\S]*?-----END [A-Z ]*PRIVATE KEY-----/g,
  },
  { kind: "bearer", pattern: /\bBearer\s+[A-Za-z0-9._~+/-]{20,}=*/g },
]

/** Replace every recognized secret in a string with a `[redacted:<kind>]` marker. */
export function text(input: string) {
  // Cheap pre-filter: most strings contain no candidate at all.
  if (input.length < 16) return input
  return RULES.reduce((acc, rule) => acc.replace(rule.pattern, `[redacted:${rule.kind}]`), input)
}

/** Recursively redact every string inside plain arrays and objects. */
export function deep<T>(input: T): T {
  if (typeof input === "string") return text(input) as T
  if (Array.isArray(input)) return input.map((item) => deep(item)) as T
  if (input && typeof input === "object") {
    const prototype = Object.getPrototypeOf(input)
    // Leave class instances (buffers, dates, streams) untouched.
    if (prototype !== Object.prototype && prototype !== null) return input
    return Object.fromEntries(Object.entries(input).map(([key, value]) => [key, deep(value)])) as T
  }
  return input
}
