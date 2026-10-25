import type { ReferenceApi } from "@bolt-ai/client/promise/api"
import type { ReferenceGitSource, ReferenceLocalSource } from "@bolt-ai/client"
import type { Transform } from "./registration.js"

export interface ReferenceEditor {
  add(name: string, source: ReferenceLocalSource | ReferenceGitSource): void
  remove(name: string): void
  list(): readonly (readonly [string, ReferenceLocalSource | ReferenceGitSource])[]
  get(name: string): ReferenceLocalSource | ReferenceGitSource | undefined
}

export interface ReferenceDomain extends ReferenceApi {
  readonly transform: Transform<ReferenceEditor>
  readonly reload: () => Promise<void>
}
