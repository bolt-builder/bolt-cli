import { sameDirectory } from "@bolt-ai/util/path"

export function workspaceDirectories(project: { worktree: string; sandboxes?: readonly string[] }) {
  return (project.sandboxes ?? []).filter((directory) => !sameDirectory(project.worktree, directory))
}
