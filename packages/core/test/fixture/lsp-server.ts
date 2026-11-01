// Independent JSON-RPC fixture: only stdio and Content-Length, no production parser.
let buffer = Buffer.alloc(0)
const waiting = new Map<number | string, number | string>()
const send = (value: unknown) => {
  const body = Buffer.from(JSON.stringify(value))
  process.stdout.write(`Content-Length: ${body.length}\r\n\r\n`)
  process.stdout.write(body)
}
process.stdin.on("data", (chunk) => {
  buffer = Buffer.concat([buffer, chunk])
  while (true) {
    const end = buffer.indexOf("\r\n\r\n")
    if (end === -1) return
    const length = Number(
      buffer
        .subarray(0, end)
        .toString()
        .match(/Content-Length: (\d+)/i)?.[1],
    )
    if (buffer.length < end + 4 + length) return
    const message = JSON.parse(buffer.subarray(end + 4, end + 4 + length).toString())
    buffer = buffer.subarray(end + 4 + length)
    if (message.method === "echo")
      send({ jsonrpc: "2.0", id: message.id, result: { params: message.params, pid: process.pid } })
    if (message.method === "pending") send({ jsonrpc: "2.0", method: "waiting", params: { id: message.id } })
    if (message.method === "$/cancelRequest") send({ jsonrpc: "2.0", method: "cancelled", params: message.params })
    if (message.method === "ask-client") {
      waiting.set(100, message.id)
      send({ jsonrpc: "2.0", id: 100, method: "workspace/configuration", params: { items: [] } })
    }
    if (message.method === undefined && waiting.has(message.id)) {
      send({ jsonrpc: "2.0", id: waiting.get(message.id), result: message.result })
      waiting.delete(message.id)
    }
    if (message.method === "fail-frame") process.stdout.write("Content-Length: 16777217\r\n\r\n")
    if (message.method === "terminate") {
      process.stderr.write("fixture stopped\n")
      process.exit(7)
    }
  }
})
