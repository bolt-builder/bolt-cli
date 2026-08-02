export const EmptyBorder = {
  topLeft: "",
  bottomLeft: "",
  vertical: "",
  topRight: "",
  bottomRight: "",
  horizontal: " ",
  bottomT: "",
  topT: "",
  cross: "",
  leftT: "",
  rightT: "",
}

// Chunky full-block frame with quarter-block corners that read as rounded.
export const GlowBorder = {
  topLeft: "▗",
  topRight: "▖",
  bottomLeft: "▝",
  bottomRight: "▘",
  horizontal: "█",
  vertical: "█",
  topT: "█",
  bottomT: "█",
  leftT: "█",
  rightT: "█",
  cross: "█",
}

export const SplitBorder = {
  border: ["left" as const, "right" as const],
  customBorderChars: {
    ...EmptyBorder,
    vertical: "┃",
  },
}
