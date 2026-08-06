import { access, constants } from "node:fs/promises"
import path from "node:path"

// Resolves the bolt CLI binary. An explicit setting wins; otherwise the
// directories in the given PATH string are searched in order.
export async function locate(explicit: string, env: string) {
  if (explicit) {
    return (await executable(explicit)) ? explicit : undefined
  }
  const names = process.platform === "win32" ? ["bolt.exe", "bolt.cmd", "bolt.bat"] : ["bolt"]
  const checks = env
    .split(path.delimiter)
    .filter(Boolean)
    .flatMap((dir) => names.map((name) => path.join(dir, name)))
  const results = await Promise.all(checks.map(async (file) => ((await executable(file)) ? file : undefined)))
  return results.find((file) => file !== undefined)
}

function executable(file: string) {
  return access(file, constants.X_OK).then(
    () => true,
    () => false,
  )
}
