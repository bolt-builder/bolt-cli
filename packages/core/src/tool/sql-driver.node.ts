import { DatabaseSync } from "node:sqlite"

type Row = Record<string, unknown>

export async function sqlite(file: string, query: string, limit: number): Promise<Row[]> {
  const db = new DatabaseSync(file, { readOnly: true })
  try {
    db.exec("PRAGMA query_only = ON")
    const statement = db.prepare(query)
    const rows: Row[] = []
    for (const row of statement.iterate()) {
      rows.push(row)
      if (rows.length > limit) break
    }
    return rows
  } finally {
    db.close()
  }
}

export async function remote(_target: string, _query: string, _signal: AbortSignal): Promise<Row[]> {
  throw new Error("PostgreSQL/MySQL inspection requires the Bun runtime; local SQLite also works under Node")
}
