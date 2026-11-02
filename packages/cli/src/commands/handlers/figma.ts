import path from "node:path"
import { Effect, Option, Schema } from "effect"
import { OpenCode } from "@opencode/client/promise"
import { Service } from "@opencode/client/effect/service"
import { noTimeoutFetch } from "@opencode/util/no-timeout-fetch"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { ServerConnection } from "../../services/server-connection"
import { answer } from "../../services/answer"
import { parseSessionTargetModel } from "../../session-target"

// Serialized design JSON larger than this is too big to prompt in one shot.
const LIMIT = 120_000
const DEPTH = 12
const CHILDREN = 40
const TEXT = 2_000

// Node types whose payload is raw vector geometry; their paint summary is kept
// but their children (more geometry) carry nothing the generated code needs.
const VECTORS = new Set(["VECTOR", "LINE", "ELLIPSE", "STAR", "REGULAR_POLYGON", "BOOLEAN_OPERATION"])

export type Color = {
  r: number
  g: number
  b: number
  a?: number
}

export type Paint = {
  type?: string
  visible?: boolean
  opacity?: number
  color?: Color
}

export type Node = {
  type?: string
  name?: string
  layoutMode?: string
  itemSpacing?: number
  paddingLeft?: number
  paddingRight?: number
  paddingTop?: number
  paddingBottom?: number
  cornerRadius?: number
  characters?: string
  style?: {
    fontFamily?: string
    fontSize?: number
    fontWeight?: number
  }
  fills?: Paint[]
  children?: Node[]
}

export type Design = {
  type?: string
  name?: string
  layout?: string
  gap?: number
  padding?: { left: number; right: number; top: number; bottom: number }
  radius?: number
  fills?: string[]
  font?: { family?: string; size?: number; weight?: number }
  text?: string
  children?: Design[]
}

/** Extract the file key and node id from a Figma file or design URL. */
export function parse(url: string) {
  if (!URL.canParse(url)) return undefined
  const parsed = new URL(url)
  if (parsed.hostname !== "figma.com" && !parsed.hostname.endsWith(".figma.com")) return undefined
  const match = parsed.pathname.match(/^\/(?:file|design)\/([A-Za-z0-9]+)(?:\/|$)/)
  if (!match) return undefined
  const raw = parsed.searchParams.get("node-id")
  // Figma URLs encode node ids as 12-34 but the REST API expects 12:34.
  return { key: match[1], node: raw ? raw.replace(/-/g, ":") : undefined }
}

/** Convert a Figma normalized RGBA color (plus paint opacity) to a hex string. */
export function hex(color: Color, opacity?: number) {
  const channel = (value: number) =>
    Math.round(Math.max(0, Math.min(1, value)) * 255)
      .toString(16)
      .padStart(2, "0")
  const alpha = (color.a ?? 1) * (opacity ?? 1)
  const base = `#${channel(color.r)}${channel(color.g)}${channel(color.b)}`
  if (alpha >= 1) return base
  return base + channel(alpha)
}

/**
 * Reduce a raw Figma node tree to the design props that matter for code
 * generation: layout, spacing, color, typography, text, and structure.
 * Raw vector geometry is dropped and depth/fanout are capped.
 */
export function simplify(node: Node, depth = 0): Design | undefined {
  if (depth > DEPTH) return undefined
  const out: Design = {}
  if (node.type) out.type = node.type
  if (node.name) out.name = node.name
  if (node.layoutMode && node.layoutMode !== "NONE") out.layout = node.layoutMode.toLowerCase()
  if (node.itemSpacing) out.gap = node.itemSpacing
  const left = node.paddingLeft ?? 0
  const right = node.paddingRight ?? 0
  const top = node.paddingTop ?? 0
  const bottom = node.paddingBottom ?? 0
  if (left || right || top || bottom) out.padding = { left, right, top, bottom }
  if (node.cornerRadius) out.radius = node.cornerRadius
  const fills = (node.fills ?? []).flatMap((fill) => {
    if (fill.visible === false) return []
    if (fill.type !== "SOLID") return []
    const color = fill.color
    if (!color) return []
    return [hex(color, fill.opacity)]
  })
  if (fills.length) out.fills = fills
  const style = node.style
  if (style && (style.fontFamily || style.fontSize || style.fontWeight)) {
    out.font = { family: style.fontFamily, size: style.fontSize, weight: style.fontWeight }
  }
  if (node.characters) out.text = node.characters.slice(0, TEXT)
  if (node.type && VECTORS.has(node.type)) return out
  const children = (node.children ?? [])
    .slice(0, CHILDREN)
    .map((child) => simplify(child, depth + 1))
    .filter((child): child is Design => child !== undefined)
  if (children.length) out.children = children
  return out
}

const INSTRUCTIONS = [
  "You are given a simplified JSON export of a Figma design node. Generate component code that reproduces it.",
  "First inspect the repository with the read, grep, and glob tools to detect the framework, language, styling approach, and component conventions, then match them. Reuse existing design tokens, theme values, and primitives when they fit the design.",
  "Write the generated component files under the output directory using your file tools. Do not modify unrelated files.",
  "End your final message by listing each file you wrote with a one-line description.",
].join("\n")

const ColorSchema = Schema.Struct({
  r: Schema.Number,
  g: Schema.Number,
  b: Schema.Number,
  a: Schema.optionalKey(Schema.Number),
})
const NodeSchema: Schema.Codec<Node> = Schema.suspend(() =>
  Schema.Struct({
    type: Schema.optionalKey(Schema.String),
    name: Schema.optionalKey(Schema.String),
    layoutMode: Schema.optionalKey(Schema.String),
    itemSpacing: Schema.optionalKey(Schema.Number),
    paddingLeft: Schema.optionalKey(Schema.Number),
    paddingRight: Schema.optionalKey(Schema.Number),
    paddingTop: Schema.optionalKey(Schema.Number),
    paddingBottom: Schema.optionalKey(Schema.Number),
    cornerRadius: Schema.optionalKey(Schema.Number),
    characters: Schema.optionalKey(Schema.String),
    style: Schema.optionalKey(
      Schema.Struct({
        fontFamily: Schema.optionalKey(Schema.String),
        fontSize: Schema.optionalKey(Schema.Number),
        fontWeight: Schema.optionalKey(Schema.Number),
      }),
    ),
    fills: Schema.optionalKey(
      Schema.mutable(
        Schema.Array(
          Schema.Struct({
            type: Schema.optionalKey(Schema.String),
            visible: Schema.optionalKey(Schema.Boolean),
            opacity: Schema.optionalKey(Schema.Number),
            color: Schema.optionalKey(ColorSchema),
          }),
        ),
      ),
    ),
    children: Schema.optionalKey(Schema.mutable(Schema.Array(NodeSchema))),
  }),
)

export default Runtime.handler(Commands.commands.figma, (input) =>
  Effect.gen(function* () {
    const target = parse(input.url)
    if (!target)
      return yield* Effect.fail(
        new Error(
          "Could not parse the Figma URL. Expected https://www.figma.com/design/<key>/... or https://www.figma.com/file/<key>/...",
        ),
      )
    if (!target.node)
      return yield* Effect.fail(
        new Error(
          "The URL has no node-id. In Figma, select a frame or component and copy its link so the URL contains node-id.",
        ),
      )
    const token = process.env.FIGMA_TOKEN
    if (!token)
      return yield* Effect.fail(
        new Error(
          "FIGMA_TOKEN is not set. Create a personal access token in Figma settings and export it as FIGMA_TOKEN.",
        ),
      )
    const model = Option.getOrUndefined(input.model)
    if (model !== undefined) parseSessionTargetModel(model)
    const base = URL.parse(process.env.BOLT_FIGMA_API_URL ?? "https://api.figma.com")
    if (!base || !["http:", "https:"].includes(base.protocol) || base.username || base.password)
      return yield* Effect.fail(new Error("BOLT_FIGMA_API_URL must be an HTTP(S) URL without credentials."))
    process.stdout.write("Fetching the design from Figma...\n")
    const response = yield* Effect.tryPromise({
      try: () =>
        fetch(new URL(`/v1/files/${target.key}/nodes?ids=${encodeURIComponent(target.node!)}`, base), {
          headers: { "X-Figma-Token": token },
          redirect: "error",
          signal: AbortSignal.timeout(20_000),
        }),
      catch: () => new Error("Could not reach the Figma API. Check your network connection and try again."),
    })
    if (!response.ok)
      return yield* Effect.fail(
        new Error(
          `The Figma API returned ${response.status}. Check that FIGMA_TOKEN is valid and the file is accessible.`,
        ),
      )
    const body = yield* Effect.tryPromise(async () => {
      if (!response.body) throw new Error("The Figma API returned an empty response.")
      const reader = response.body.getReader()
      const chunks: Uint8Array[] = []
      let bytes = 0
      try {
        while (true) {
          const next = await reader.read()
          if (next.done) break
          bytes += next.value.byteLength
          if (bytes > 8_000_000)
            throw new Error("The selected node is too large to hand to the agent in one shot. Link a smaller frame.")
          chunks.push(next.value)
        }
        return Schema.decodeUnknownSync(
          Schema.fromJsonString(
            Schema.Struct({
              nodes: Schema.Record(Schema.String, Schema.Struct({ document: Schema.optionalKey(NodeSchema) })),
            }),
          ),
        )(Buffer.concat(chunks).toString())
      } finally {
        await reader.cancel().catch(() => {})
        reader.releaseLock()
      }
    })
    const document = body.nodes[target.node]?.document
    if (!document) return yield* Effect.fail(new Error(`Node ${target.node} was not found in file ${target.key}.`))
    const design = simplify(document)
    if (!design) return yield* Effect.fail(new Error("Could not extract any design data from the node."))
    const json = JSON.stringify(design, null, 2)
    if (json.length > LIMIT)
      return yield* Effect.fail(
        new Error("The selected node is too large to hand to the agent in one shot. Link a smaller frame."),
      )
    const out = path.resolve(process.cwd(), Option.getOrUndefined(input.out) ?? ".")
    const server = yield* ServerConnection.resolve()
    const client = OpenCode.make({
      baseUrl: server.endpoint.url,
      headers: Service.headers(server.endpoint),
      fetch: noTimeoutFetch,
    })
    process.stdout.write("Generating components...\n")
    const text = yield* Effect.tryPromise(() =>
      answer({
        client,
        model,
        agent: "build",
        directory: process.cwd(),
        title: "bolt figma",
        permissions: [{ action: "external_directory", resource: path.join(out, "*"), effect: "allow" }],
        text: `${INSTRUCTIONS}\n\nOutput directory: ${out}\n\nDesign JSON:\n${json}`,
      }),
    )
    process.stdout.write(`\n${text}\n`)
  }),
)
