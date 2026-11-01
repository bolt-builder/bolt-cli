import { Effect } from "effect"

export type Resolver = (host: string) => Promise<readonly string[]>
const unavailable = () => new Error("Secure pinned HTTP requests are unavailable in this runtime")
export async function resolveAddresses(_url: URL, _resolver?: Resolver): Promise<readonly string[]> {
  throw unavailable()
}
export const assertFetchable = (_url: URL) => Effect.fail(unavailable())
export function makeFetch(_resolver?: Resolver, _env?: Readonly<Record<string, string | undefined>>) {
  return async function fetch(_input: string | URL, _init: RequestInit = {}): Promise<Response> {
    throw unavailable()
  }
}
export const fetch = makeFetch()
