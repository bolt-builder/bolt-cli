# Bolt Codebase Guide

A tour of this repository for contributors: how the pieces fit together, where things live, and where to start when you want to change something.

## What you're looking at

Bolt is a Bun monorepo (Bun 1.3+, Turbo for orchestration) containing a terminal AI coding agent. Three stacks meet here:

- **Backend / runtime:** TypeScript with [Effect](https://effect.website) throughout. Session state, tool execution, and provider calls are Effect services.
- **TUI:** [SolidJS](https://www.solidjs.com) reactivity rendered to the terminal through [OpenTUI](https://github.com/opentui/opentui).
- **Web / desktop:** SolidJS UIs (`packages/web` is Astro + SolidJS, `packages/app` is SolidJS) and an Electron desktop app (`packages/desktop`) that talk to the same server.

Everything runs local-first: sessions, messages, and memory live in a sqlite database under your Bolt data directory, which is why `bolt db` can query them at any time.

## The dependency chain, roughly

```
schema / protocol        shared types + the event protocol that flows over the wire
        │
core                     session runtime, storage, git, tools, environment
        │
llm                      provider abstraction + request routing (packages/llm/src/route)
        │
memory                   project memory: capture, indexing, recall
        │
server                   HTTP API exposing core over the wire (packages/server)
        │
sdk (js + next)          generated client used by the TUI, web, desktop, sdks
        │
tui / web / desktop      the frontends
        │
cli (bolt)              the `bolt` command you actually run
```

Not a strict layering, but a useful mental model: the frontends never touch `core` internals directly; they consume the SDK, which speaks to the server.

## Package tour

### The ones you'll touch most

| Package | Path | What's inside |
| ------- | ---- | ------------- |
| `bolt` (CLI entry) | `packages/opencode/` | The command tree you see with `bolt --help`, and the dev entry (`bun dev` from here) |
| `@bolt-ai/tui` | `packages/tui/` | The interactive terminal UI |
| `@bolt-ai/core` | `packages/core/` | Session runtime: storage, git integration, tools, file watching |
| `@bolt-ai/llm` | `packages/llm/` | Provider abstraction, request routing, retries, prompt-cache policy |
| `@bolt-ai/server` | `packages/server/` | HTTP API that fronts core; what `bolt serve` runs |
| `@bolt-ai/sdk` | `packages/sdk/` | Generated JS client the frontends use |

### Frontends and surfaces

- `@bolt-ai/web` (`packages/web`): the marketing/docs site, Astro + SolidJS.
- `@bolt-ai/desktop` (`packages/desktop`): Electron wrapper, multi-window/tabs, auto-update channels.
- `@bolt-ai/app` (`packages/app`): the browser session UI behind `bolt web`.
- `@bolt-ai/session-ui` (`packages/session-ui`): shared session rendering used by the web UI.
- `@bolt-ai/ui` (`packages/ui`): shared SolidJS components.

### Domain modules

- `@bolt-ai/memory` (`packages/memory/`): project memory capture, indexing, decay, recall.
- `@bolt-ai/schema` (`packages/schema/`): shared JSON schema types, including the `bolt.jsonc` config schema.
- `@bolt-ai/protocol` (`packages/protocol/`): the typed event protocol (session/message/part events) that flows between server and clients.
- `@bolt-ai/codemode` (`packages/codemode/`): Effect-native confined code execution over schema-described tools.
- `@bolt-ai/plugin` (`packages/plugin/`): plugin host and API surface.

### Infrastructure / support

- `@bolt-ai/function`, `@bolt-ai/script`, `@bolt-ai/effect-drizzle-sqlite`, `@bolt-ai/effect-sqlite-node`: Effect + sqlite plumbing and helpers.
- `@bolt-ai/http-recorder`: record/replay of provider traffic with deterministic cassettes (great for tests).
- `@bolt-ai/httpapi-codegen`, `@bolt-ai/sdk-next`: API + SDK generation.
- `packages/enterprise`, `packages/identity`, `packages/slack`, `packages/console`, `packages/stats`, `packages/containers`: enterprise auth, Slack integration, analytics, packaging.
- `sdks/vscode`: the VS Code extension.

## Anatomy of a request

To follow one turn end to end:

1. The TUI prompt (`packages/tui/src/component/prompt/`) sends your text through the SDK.
2. The server accepts it, and `core` assembles the session runtime (history, compaction, context sources; `CONTEXT.md` documents this model in detail).
3. `llm` routes the request: `packages/llm/src/route/` picks the provider/endpoint, applies the prompt-cache policy (`cache-policy.ts`), executes with retries (429/503/529 backoff with `retry-after` handling in `executor.ts`).
4. The model's tool calls run through core's tool implementations; file edits go through git-aware writers.
5. Streaming parts flow back over the protocol as `message.part.*` events; the TUI renders them reactively.
6. Cost per message is recorded as it streams (see `packages/tui/src/util/cost-alert.ts` for how the cost signal is consumed).

## TUI orientation

`packages/tui/src/` is where the interface lives:

- `app.tsx` is the root: providers are mounted here, and the command palette (Ctrl+P) entries are defined here, grouped by category (System, Session, ...).
- `context/` holds SolidJS contexts: `sync.tsx` (server state, messages, parts, sessions), `kv.tsx` (persisted settings, `state/kv.json`), `event.ts`, `nudge.tsx` (cost alerts), `runtime.tsx`.
- `component/` holds dialogs (`dialog-*.tsx`), the prompt composer (`component/prompt/`), spinner, session sidebar.
- `routes/` maps screens (home, session).
- `config/keybind.ts` defines every keybinding and the command it triggers.

Settings follow one pattern everywhere: a kv key like `fire_animation_enabled`, read with `kv.get(key, default)`, flipped by a palette entry in `app.tsx`.

## Dev workflow

```bash
# Requirements: Bun 1.3+
bun install

# Start the TUI in dev mode (from packages/opencode)
cd packages/opencode
bun dev

# Run tests (from package directories)
bun test

# Type-check (per package, or all via turbo)
bun run typecheck
turbo typecheck
```

`turbo.json` defines `typecheck` and `build` tasks; builds emit to `dist/**`.

## Conventions worth knowing

- **Effect everywhere on the backend.** New backend code should read like the neighboring files: services, layers, typed errors.
- **Generated files are generated.** `packages/sdk` and `packages/sdk-next` are codegen output; change the source templates or the protocol, not the generated client by hand.
- **New providers need no code here** in most cases: models and provider metadata come from [models.dev](https://github.com/anomalyco/models.dev) (see CONTRIBUTING.md).
- **Terminology is defined.** `CONTEXT.md` is the glossary for session-runtime concepts (Context Epoch, Session History, etc.). Use its words in code comments and PRs.
- **UI/core features need design review first**; bug fixes, providers, LSP/formatters, and docs merge without it (CONTRIBUTING.md).

## Where to start contributing

- Fix a bug: look for [`good first issue`](https://github.com/Bolt-builder/bolt-cli/issues?q=is%3Aissue+state%3Aopen+label%3A%22good+first+issue%22).
- Add a provider: start at models.dev, not here.
- Improve docs: this file, `docs/QUICKSTART.md`, and `docs/reference/` (generated command reference).
- Tweak the TUI: `packages/tui/src/` is self-contained frontend code; palette entries, dialogs, and keybinds are all in plain sight.

Questions? Open a [Discussion](https://github.com/Bolt-builder/bolt-cli/discussions).
