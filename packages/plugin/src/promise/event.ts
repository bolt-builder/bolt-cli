import type { EventApi } from "@bolt-ai/client/promise/api"

export interface EventDomain extends Pick<EventApi, "subscribe"> {}
