/** Parse the last pass/fail verdict marker from the review response. */
export function verdict(text: string) {
  const matches = [...text.matchAll(/verdict:\s*(pass|fail)/gi)]
  const last = matches.at(-1)
  if (!last) return undefined
  return last[1].toLowerCase() as "pass" | "fail"
}

/** Parse the last confidence marker from an agent response. */
export function confidence(text: string) {
  const matches = [...text.matchAll(/confidence:\s*(high|medium|low)/gi)]
  const last = matches.at(-1)
  if (!last) return undefined
  return last[1].toLowerCase() as "high" | "medium" | "low"
}

export const CONFIDENCE =
  'End your final message with exactly one line: "Confidence: high", "Confidence: medium", or "Confidence: low". Use "low" when you are mostly guessing.'

export const INSTRUCTIONS = [
  "Review the following code changes. Use the read, grep, and glob tools to inspect surrounding code when the diff alone is not enough.",
  "Report each issue with a severity (critical, major, minor), the file and line, and a short explanation. Be concise and do not restate the diff. If there are no issues, say so.",
  'End your final message with exactly one line: "Verdict: PASS" if there are no critical or major issues, otherwise "Verdict: FAIL".',
].join("\n")
