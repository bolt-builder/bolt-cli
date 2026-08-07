import { cmd } from "../cmd"
import { DoctorCommand } from "./doctor"
import { GetCommand, SetCommand, UnsetCommand } from "./edit"

export const ConfigCommand = cmd({
  command: "config",
  describe: "inspect and manage configuration",
  builder: (yargs) =>
    yargs.command(DoctorCommand).command(GetCommand).command(SetCommand).command(UnsetCommand).demandCommand(),
  async handler() {},
})
