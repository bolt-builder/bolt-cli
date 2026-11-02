import { MaxCostNudge, type MaxCostChoice, type MaxCostMessage } from "../util/cost-alert"
import { useSync } from "./sync"
import { useEvent } from "./event"
import { useSDK } from "./sdk"
import { useDialog } from "../ui/dialog"
import { DialogConfirm } from "../ui/dialog-confirm"
import { createSimpleContext } from "./helper"

export const { use: useNudge, provider: NudgeProvider } = createSimpleContext({
  name: "Nudge",
  init: () => {
    const sync = useSync()
    const event = useEvent()
    const sdk = useSDK()
    const dialog = useDialog()

    const nudge = new MaxCostNudge()
    const seeded = new Set<string>()
    const running = new Set<string>()

    function seed(sid: string): number {
      const total = nudge.resetMessageCosts(sid, (sync.data.message[sid] ?? []) as MaxCostMessage[])
      seeded.add(sid)
      return total
    }

    function cost(sid: string): number {
      if (!seeded.has(sid)) seed(sid)
      return nudge.setSessionCost(sid, sync.session.get(sid)?.cost ?? 0)
    }

    function check(sid: string) {
      if (nudge.limit === undefined) return
      cost(sid)
      const alert = nudge.check(sid)
      if (alert) showCostAlert(sid, alert.limit, alert.cost)
    }

    function abort(sid: string) {
      void sdk.client.session.abort({ sessionID: sid }).catch((err) => console.error("Abort session failed", err))
    }

    function showCostAlert(sid: string, limit: number, cost: number) {
      const message = `This session just went above your ${MaxCostNudge.formatCost(
        limit,
      )} alert threshold and cost ${MaxCostNudge.formatCost(cost)}. Keep going?`
      void DialogConfirm.show(dialog, "Session Cost Alert", message, "Stop").then((result) => {
        // Dismissed via Esc/outside-click: snooze for this run (stays in #alerted) without
        // acking, so the alert re-appears on the next run rather than nagging mid-run.
        if (result === undefined) return
        const choice: MaxCostChoice = result === false ? "stop" : "continue"
        nudge.resolve(sid, choice, limit)
        if (choice === "stop") abort(sid)
      })
    }

    event.subscribe((e) => {
      switch (e.type) {
        case "message.updated": {
          const info = e.properties.info
          const sid = info.sessionID
          if (!seeded.has(sid)) seed(sid)
          const value = info.role === "assistant" ? info.cost : undefined
          nudge.updateMessageCost(sid, info.id, info.role, value)
          check(sid)
          break
        }
        case "message.removed": {
          nudge.removeMessageCost(e.properties.messageID)
          break
        }
        case "session.deleted": {
          nudge.onSessionDeleted(e.properties.info.id)
          seeded.delete(e.properties.info.id)
          running.delete(e.properties.info.id)
          break
        }
        // busy/retry fire repeatedly within one run, so re-arm only on the idle->running edge.
        case "session.status": {
          const sid = e.properties.sessionID
          if (e.properties.status.type === "idle") {
            running.delete(sid)
            break
          }
          if (running.has(sid)) break
          running.add(sid)
          nudge.rearm(sid)
          break
        }
      }
    })

    // sid is optional: the limit is global, so it can be set from the home screen too.
    function setLimit(sid: string | undefined, value: number) {
      const limit = MaxCostNudge.normalizeLimit(value)
      if (limit === undefined) {
        const info = clearLimit(sid)
        return { limit: 0, cost: info.cost }
      }
      nudge.setLimit(limit)
      const total = sid ? cost(sid) : 0
      if (sid) check(sid)
      return { limit, cost: total }
    }

    function clearLimit(sid: string | undefined) {
      nudge.setLimit(undefined)
      return { cost: sid ? cost(sid) : 0 }
    }

    function formatCost(value: number) {
      return MaxCostNudge.formatCost(value)
    }

    return {
      setLimit,
      clearLimit,
      formatCost,
    }
  },
})
