/** Convert the browser's computed RGB color to Electron's hexadecimal format. */
export function windowBackground(color: string) {
  const match = /^rgba?\(\s*(\d+),\s*(\d+),\s*(\d+)(?:,\s*(0(?:\.\d+)?|1(?:\.0+)?))?\s*\)$/.exec(color)

  if (!match) return undefined

  const channels = match.slice(1, 4).map(Number)

  if (channels.some((channel) => channel > 255)) return undefined

  const alpha =
    match[4] === undefined
      ? ""
      : Math.round(Number(match[4]) * 255)
          .toString(16)
          .padStart(2, "0")

  return `#${alpha}${channels.map((channel) => channel.toString(16).padStart(2, "0")).join("")}`
}
