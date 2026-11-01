import { EventEmitter } from "events"
import { Identifier } from "@/id/id"

export type GlobalEvent = {
  directory?: string
  project?: string
  workspace?: string
  payload: any
}

class GlobalBusEmitter extends EventEmitter<{
  event: [GlobalEvent]
}> {
  override emit<K>(eventName: "event" | K, ...args: K extends "event" ? [GlobalEvent] : never): boolean {
    const base = super.emit as (eventName: unknown, ...args: unknown[]) => boolean
    if (eventName !== "event") return base(eventName, ...(args as unknown[]))
    const [event] = args
    if (event.payload && typeof event.payload === "object" && !("id" in event.payload)) {
      event.payload.id = event.payload.syncEvent?.id ?? Identifier.create("evt", "ascending")
    }
    return super.emit("event", event)
  }
}

export const GlobalBus = new GlobalBusEmitter()
