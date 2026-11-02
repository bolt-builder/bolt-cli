import { Plugin } from "@opencode/plugin/tui"

export default Plugin.define({
  id: "bolt.clear-history",
  setup(context) {
    context.ui.slot({
      append: "app",
      render() {
        let pending = false
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "session.history.clear",
              title: "Clear session history",
              group: "Session",
              palette: true,
              slash: { name: "clear-data", aliases: ["clear-history"] },
              async run() {
                if (pending) return
                pending = true
                try {
                  const ids = new Set<string>()
                  let cursor: string | undefined
                  do {
                    const page = await context.client.session.list({
                      parentID: null,
                      limit: 100,
                      ...(cursor ? { cursor } : { order: "desc" }),
                    })
                    for (const session of page.data) ids.add(session.id)
                    cursor = page.cursor.next ?? undefined
                  } while (cursor)
                  if (!ids.size) {
                    context.ui.toast.show({ variant: "info", message: "No session history to clear" })
                    return
                  }
                  const confirmation = await context.ui.dialog.prompt({
                    title: "Clear session history",
                    description:
                      `Permanently delete ${ids.size} conversations and their child sessions from the connected Bolt server? ` +
                      "Settings, credentials, project files and memory are preserved. This does not delete provider-held data or reset Zen usage limits.",
                    placeholder: "Type DELETE to confirm",
                  })
                  if (confirmation !== "DELETE") return
                  const removed = new Set<string>()
                  const failures: string[] = []
                  for (const sessionID of ids) {
                    await context.client.session.remove({ sessionID }).then(
                      () => removed.add(sessionID),
                      () => failures.push(sessionID),
                    )
                  }
                  const route = context.ui.router.current()
                  if (route.type === "session" && removed.has(route.sessionID))
                    context.ui.router.navigate({ type: "home" })
                  context.ui.toast.show({
                    variant: failures.length ? "error" : "success",
                    message: failures.length
                      ? `Deleted ${removed.size} conversations; ${failures.length} could not be deleted. Run /clear-data to retry.`
                      : `Deleted ${removed.size} conversations`,
                  })
                } catch (error) {
                  context.ui.toast.show({ variant: "error", message: String(error) })
                } finally {
                  pending = false
                }
              },
            },
          ],
        }))
        return null
      },
    })
  },
})
