/** Quote one argument for the selected shell without changing the caller's command. */
export function quote(value: string, powershell = false) {
  if (/^[a-zA-Z0-9_./:=,-]+$/.test(value)) return value
  return powershell ? `'${value.replaceAll("'", "''")}'` : `'${value.replaceAll("'", "'\\''")}'`
}
