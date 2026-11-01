type Row = Record<string, unknown>

export async function sqlite(file: string, query: string, limit: number) {
  const { Database } = await import("bun:sqlite")
  const db = new Database(file, { readonly: true })
  try {
    db.exec("PRAGMA query_only = ON")
    const statement = db.query<Row, []>(query)
    if (!statement.readonly) throw new Error("query rejected: SQLite reports a write-capable statement")
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

export async function remote(target: string, query: string, signal: AbortSignal) {
  const db = new Bun.SQL({ url: target.replace(/^mariadb:/i, "mysql:"), max: 1, connectionTimeout: 10 })
  const close = () => {
    void db.close({ timeout: 0 }).catch(() => {})
  }
  signal.addEventListener("abort", close, { once: true })
  try {
    if (signal.aborted) throw new Error("SQL request interrupted")
    return await db.begin("READ ONLY", async (sql) => {
      return await sql.unsafe<Row[]>(query)
    })
  } finally {
    signal.removeEventListener("abort", close)
    await db.close({ timeout: 0 })
  }
}
