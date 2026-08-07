import { cmd } from "../cmd"
import { DoctorCommand } from "./doctor"

export const ConfigCommand = cmd({
  command: "config",
  describe: "inspect and manage configuration",
  builder: (yargs) => yargs.command(DoctorCommand).demandCommand(),
  async handler() {},
})
