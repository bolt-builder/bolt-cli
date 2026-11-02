// @ts-nocheck

import { Bolt } from "@bolt-ai/core"
import { ReadTool } from "@bolt-ai/core/tools"

const bolt = Bolt.make({})

bolt.tool.add(ReadTool)

bolt.tool.add({
  name: "bash",
  schema: {
    type: "object",
    properties: {
      command: {
        type: "string",
        description: "The command to run.",
      },
    },
    required: ["command"],
  },
  execute(input, ctx) {},
})

bolt.auth.add({
  provider: "openai",
  type: "api",
  value: process.env.OPENAI_API_KEY,
})

bolt.agent.add({
  name: "build",
  permissions: [],
  model: {
    id: "gpt-5-5",
    provider: "openai",
    variant: "xhigh",
  },
})

const sessionID = await bolt.session.create({
  agent: "build",
})

bolt.subscribe((event) => {
  console.log(event)
})

await bolt.session.prompt({
  sessionID,
  text: "hey what is up",
})

await bolt.session.prompt({
  sessionID,
  text: "what is up with this",
  files: [
    {
      mime: "image/png",
      uri: "data:image/png;base64,xxxx",
    },
  ],
})

await bolt.session.wait()

console.log(await bolt.session.messages(sessionID))
