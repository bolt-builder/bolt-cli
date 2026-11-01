import type { Permission } from "@opencode/schema/permission"
import { Wildcard } from "../util/wildcard.js"

/** V1 capture permissions coexist with V2's attachment-scoped desktop browser permission. */
export function legacyCaptureRules(rules: Permission.Ruleset): Permission.Rule[] {
  return rules.flatMap((rule) =>
    Wildcard.match("browser", rule.action) && !Wildcard.match("browser_headless", rule.action)
      ? [rule, { ...rule, action: "browser_headless" }]
      : [rule],
  )
}
