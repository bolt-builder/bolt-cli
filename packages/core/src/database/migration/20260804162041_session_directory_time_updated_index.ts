import { Effect } from "effect"
import type { DatabaseMigration } from "../migration"

export default {
  id: "20260804162041_session_directory_time_updated_index",
  up(tx) {
    return Effect.gen(function* () {
      yield* tx.run(
        `CREATE INDEX \`session_directory_time_updated_idx\` ON \`session\` (\`directory\`,\`time_updated\`,\`id\`);`,
      )
    })
  },
} satisfies DatabaseMigration.Migration
