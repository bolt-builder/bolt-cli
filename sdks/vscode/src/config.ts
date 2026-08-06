import { workspace } from "vscode"

// Single place to read the bolt.* configuration with correct types.
export function config() {
  const cfg = workspace.getConfiguration("bolt")
  return {
    path: cfg.get<string>("path", ""),
    args: cfg.get<string[]>("args", []),
    reuse: cfg.get<boolean>("terminal.reuse", true),
  }
}
