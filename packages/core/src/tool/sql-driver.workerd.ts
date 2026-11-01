type Row = Record<string, unknown>

export async function sqlite(_file: string, _query: string, _limit: number): Promise<Row[]> {
  throw new Error("SQLite inspection requires a local Node or Bun runtime")
}

export async function remote(_target: string, _query: string, _signal: AbortSignal): Promise<Row[]> {
  throw new Error("PostgreSQL/MySQL inspection requires the Bun runtime")
}
