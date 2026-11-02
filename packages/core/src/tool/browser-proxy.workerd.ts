export async function start(): Promise<{ url: string; close(): Promise<void> }> {
  throw new Error("Headless browser capture requires a local Node or Bun runtime")
}
