export * as ServerAuth from "./auth"

import { ConfigService } from "@/effect/config-service"
import { Flag } from "@bolt-ai/core/flag/flag"
import { createHash, timingSafeEqual } from "node:crypto"
import { Config as EffectConfig, Context, Option, Redacted } from "effect"

export type Credentials = {
  password?: string
  username?: string
}

export type DecodedCredentials = {
  readonly username: string
  readonly password: Redacted.Redacted
}

export class Config extends ConfigService.Service<Config>()("@bolt/ServerAuthConfig", {
  password: EffectConfig.string("BOLT_SERVER_PASSWORD").pipe(EffectConfig.option),
  username: EffectConfig.string("BOLT_SERVER_USERNAME").pipe(EffectConfig.withDefault("bolt")),
}) {}

export type Info = Context.Service.Shape<typeof Config>

export function required(config: Info) {
  return Option.isSome(config.password) && config.password.value !== ""
}

export function authorized(credentials: DecodedCredentials, config: Info) {
  if (Option.isNone(config.password)) return false
  // Evaluate both comparisons so a username mismatch does not skip the password
  // hash, which would leak username validity through response timing.
  const username = equals(credentials.username, config.username)
  const password = equals(Redacted.value(credentials.password), config.password.value)
  return username && password
}

// Constant-time comparison so the password cannot be recovered byte-by-byte
// through response timing. Hashing first equalizes lengths, which
// timingSafeEqual requires (and avoids leaking the length itself).
function equals(a: string, b: string) {
  const hash = (value: string) => createHash("sha256").update(value).digest()
  return timingSafeEqual(hash(a), hash(b))
}

export function header(credentials?: Credentials) {
  const password = credentials?.password ?? Flag.BOLT_SERVER_PASSWORD
  if (!password) return undefined

  const username = credentials?.username ?? Flag.BOLT_SERVER_USERNAME ?? "bolt"
  return `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`
}

export function headers(credentials?: Credentials) {
  const authorization = header(credentials)
  if (!authorization) return undefined
  return { Authorization: authorization }
}
