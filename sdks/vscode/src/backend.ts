import { spawn } from "node:child_process"
import { readFile } from "node:fs/promises"
import { createInterface } from "node:readline"
import os from "node:os"
import path from "node:path"

// Manages the Bolt server the sidebar talks to: attaches to bolt.server.url
// when set, otherwise spawns `bolt serve` for the window and parses the
// listening address from its stdout. At most one child per window; at most
// two automatic restarts after unexpected exits.

export type Connection = { url: string; password?: string }

export type Child = {
  onLine: (handler: (line: string) => void) => void
  onExit: (handler: () => void) => void
  kill: () => void
}

export type Spawner = (binary: string, cwd: string | undefined) => Child

export class Backend {
  private child: Child | undefined
  private starting: Promise<Connection | undefined> | undefined
  private connection: Connection | undefined
  private restarts = 0
  private disposed = false

  constructor(
    private input: {
      url: () => string
      binary: () => Promise<string | undefined>
      spawn: Spawner
      log: (text: string) => void
      onExit: (fatal: boolean) => void
    },
  ) {}

  // Resolves the connection, spawning the server when needed. Concurrent
  // callers share one startup so a window never spawns two servers.
  start(cwd?: string): Promise<Connection | undefined> {
    if (this.connection) {
      return Promise.resolve(this.connection)
    }
    if (!this.starting) {
      this.starting = this.connect(cwd).finally(() => {
        this.starting = undefined
      })
    }
    return this.starting
  }

  dispose() {
    this.disposed = true
    this.child?.kill()
    this.child = undefined
    this.connection = undefined
  }

  private async connect(cwd?: string): Promise<Connection | undefined> {
    const url = this.input.url()
    if (url) {
      this.input.log(`attaching to configured server url ${url}`)
      this.connection = { url, password: await password() }
      return this.connection
    }

    const binary = await this.input.binary()
    if (!binary) {
      return undefined
    }

    this.input.log(`spawning ${binary} serve`)
    const child = this.input.spawn(binary, cwd)
    this.child = child

    const listening = await new Promise<string | undefined>((resolve) => {
      const timeout = setTimeout(() => resolve(undefined), 30_000)
      child.onLine((line) => {
        this.input.log(`serve: ${line}`)
        const match = line.match(/server listening on (\S+)/)
        if (match) {
          clearTimeout(timeout)
          resolve(match[1])
        }
      })
      child.onExit(() => {
        clearTimeout(timeout)
        resolve(undefined)
        this.exited()
      })
    })

    if (!listening) {
      this.input.log("server did not report a listening address")
      return undefined
    }
    this.connection = { url: listening, password: await password() }
    this.input.log(`server ready at ${listening}`)
    return this.connection
  }

  private exited() {
    if (this.disposed) {
      return
    }
    this.child = undefined
    this.connection = undefined
    this.input.log(`server exited unexpectedly (restarts so far: ${this.restarts})`)
    if (this.restarts >= 2) {
      this.input.onExit(true)
      return
    }
    this.restarts++
    this.input.onExit(false)
  }
}

// The serve command authenticates with the private credential the CLI keeps
// in its state directory; read it so the sidebar can send the same Basic
// auth header the CLI's own clients use.
async function password() {
  const state = process.env["XDG_STATE_HOME"] ?? path.join(os.homedir(), ".local", "state")
  return readFile(path.join(state, "opencode", "password"), "utf8").then(
    (value) => value.trim(),
    () => undefined,
  )
}

// Real child process spawner used outside tests.
export function spawner(log: (text: string) => void): Spawner {
  return (binary, cwd) => {
    const child = spawn(binary, ["serve"], { cwd, stdio: ["ignore", "pipe", "pipe"] })
    const lines = createInterface({ input: child.stdout })
    const errors = createInterface({ input: child.stderr })
    errors.on("line", (line) => log(`serve stderr: ${line}`))
    return {
      onLine: (handler) => lines.on("line", handler),
      onExit: (handler) => child.on("exit", () => handler()),
      kill: () => child.kill(),
    }
  }
}
