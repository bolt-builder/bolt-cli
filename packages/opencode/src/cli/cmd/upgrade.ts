import type { Argv } from "yargs"
import { UI } from "../ui"
import * as prompts from "@clack/prompts"
import { Installation } from "../../installation"
import { UpdateJournal } from "../../installation/journal"
import { InstallationVersion } from "@opencode-ai/core/installation/version"

export const UpgradeCommand = {
  command: "upgrade [target]",
  aliases: ["update"],
  describe: "upgrade bolt to the latest or a specific version",
  builder: (yargs: Argv) => {
    return yargs
      .positional("target", {
        describe: "version to upgrade to, for ex '0.1.48' or 'v0.1.48'",
        type: "string",
      })
      .option("method", {
        alias: "m",
        describe: "installation method to use",
        type: "string",
        choices: ["curl", "npm", "pnpm", "bun", "brew", "choco", "scoop"],
      })
      .option("channel", {
        describe: "release channel to follow",
        type: "string",
        choices: ["stable", "beta", "nightly"],
      })
      .option("undo", {
        describe: "roll back to the previously installed version",
        type: "boolean",
      })
      .conflicts("undo", "channel")
      .conflicts("undo", "target")
  },
  handler: async (args: { target?: string; method?: string; channel?: string; undo?: boolean }) => {
    UI.empty()
    UI.println(UI.logo("  "))
    UI.empty()
    prompts.intro(args.undo ? "Rollback" : "Upgrade")
    const journal = await UpdateJournal.read()
    if (args.undo && !journal) {
      prompts.log.error("No previous update recorded; nothing to roll back to")
      prompts.outro("Done")
      process.exitCode = 1
      return
    }
    const detectedMethod = await Installation.method()
    const method = (args.method as Installation.Method) ?? detectedMethod
    if (method === "unknown") {
      prompts.log.error(`bolt is installed to ${process.execPath} and may be managed by a package manager`)
      const install = await prompts.select({
        message: "Install anyways?",
        options: [
          { label: "Yes", value: true },
          { label: "No", value: false },
        ],
        initialValue: false,
      })
      if (!install) {
        prompts.outro("Done")
        return
      }
    }
    prompts.log.info("Using method: " + method)
    if (args.channel) prompts.log.info("Using channel: " + args.channel)
    const target = args.undo
      ? journal!.previous
      : args.target
        ? args.target.replace(/^v/, "")
        : await Installation.latest(method, args.channel as Installation.Channel | undefined)

    if (InstallationVersion === target) {
      prompts.log.warn(`bolt upgrade skipped: ${target} is already installed`)
      prompts.outro("Done")
      return
    }

    prompts.log.info(`From ${InstallationVersion} → ${target}`)
    const spinner = prompts.spinner()
    spinner.start(args.undo ? "Rolling back..." : "Upgrading...")
    const err = await Installation.upgrade(method, target).catch((err) => err)
    if (err) {
      spinner.stop(args.undo ? "Rollback failed" : "Upgrade failed", 1)
      if (err instanceof Installation.UpgradeFailedError) {
        // necessary because choco only allows install/upgrade in elevated terminals
        if (method === "choco" && err.stderr.includes("not running from an elevated command shell")) {
          prompts.log.error("Please run the terminal as Administrator and try again")
        } else {
          prompts.log.error(err.stderr)
        }
      } else if (err instanceof Error) prompts.log.error(err.message)
      prompts.outro("Done")
      return
    }
    // Record the transition so `bolt update --undo` can restore the version
    // that was running before this change.
    await UpdateJournal.write({
      previous: InstallationVersion,
      current: target,
      method,
      time: Date.now(),
    }).catch(() => {})
    spinner.stop(args.undo ? "Rollback complete" : "Upgrade complete")
    prompts.outro("Done")
  },
}
