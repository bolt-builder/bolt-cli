#!/usr/bin/env bun

import { fileURLToPath } from "node:url"
import { pack } from "../../script/src/pack"

await pack(fileURLToPath(new URL("..", import.meta.url)))
