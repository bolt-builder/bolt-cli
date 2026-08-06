import path from "node:path"

// Returns the path to show in a file reference: workspace-relative when the
// file is inside the given root, absolute otherwise, always forward-slashed
// to match how the Bolt TUI normalizes mention paths.
export function display(file: string, root?: string) {
  if (!root) {
    return file.split(path.sep).join("/")
  }
  const relative = path.relative(root, file)
  if (!relative || relative.startsWith("..") || path.isAbsolute(relative)) {
    return file.split(path.sep).join("/")
  }
  return relative.split(path.sep).join("/")
}

// Builds the file reference the Bolt TUI prompt understands: @path, with an
// optional #start or #start-end line suffix (1-based, digits only).
export function reference(input: { file: string; start?: number; end?: number }) {
  if (input.start === undefined) {
    return `@${input.file}`
  }
  if (input.end === undefined || input.end === input.start) {
    return `@${input.file}#${input.start}`
  }
  return `@${input.file}#${input.start}-${input.end}`
}
