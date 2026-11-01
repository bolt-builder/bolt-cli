import { NetGuard } from "../../src/net-guard"

let calls = 0
const fetch = NetGuard.makeFetch(async () => {
  calls++
  if (process.argv[3] === "mixed") return ["127.0.0.1", "169.254.169.254"]
  return [calls === 1 ? "127.0.0.1" : "169.254.169.254"]
})
try {
  const response = await fetch(process.argv[2])
  console.log(JSON.stringify({ calls, status: response.status, text: await response.text() }))
} catch (error) {
  console.log(JSON.stringify({ calls, error: error instanceof Error ? error.message : String(error) }))
}
