import { Plugin } from "@opencode/plugin/tui"
import { BoltProcess } from "@opencode/schema/bolt-process"
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import { Keymap } from "../../context/keymap"
import { useTheme } from "../../context/theme"
import { DialogSelect } from "../../ui/dialog-select"
import { DialogHeader, DialogLayout } from "../../ui/dialog"

function Processes(props: { context: Plugin.Context }) {
  const rpc = props.context.client.rpc(BoltProcess.Definition)
  const theme = useTheme().surface("dialog")
  const [jobs, setJobs] = createSignal<readonly BoltProcess.Info[]>([])
  const [error, setError] = createSignal<string>()
  const [selected, setSelected] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)
  const item = createMemo(() => jobs().find((job) => job.id === selected()))
  let loading = false
  let disposed = false
  const load = async () => {
    if (loading) return
    loading = true
    await rpc
      .list({})
      .then(
        (result) => {
          if (!disposed) {
            setJobs(result)
            setError(undefined)
          }
        },
        (reason) => {
          if (!disposed) setError(String(reason))
        },
      )
      .finally(() => {
        loading = false
      })
  }
  const cancel = async (id: string) => {
    if (busy() || jobs().find((job) => job.id === id)?.status !== "running") return
    setBusy(true)
    await rpc
      .cancel({ id })
      .then(load, (reason) => props.context.ui.toast.show({ variant: "error", message: String(reason) }))
      .finally(() => setBusy(false))
  }
  onMount(() => {
    void load()
    const timer = setInterval(() => void load(), 2000)
    onCleanup(() => {
      disposed = true
      clearInterval(timer)
    })
    props.context.ui.dialog.set({ size: "large" })
  })
  Keymap.createLayer(() => ({
    mode: "modal",
    enabled: selected() !== undefined,
    commands: [
      { bind: "backspace", title: "Back to processes", run: () => setSelected(undefined) },
      {
        bind: "ctrl+o",
        title: "Cancel process",
        run: () => {
          const id = selected()
          if (id) void cancel(id)
        },
      },
    ],
  }))
  const list = createMemo(() =>
    jobs().toSorted(
      (a, b) => Number(b.status === "running") - Number(a.status === "running") || b.started_at - a.started_at,
    ),
  )
  return (
    <Show
      when={selected()}
      fallback={
        <DialogSelect
          title="Background Processes"
          options={list().map((job) => ({
            title: job.title?.trim() || job.type,
            value: job.id,
            description: job.type,
            footer: job.status,
          }))}
          emptyView={
            <text fg={error() ? theme.text.feedback.error.base : theme.text.muted}>
              {error() ?? "No background processes"}
            </text>
          }
          onSelect={(option) => setSelected(option.value)}
          actions={[
            {
              command: "process.cancel",
              title: "cancel",
              bind: "ctrl+o",
              onTrigger: (option) => void cancel(option.value),
            },
          ]}
        />
      }
    >
      <DialogLayout
        header={<DialogHeader title={item()?.title || "Background Process"} />}
        footer={{
          actions: {
            primary: [
              { title: "back", key: "backspace", onTrigger: () => setSelected(undefined) },
              {
                title: busy() ? "cancelling…" : "cancel",
                key: "ctrl+o",
                onTrigger: () => {
                  const id = selected()
                  if (id) void cancel(id)
                },
              },
            ],
          },
        }}
      >
        <Show when={item()} fallback={<text fg={theme.text.muted}>{error() ?? "Process is no longer tracked."}</text>}>
          {(job) => (
            <box gap={1}>
              <text fg={theme.text.base}>
                Status: {job().status} · Type: {job().type}
              </text>
              <text fg={theme.text.muted}>Started: {new Date(job().started_at).toLocaleString()}</text>
              <Show when={job().error}>{(reason) => <text fg={theme.text.feedback.error.base}>{reason()}</text>}</Show>
              <scrollbox height={12} stickyScroll stickyStart="bottom" scrollbarOptions={{ visible: true }}>
                <text fg={theme.text.base} wrapMode="word">
                  {job().output || "No output yet"}
                </text>
              </scrollbox>
            </box>
          )}
        </Show>
      </DialogLayout>
    </Show>
  )
}

export default Plugin.define({
  id: "bolt.process",
  setup(context) {
    context.ui.slot({
      append: "app",
      render() {
        context.keymap.layer(() => ({
          mode: "global",
          commands: [
            {
              id: "background_job.list",
              title: "Background processes",
              group: "Session",
              palette: true,
              slash: { name: "process", aliases: ["processes"] },
              run: () => context.ui.dialog.show(() => <Processes context={context} />),
            },
          ],
        }))
        return null
      },
    })
  },
})
