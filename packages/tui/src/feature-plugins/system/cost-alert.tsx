import { Plugin } from "@opencode/plugin/tui"
import { MaxCostNudge, parseCostAlert, costAlertUsage } from "../../util/cost-alert"
import { errorMessage } from "../../util/error"

/** V2 publishes authoritative session costs, so message costs need not be summed again. */
export default Plugin.define({
  id: "bolt.cost-alert",
  setup(context) {
    const nudge = new MaxCostNudge()
    const current = () => {
      const route = context.ui.router.current()
      return route.type === "session" ? route.sessionID : undefined
    }
    const check = (sessionID: string) => {
      const alert = nudge.check(sessionID)
      if (!alert) return
      void context.ui.dialog
        .confirm({
          title: "Session Cost Alert",
          message: `This session crossed your ${MaxCostNudge.formatCost(alert.limit)} alert threshold and cost ${MaxCostNudge.formatCost(alert.cost)}. Keep going?`,
          label: { confirm: "Continue", cancel: "Stop" },
        })
        .then((result) => {
          if (result === undefined) return
          nudge.resolve(sessionID, result ? "continue" : "stop", alert.limit)
          if (!result)
            void context.client.session.interrupt({ sessionID }).catch((error) => context.ui.toast.show({ variant: "error", message: errorMessage(error) }))
        })
    }
    const run = async (input?: string) => {
      const value =
        input?.trim() ||
        (await context.ui.dialog.prompt({
          title: "Session cost alert",
          placeholder: "Dollar amount, or off",
        }))
      if (value === undefined) return
      const command = parseCostAlert(value)
      if (command.type === "invalid" || command.type === "prompt") {
        context.ui.toast.show({ message: costAlertUsage(), variant: "error" })
        return
      }
      const sessionID = current()
      if (command.type === "off") nudge.setLimit(undefined)
      else nudge.setLimit(command.value)
      if (sessionID) nudge.setSessionCost(sessionID, context.data.session.get(sessionID)?.cost ?? 0)
      context.ui.toast.show({
        message:
          command.type === "off"
            ? "Cost alert disabled."
            : `Cost alert set to ${MaxCostNudge.formatCost(nudge.limit!)}.`,
        variant: "success",
      })
      if (sessionID) check(sessionID)
    }
    const dispose = [
      context.data.on("session.usage.updated", (event) => {
        nudge.setSessionCost(event.data.sessionID, event.data.cost)
        check(event.data.sessionID)
      }),
      context.data.on("session.execution.started", (event) => nudge.rearm(event.data.sessionID)),
      context.data.on("session.deleted", (event) => nudge.onSessionDeleted(event.data.sessionID)),
    ]
    context.ui.slot({
      append: "app",
      render() {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "cost.alert",
              title: "Cost alert",
              group: "Session",
              palette: true,
              slash: { name: "cost-alert", aliases: ["cost"], arguments: true },
              run,
            },
          ],
        }))
        return null
      },
    })
    return () => dispose.forEach((cleanup) => cleanup())
  },
})
