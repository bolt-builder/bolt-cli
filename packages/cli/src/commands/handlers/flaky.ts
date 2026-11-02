import fs from "node:fs"
import path from "node:path"
import { Effect, Schema } from "effect"
import { ChildProcess } from "effect/process"
import { AppProcess } from "@opencode/util/process"
import { Flock } from "@opencode/util/flock"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { Commands } from "../commands"
import { Runtime } from "../../framework/runtime"
import { Git } from "../../services/git"
import { errorMessage } from "../../util/error"

const println = (text = "") => process.stdout.write(text + "\n")

const FILE = path.join(".bolt", "quarantine.json")

export type Quarantined = {
  command: string
  passes: number
  runs: number
  detected: number
}

/** Classify a series of exit codes from repeated runs. */
export function verdict(codes: number[]) {
  if (codes.length === 0) return undefined
  const passes = codes.filter((code) => code === 0).length
  if (passes === codes.length) return "pass" as const
  if (passes === 0) return "fail" as const
  return "flaky" as const
}

export default Runtime.handler(Commands.commands.flaky, (args) =>
  Effect.gen(function* () {
    const processService = yield* AppProcess.Service
    const git = yield* Git.make
    const root = yield* git.run(["rev-parse", "--show-toplevel"]).pipe(Effect.option)
    const cwd = root._tag === "Some" && root.value.exitCode === 0 ? root.value.stdout.toString().trim() : process.cwd()
    const command = args.command
    const runs = Math.max(1, args.runs)
    println(`Running "${command}" ${runs} times...`)
    const codes: number[] = []
    for (let index = 0; index < runs; index++) {
      const child = yield* processService.run(
        ChildProcess.make(command, { shell: true, cwd, stdout: "ignore", stderr: "ignore" }),
      )
      const code = child.exitCode
      codes.push(code)
      println(`  run ${index + 1}/${runs}: ${code === 0 ? "pass" : `fail (exit ${code})`}`)
    }

    const passes = codes.filter((code) => code === 0).length
    const outcome = verdict(codes)
    println()
    println(`${passes}/${runs} passed.`)

    if (outcome === "pass") {
      println("Verdict: stable pass. Not flaky.")
      return
    }
    if (outcome === "fail") {
      println("Verdict: stable fail. This is a real failure, not flakiness.")
      process.exitCode = 1
      return
    }

    println("Verdict: FLAKY. The same command both passed and failed.")
    process.exitCode = 2
    if (!args.quarantine) {
      println(`Record it with: bolt flaky "${command}" --quarantine`)
      return
    }

    const file = path.join(cwd, FILE)
    const count = yield* Effect.tryPromise({
      try: () =>
        Flock.withLock(`bolt-quarantine:${file}`, async () => {
          const existing = fs.existsSync(file)
            ? await Schema.decodeUnknownPromise(
                Schema.fromJsonString(
                  Schema.Array(
                    Schema.Struct({
                      command: Schema.String,
                      passes: Schema.Number,
                      runs: Schema.Number,
                      detected: Schema.Number,
                    }),
                  ),
                ),
              )(fs.readFileSync(file, "utf8"))
            : []
          const entry: Quarantined = { command, passes, runs, detected: Date.now() }
          const merged = [...existing.filter((item) => item.command !== command), entry]
          fs.mkdirSync(path.dirname(file), { recursive: true })
          fs.writeFileSync(file, `${JSON.stringify(merged, null, 2)}\n`)
          return merged.length
        }),
      catch: (cause) => cause,
    })
    println(`Quarantined in ${FILE} (${count} entr${count === 1 ? "y" : "ies"}).`)
  }).pipe(
    Effect.provide(LayerNode.compile(AppProcess.node)),
    Effect.catch((error) =>
      Effect.sync(() => {
        process.stderr.write(errorMessage(error) + "\n")
        process.exitCode ||= 1
      }),
    ),
  ),
)
