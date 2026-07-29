#!/usr/bin/env bun
import path from "path"

const root = path.resolve(import.meta.dir, "..")
const file = path.join(root, "UPCOMING_CHANGELOG.md")

await Bun.write(file, "Initial release\n")

process.exit(0)