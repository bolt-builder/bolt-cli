import { createReactiveTimelineProjection } from "@bolt-ai/session-ui/timeline/projection"

export { reuseTimelineRows } from "@bolt-ai/session-ui/timeline/projection"

export function createTimelineProjection(input: Parameters<typeof createReactiveTimelineProjection>[0]) {
  return createReactiveTimelineProjection(input)
}
