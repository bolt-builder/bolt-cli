import { describe, expect, test } from "bun:test"
import { classify, render, sanitize, tables, validate } from "../../src/tool/sql"

describe("validate", () => {
  test("accepts a plain select", () => {
    expect(validate("SELECT 1")).toEqual({ ok: true })
    expect(validate("select id, name from users where id = 1")).toEqual({ ok: true })
  })

  test("accepts a trailing semicolon", () => {
    expect(validate("SELECT 1;")).toEqual({ ok: true })
    expect(validate("SELECT 1 ;  ")).toEqual({ ok: true })
  })

  test("accepts WITH, EXPLAIN, and PRAGMA statements", () => {
    expect(validate("WITH t AS (SELECT 1 AS n) SELECT n FROM t")).toEqual({ ok: true })
    expect(validate("EXPLAIN SELECT * FROM users")).toEqual({ ok: true })
    expect(validate("EXPLAIN QUERY PLAN SELECT * FROM users")).toEqual({ ok: true })
    expect(validate("PRAGMA table_info(users)")).toEqual({ ok: true })
  })

  test("rejects stacked statements", () => {
    expect(validate("SELECT 1; DROP TABLE x").ok).toBe(false)
    expect(validate("SELECT 1;;").ok).toBe(false)
    expect(validate("SELECT 1; SELECT 2").ok).toBe(false)
  })

  test("rejects write statements", () => {
    expect(validate("INSERT INTO users VALUES (1)").ok).toBe(false)
    expect(validate("UPDATE users SET name = 'x'").ok).toBe(false)
    expect(validate("DELETE FROM users").ok).toBe(false)
    expect(validate("DROP TABLE users").ok).toBe(false)
    expect(validate("CREATE TABLE t (id int)").ok).toBe(false)
    expect(validate("TRUNCATE users").ok).toBe(false)
  })

  test("rejects writes hidden behind allowed prefixes", () => {
    expect(validate("WITH t AS (SELECT 1) DELETE FROM users").ok).toBe(false)
    expect(validate("WITH t AS (DELETE FROM users RETURNING *) SELECT * FROM t").ok).toBe(false)
    expect(validate("EXPLAIN ANALYZE DELETE FROM users").ok).toBe(false)
    expect(validate("SELECT * FROM users INTO OUTFILE '/tmp/x'").ok).toBe(false)
    expect(validate("SELECT 1 FOR UPDATE").ok).toBe(false)
  })

  test("rejects sqlite side effects", () => {
    expect(validate("ATTACH DATABASE '/tmp/x' AS x").ok).toBe(false)
    expect(validate("VACUUM").ok).toBe(false)
    expect(validate("PRAGMA journal_mode = WAL").ok).toBe(false)
  })

  test("ignores injection payloads inside string literals", () => {
    expect(validate("SELECT '; DROP TABLE users;--'")).toEqual({ ok: true })
    expect(validate("SELECT 'DELETE FROM users'")).toEqual({ ok: true })
    expect(validate(`SELECT 'it''s; fine'`)).toEqual({ ok: true })
    expect(validate(`SELECT 'a\\'; DROP TABLE x;--'`)).toEqual({ ok: true })
  })

  test("ignores semicolons and keywords inside comments", () => {
    expect(validate("SELECT 1 -- ; DROP TABLE users")).toEqual({ ok: true })
    expect(validate("SELECT /* ; DELETE FROM users */ 1")).toEqual({ ok: true })
  })

  test("still sees statements after comments and literals", () => {
    expect(validate("SELECT 1 /* x */; DROP TABLE users").ok).toBe(false)
    expect(validate("SELECT 'x'; DROP TABLE users").ok).toBe(false)
    expect(validate("SELECT 1 -- comment\n; DROP TABLE users").ok).toBe(false)
  })

  test("handles dollar-quoted strings", () => {
    expect(validate("SELECT $$; DROP TABLE users$$")).toEqual({ ok: true })
    expect(validate("SELECT $tag$DELETE FROM users$tag$")).toEqual({ ok: true })
    expect(validate("SELECT $1 FROM users WHERE id = $1")).toEqual({ ok: true })
  })

  test("rejects unterminated constructs", () => {
    expect(validate("SELECT 'abc").ok).toBe(false)
    expect(validate("SELECT /* abc")?.ok).toBe(false)
    expect(validate("SELECT $$abc").ok).toBe(false)
  })

  test("rejects empty input", () => {
    expect(validate("").ok).toBe(false)
    expect(validate("   ;  ").ok).toBe(false)
  })

  test("does not flag identifiers containing keyword substrings", () => {
    expect(validate("SELECT updated_at, created_at FROM insert_log")).toEqual({ ok: true })
    expect(validate("SELECT * FROM t OFFSET 10")).toEqual({ ok: true })
  })

  test("rejects other statement heads outright", () => {
    expect(validate("VALUES (1)").ok).toBe(false)
    expect(validate("SHOW TABLES").ok).toBe(false)
    expect(validate("GRANT ALL ON users TO x").ok).toBe(false)
  })
})

describe("classify", () => {
  test("detects engines from the connection string", () => {
    expect(classify("postgres://u:p@host/db")).toBe("postgres")
    expect(classify("postgresql://host/db")).toBe("postgres")
    expect(classify("mysql://host/db")).toBe("mysql")
    expect(classify("mariadb://host/db")).toBe("mysql")
    expect(classify("./data/app.db")).toBe("sqlite")
    expect(classify("sqlite:///tmp/app.db")).toBe("sqlite")
  })
})

describe("sanitize", () => {
  test("redacts passwords in connection urls", () => {
    expect(sanitize("postgres://user:secret@host:5432/db")).toBe("postgres://user:redacted@host:5432/db")
  })

  test("leaves credential-free targets alone", () => {
    expect(sanitize("postgres://host/db")).toBe("postgres://host/db")
    expect(sanitize("./data/app.db")).toBe("./data/app.db")
    expect(sanitize("sqlite://data/app.db")).toBe("data/app.db")
  })
})

describe("render", () => {
  test("renders one JSON object per row", () => {
    expect(render([{ id: 1 }, { id: 2 }], 2, 50)).toBe('{"id":1}\n{"id":2}')
  })

  test("notes when rows are capped", () => {
    expect(render([{ id: 1 }], 5, 1)).toBe('{"id":1}\n(showing first 1 of 5 fetched rows)')
  })

  test("handles empty results", () => {
    expect(render([], 0, 50)).toBe("no rows")
  })
})

describe("tables", () => {
  test("groups columns by table", () => {
    const rows = [
      { table_name: "users", column_name: "id", data_type: "INTEGER" },
      { table_name: "users", column_name: "name", data_type: "TEXT" },
      { table_name: "posts", column_name: "id", data_type: "INTEGER" },
    ]
    expect(tables(rows)).toBe("users\n  id INTEGER\n  name TEXT\n\nposts\n  id INTEGER")
  })

  test("handles empty schemas", () => {
    expect(tables([])).toBe("no tables found")
  })
})
