import { Effect } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { ServerConnection } from "../../services/server-connection"

export type Row = { readonly name: string; readonly directory: string; readonly branch?: string }

export function table(rows: Row[]) {
  const width = rows.reduce((max, row) => Math.max(max, row.name.length), 0)
  return rows.map((row) => `${row.name.padEnd(width)}  ${row.branch ?? "(detached)"}  ${row.directory}`)
}

export function pick(rows: Row[], key: string) {
  const hits = rows.filter((row) => row.name === key || row.branch === key || row.directory === key)
  return hits.length === 1 ? hits[0] : undefined
}

export const connect = Effect.fn("cli.worktree.connect")(function* () {
  const server = yield* ServerConnection.resolve()
  const client = OpenCode.make({
    baseUrl: server.endpoint.url,
    headers: Service.headers(server.endpoint),
    fetch: noTimeoutFetch,
  })
  const location = yield* Effect.tryPromise({
    try: () => client.location.get({ location: { directory: process.cwd() } }),
    catch: (cause) => cause,
  })
  return { client, location }
})

export async function rows(connection: Effect.Success<ReturnType<typeof connect>>) {
  const projectID = connection.location.project.id
  const entries = await connection.client.worktree.list({ projectID })
  const canonical = connection.location.project.canonical.replaceAll("\\", "/").replace(/\/$/, "")
  return Promise.all(
    entries
      .filter((entry) => entry.directory.replaceAll("\\", "/").replace(/\/$/, "") !== canonical)
      .map(async (entry) => ({
        name: entry.directory.split(/[\\/]/).filter(Boolean).at(-1)!,
        directory: entry.directory,
        branch: (await connection.client.vcs.get({ location: { directory: entry.directory } })).data.branch.current,
      })),
  )
}
