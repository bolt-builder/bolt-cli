import { resolveTheme } from "./packages/tui/src/theme/index.ts"
import { opencode } from "./packages/tui/src/theme/assets/opencode.json"

console.log("Theme JSON:", JSON.stringify(opencode, null, 2))
try {
  const resolved = resolveTheme(opencode, "dark")
  console.log("Resolved theme:", JSON.stringify(resolved, null, 2))
} catch (e) {
  console.error("Error resolving theme:", e.message)
}
