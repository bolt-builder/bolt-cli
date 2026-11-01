import path from "node:path"
import { Effect, Option, Schema } from "effect"
import { effectCmd, fail } from "../effect-cmd"

const SKIP = new Set([".git", "node_modules", "dist", "build", ".turbo"])

export type Playbook = { name: string; from: number; to: number; title: string; steps: string[] }

/** Curated upgrade playbooks, one major hop each. Multi-major upgrades chain hops in order. */
export const BUILTIN: Playbook[] = [
  {
    name: "react",
    from: 17,
    to: 18,
    title: "React 17 to 18",
    steps: [
      "Bump `react` and `react-dom` to ^18 together, plus `@types/react` and `@types/react-dom` when present",
      "Replace `ReactDOM.render(el, node)` with `createRoot(node).render(el)` from `react-dom/client`",
      "Run the import codemod: `npx react-codemod update-react-imports`",
      "Audit effects for StrictMode double-invocation in development",
      "Check third-party UI libraries for React 18 peer-dependency support before shipping",
    ],
  },
  {
    name: "react",
    from: 18,
    to: 19,
    title: "React 18 to 19",
    steps: [
      "Bump `react` and `react-dom` to ^19 together with their type packages",
      "Run the migration recipe: `npx codemod@latest react/19/migration-recipe`",
      "Remove `propTypes` and `defaultProps` on function components; use default parameters",
      "Replace `forwardRef` where possible: ref is now a regular prop",
      "Update tests: `react-test-renderer` is deprecated in 19",
    ],
  },
  {
    name: "express",
    from: 4,
    to: 5,
    title: "Express 4 to 5",
    steps: [
      "Bump `express` to ^5 and re-run the type checker; `@types/express` major must match",
      "Replace removed aliases: `app.del` becomes `app.delete`, `res.sendfile` becomes `res.sendFile`",
      "Update route paths: string patterns like `/user*` need the new syntax `/user{*splat}`",
      "Rely on automatic promise-rejection forwarding and delete manual `next(err)` wrappers in async handlers",
      "Re-test body parsing: `req.body` is undefined until a body parser runs",
    ],
  },
  {
    name: "eslint",
    from: 8,
    to: 9,
    title: "ESLint 8 to 9",
    steps: [
      "Bump `eslint` to ^9",
      "Migrate to flat config: `npx @eslint/migrate-config .eslintrc.json` writes `eslint.config.js`",
      "Delete `.eslintrc.*` and `.eslintignore`; move ignores into the flat config `ignores` key",
      "Upgrade plugins that ship flat-config presets and drop `eslint-config-*` shims that do not",
      "Run the full lint once and triage rules whose defaults changed in 9",
    ],
  },
  {
    name: "tailwindcss",
    from: 3,
    to: 4,
    title: "Tailwind CSS 3 to 4",
    steps: [
      "Run the official upgrade tool: `npx @tailwindcss/upgrade`",
      'Replace `@tailwind base/components/utilities` directives with a single `@import "tailwindcss"`',
      "Move theme customization from `tailwind.config.js` into CSS `@theme` blocks",
      "Swap the PostCSS plugin for `@tailwindcss/postcss` (or the Vite plugin)",
      "Visually diff key screens: default border color and ring width changed",
    ],
  },
  {
    name: "typescript",
    from: 4,
    to: 5,
    title: "TypeScript 4 to 5",
    steps: [
      "Bump `typescript` to ^5 and re-run the type checker",
      "Replace deprecated compiler flags: `importsNotUsedAsValues` and `preserveValueImports` become `verbatimModuleSyntax`",
      'Consider `moduleResolution: "bundler"` for bundled projects',
      "Update decorators: TS 5 implements the stage-3 standard, legacy decorators need `experimentalDecorators`",
      "Upgrade `@typescript-eslint/*` to a major that supports TS 5",
    ],
  },
]

/**
 * Generic single-hop playbook for packages without curated steps. Honest
 * baseline: read the changelog, bump, lean on the type checker and tests.
 */
export function generic(name: string, from: number, to: number): Playbook {
  return {
    name,
    from,
    to,
    title: `${name} ${from} to ${to} (generic)`,
    steps: [
      `Read the v${to} release notes: https://www.npmjs.com/package/${name}?activeTab=versions and the project changelog`,
      `Bump \`${name}\` to ^${to}.0.0 in every workspace package that declares it`,
      `Search the repo for \`${name}\` imports and check each call site against the v${to} breaking-change list`,
      "Run the type checker and the test suite; fix compile errors before behavioral review",
      "Land the bump as its own commit so it can be bisected and reverted cleanly",
    ],
  }
}

/** First declared version of `name` across a set of package.json contents, range operators stripped. */
export function version(manifests: Record<string, unknown>, name: string) {
  for (const file of Object.keys(manifests).sort()) {
    const manifest = manifests[file] as { dependencies?: unknown; devDependencies?: unknown }
    for (const group of [manifest.dependencies, manifest.devDependencies]) {
      if (typeof group !== "object" || group === null) continue
      const range = (group as Record<string, unknown>)[name]
      if (typeof range !== "string") continue
      const cleaned = range.replace(/^[~^>=<\s]+/, "")
      if (/^\d+/.test(cleaned)) return cleaned
    }
  }
  return undefined
}

/** Ordered playbook chain covering every major hop from `from` to `to`, curated where available, generic otherwise. */
export function hops(name: string, from: number, to: number, books: Playbook[]) {
  return Array.from({ length: Math.max(0, to - from) }, (_, index) => {
    const start = from + index
    return (
      books.find((book) => book.name === name && book.from === start && book.to === start + 1) ??
      generic(name, start, start + 1)
    )
  })
}

/** Curated playbooks that apply to the repo: package present and declared major within a curated hop. */
export function applicable(manifests: Record<string, unknown>, books: Playbook[]) {
  return books.flatMap((book) => {
    const current = version(manifests, book.name)
    if (!current) return []
    const major = Number(current.split(".")[0])
    if (major !== book.from) return []
    return [{ book, current }]
  })
}

/** Renders the chained playbooks as a markdown checklist. */
export function markdown(name: string, current: string, chain: Playbook[]) {
  if (chain.length === 0) return `# Migration: ${name}\n\nAlready at or past the target major (currently ${current}).\n`
  const sections = chain.flatMap((book) => [`## ${book.title}`, "", ...book.steps.map((step) => `- [ ] ${step}`), ""])
  return [
    `# Migration: ${name} ${current} to ${chain[chain.length - 1].to}.x`,
    "",
    `${chain.length} major hop${chain.length === 1 ? "" : "s"}. Land and verify each hop before starting the next.`,
    "",
    ...sections,
  ].join("\n")
}

export const MigrateCommand = effectCmd({
  command: "migrate [package] [target]",
  describe: "generate a major-version upgrade playbook for a dependency",
  instance: false,
  builder: (yargs) =>
    yargs
      .positional("package", {
        describe: "dependency to upgrade; omit to list applicable curated playbooks",
        type: "string",
      })
      .positional("target", { describe: "target major version, defaults to one hop up", type: "number" }),
  handler: Effect.fn("Cli.migrate")(function* (args) {
    const cwd = process.cwd()
    const glob = new Bun.Glob("**/package.json")
    const scanned = yield* Effect.promise(() => Array.fromAsync(glob.scan({ cwd })))
    const names = scanned
      .map((name) => name.replaceAll("\\", "/"))
      .filter((name) => !name.split("/").some((part) => SKIP.has(part)))
      .sort()
    const manifests: Record<string, unknown> = {}
    for (const name of names) {
      const raw = yield* Effect.promise(() => Bun.file(path.join(cwd, name)).text())
      const parsed = Schema.decodeOption(Schema.UnknownFromJsonString)(raw)
      if (Option.isSome(parsed)) manifests[name] = parsed.value
    }
    if (!args.package) {
      const found = applicable(manifests, BUILTIN)
      if (found.length === 0) {
        process.stdout.write(
          "No curated playbooks apply. Run `bolt migrate <package> [target]` for a generic playbook.\n",
        )
        return
      }
      process.stdout.write("Applicable curated playbooks:\n\n")
      for (const entry of found) {
        process.stdout.write(
          `- ${entry.book.title}: \`bolt migrate ${entry.book.name} ${entry.book.to}\` (currently ${entry.current})\n`,
        )
      }
      return
    }
    const current = version(manifests, args.package)
    if (!current) return yield* fail(`${args.package} is not declared in any package.json under this directory`)
    const major = Number(current.split(".")[0])
    const target = args.target ?? major + 1
    if (!Number.isInteger(target) || target <= major)
      return yield* fail(`Target major ${target} is not above the current major ${major}`)
    process.stdout.write(markdown(args.package, current, hops(args.package, major, target, BUILTIN)))
  }),
})
