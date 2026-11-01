import { EOL } from "os"

/**
 * Porcelain output contract: line-oriented and grep-safe, with a shape that
 * never changes between versions. Every record is one line of tab-separated
 * fields; the first field names the record kind. Backslashes, tabs, newlines,
 * and carriage returns inside a field are escaped, so one record is always
 * exactly one line. New record kinds may be appended over time, but existing
 * kinds never change their field order or meaning.
 */
export const DESCRIBE =
  "guarantee line-oriented, grep-safe output that never changes shape between versions (one record per line, tab-separated fields, first field is the record kind)"

export function escape(value: string) {
  return value.replaceAll("\\", "\\\\").replaceAll("\t", "\\t").replaceAll("\n", "\\n").replaceAll("\r", "\\r")
}

export function line(...fields: string[]) {
  return fields.map(escape).join("\t")
}

export function print(...fields: string[]) {
  process.stdout.write(line(...fields) + EOL)
}

export * as Porcelain from "./porcelain"
