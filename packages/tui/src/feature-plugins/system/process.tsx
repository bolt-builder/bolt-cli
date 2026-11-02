import { Plugin } from "@opencode/plugin/tui"
import { BoltProcess } from "@opencode/schema/bolt-process"
import type { SessionMessageInfo } from "@opencode/client"
import { createEffect, createMemo, createSignal, on, onCleanup, onMount, Show } from "solid-js"
import { Keymap } from "../../context/keymap"
import { useLocation } from "../../context/location"
import { useTheme } from "../../context/theme"
import { DialogSelect } from "../../ui/dialog-select"
import { DialogHeader, DialogLayout } from "../../ui/dialog"

export function subagentText(messages: readonly SessionMessageInfo[]) {
  const assistant = messages.findLast((message) => message.type === "assistant")
  if (!assistant) return
  let output = ""
  for (let index = assistant.content.length - 1; index >= 0 && output.length < 65_536; index--) {
    const part = assistant.content[index]
    if (part.type !== "text") continue
    output = (part.text.slice(-65_536) + (output ? `\n\n${output}` : "")).slice(-65_536)
  }
  return output
}

export function Processes(props: { context: Plugin.Context }) {
  const rpc = props.context.client.rpc(BoltProcess.Definition)
  const location = useLocation()
  const theme = useTheme().surface("dialog")
  const [jobs, setJobs] = createSignal<readonly BoltProcess.Info[]>([])
  const [error, setError] = createSignal<string>()
  const [selected, setSelected] = createSignal<string>()
  const [liveOutput, setLiveOutput] = createSignal<string>()
  const [busy, setBusy] = createSignal(false)
  const item = createMemo(() => jobs().find((job) => job.id === selected()))
  const subagentOutput = createMemo(() => {
    const job = item()
    if (job?.type !== "subagent" || job.status !== "running") return
    return subagentText(props.context.data.session.message.list(job.id))
  })
  let loading = false
  let disposed = false
  let locationVersion = 0
  createEffect(on(() => location.ref, () => {
    locationVersion++
    setSelected(undefined)
    setLiveOutput(undefined)
    setJobs([])
    setError(undefined)
  }, { defer: true }))
  const load = async () => {
    if (loading) return
    loading = true
    const version = locationVersion
    await rpc
      .list({}, { location: location.ref })
      .then(
        (result) => {
          if (!disposed && version === locationVersion) {
            setJobs(result)
            setError(undefined)
          }
        },
        (reason) => {
          if (!disposed && version === locationVersion) setError(String(reason))
        },
      )
      .finally(() => {
        loading = false
      })
    const id = selected()
    const current = jobs().find((job) => job.id === id)
    if (version !== locationVersion || !id || current?.status !== "running" || current.type !== "shell") return
    const output = await rpc.output({ id }, { location: location.ref }).catch(() => null)
    if (!disposed && version === locationVersion && selected() === id) setLiveOutput(output ?? undefined)
  }
  const cancel = async (id: string) => {
    if (busy() || jobs().find((job) => job.id === id)?.status !== "running") return
    setBusy(true)
    await rpc
      .cancel({ id }, { location: location.ref })
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
        enabled: () => item()?.status === "running" && !busy(),
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
          onSelect={(option) => {
            setLiveOutput(undefined)
            setSelected(option.value)
            if (
              jobs().find((job) => job.id === option.value)?.type === "subagent" &&
              props.context.data.session.message.list(option.value).length === 0
            )
              void props.context.data.session.message.sync(option.value).catch(() => {})
            void load()
          }}
          actions={[
            {
              command: "process.cancel",
              title: "cancel",
              bind: "ctrl+o",
              disabled: (option) => busy() || jobs().find((job) => job.id === option?.value)?.status !== "running",
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
                disabled: busy() || item()?.status !== "running",
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
                  {(job().status === "running" ? (job().type === "subagent" ? subagentOutput() : liveOutput()) : job().output) || "No output yet"}
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
