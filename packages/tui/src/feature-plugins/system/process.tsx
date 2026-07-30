import type { TuiPlugin, TuiPluginApi } from "@opencode-ai/plugin/tui"
import type { BackgroundJob } from "@opencode-ai/sdk/v2"
import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { useTerminalDimensions } from "@opentui/solid"
import { createMemo, createSignal, onCleanup, onMount, Show } from "solid-js"
import type { BuiltinTuiPlugin } from "../builtins"
import { DialogSelect, type DialogSelectOption } from "../../ui/dialog-select"
import { useBindings } from "../../keymap"
import { Locale } from "../../util/locale"
import { getScrollAcceleration } from "../../util/scroll"

const id = "internal:process"

type Info = BackgroundJob
type Theme = TuiPluginApi["theme"]["current"]

function terminal(item: Info) {
  return item.status !== "running"
}

function rank(item: Info) {
  if (item.status === "running") return 0
  if (item.status === "error") return 1
  return 2
}

function tone(item: Info, theme: Theme) {
  if (item.status === "running") return theme.success
  if (item.status === "error") return theme.error
  return theme.textMuted
}

function label(item: Info) {
  return item.title?.trim() || item.type
}

function sort(list: readonly Info[]) {
  return list.toSorted((a, b) => rank(a) - rank(b) || b.started_at - a.started_at || a.id.localeCompare(b.id))
}

function useJobs(api: TuiPluginApi) {
  const [jobs, setJobs] = createSignal<Info[]>([])
  const [error, setError] = createSignal<string>()
  const [busy, setBusy] = createSignal<string>()

  const load = async () => {
    try {
      const result = await api.client.experimental.job.list(undefined, { throwOnError: true })
      setJobs([...(result.data ?? [])])
      setError(undefined)
    } catch (err) {
      setError(String(err))
    }
  }

  const cancel = async (item: Info) => {
    if (busy() || terminal(item)) return
    setBusy(item.id)
    try {
      await api.client.experimental.job.cancel({ jobID: item.id }, { throwOnError: true })
      await load()
    } catch (err) {
      api.ui.toast({ variant: "error", title: "Failed to cancel process", message: String(err) })
    } finally {
      setBusy(undefined)
    }
  }

  onMount(() => {
    void load()
    const timer = setInterval(() => void load(), 2000)
    onCleanup(() => clearInterval(timer))
  })

  return { jobs, error, busy, cancel }
}

function DialogProcessList(props: { api: TuiPluginApi }) {
  const state = useJobs(props.api)
  const theme = () => props.api.theme.current
  const list = createMemo(() => sort(state.jobs()))

  const options = createMemo<DialogSelectOption<string>[]>(() =>
    list().map((item) => ({
      title: Locale.truncate(label(item), 92),
      value: item.id,
      description: item.type,
      footer: state.busy() === item.id ? "cancelling..." : item.status,
      gutter: () => <text fg={tone(item, theme())}>*</text>,
    })),
  )

  onMount(() => {
    props.api.ui.dialog.setSize("large")
  })

  return (
    <DialogSelect
      title="Background Processes"
      options={options()}
      skipFilter={options().length === 0}
      emptyView={<text fg={state.error() ? theme().error : theme().textMuted}>{state.error() ?? "No background processes"}</text>}
      onSelect={(option) => {
        props.api.ui.dialog.replace(() => (
          <DialogProcessDetail
            api={props.api}
            id={option.value}
            back={() => props.api.ui.dialog.replace(() => <DialogProcessList api={props.api} />)}
          />
        ))
      }}
      actions={[
        {
          command: "process.cancel",
          title: "cancel",
          onTrigger: (option) => {
            const item = list().find((job) => job.id === option.value)
            if (item) void state.cancel(item)
          },
        },
      ]}
      bindings={[{ key: "ctrl+o", cmd: "process.cancel", desc: "Cancel process" }]}
    />
  )
}

function DialogProcessDetail(props: { api: TuiPluginApi; id: string; back: () => void }) {
  const state = useJobs(props.api)
  const theme = () => props.api.theme.current
  const dimensions = useTerminalDimensions()
  const item = createMemo(() => state.jobs().find((job) => job.id === props.id))
  const height = createMemo(() => Math.max(4, Math.floor(dimensions().height / 2) - 12))
  const scroll = createMemo(() => getScrollAcceleration(props.api.tuiConfig))
  const busy = createMemo(() => state.busy() === props.id)
  const stopped = createMemo(() => {
    const job = item()
    return job ? terminal(job) : true
  })
  let box: ScrollBoxRenderable | undefined

  onMount(() => {
    props.api.ui.dialog.setSize("large")
  })

  useBindings(() => ({
    bindings: [
      { key: "backspace", desc: "Back", group: "Process", cmd: props.back },
      {
        key: "ctrl+o",
        desc: "Cancel process",
        group: "Process",
        cmd: () => {
          const job = item()
          if (job) void state.cancel(job)
        },
      },
      { key: "pageup", desc: "Scroll up", group: "Process", cmd: () => box?.scrollBy(-height()) },
      { key: "pagedown", desc: "Scroll down", group: "Process", cmd: () => box?.scrollBy(height()) },
    ],
  }))

  return (
    <box paddingLeft={4} paddingRight={4} paddingBottom={1} gap={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme().text} attributes={TextAttributes.BOLD}>
          {item() ? Locale.truncate(label(item()!), 92) : "Background Process"}
        </text>
        <text fg={theme().textMuted} onMouseUp={() => props.api.ui.dialog.clear()}>
          esc
        </text>
      </box>
      <Show when={item()} fallback={<text fg={theme().textMuted}>Process is no longer tracked.</text>}>
        {(job) => (
          <>
            <box>
              <text fg={theme().textMuted} wrapMode="word">
                Name: {label(job())}
              </text>
              <text fg={theme().textMuted}>
                Status:{" "}
                <span style={{ fg: tone(job(), theme()), attributes: TextAttributes.BOLD }}>{job().status}</span>
              </text>
              <text fg={theme().textMuted}>Type: {job().type}</text>
              <text fg={theme().textMuted}>Started: {Locale.datetime(job().started_at)}</text>
              <Show when={job().completed_at}>
                {(done) => <text fg={theme().textMuted}>Ended: {Locale.datetime(done())}</text>}
              </Show>
              <Show when={job().error}>
                {(reason) => (
                  <text fg={theme().error} wrapMode="word">
                    Error: {reason()}
                  </text>
                )}
              </Show>
            </box>
            <box>
              <text fg={theme().text} attributes={TextAttributes.BOLD}>
                Output
              </text>
              <scrollbox
                ref={(ref: ScrollBoxRenderable) => (box = ref)}
                height={height()}
                scrollAcceleration={scroll()}
                stickyScroll={true}
                stickyStart="bottom"
                verticalScrollbarOptions={{ visible: true }}
              >
                <Show when={job().output} fallback={<text fg={theme().textMuted}>No output yet</text>}>
                  {(text) => (
                    <text fg={theme().text} wrapMode="word">
                      {text()}
                    </text>
                  )}
                </Show>
              </scrollbox>
            </box>
            <box flexDirection="row" justifyContent="space-between" paddingTop={1}>
              <box flexDirection="row" gap={2}>
                <text fg={theme().text} onMouseUp={props.back}>
                  <span style={{ attributes: TextAttributes.BOLD }}>back</span>{" "}
                  <span style={{ fg: theme().textMuted }}>backspace</span>
                </text>
                <text
                  fg={busy() || stopped() ? theme().textMuted : theme().text}
                  onMouseUp={() => !busy() && !stopped() && void state.cancel(job())}
                >
                  <span style={{ attributes: TextAttributes.BOLD }}>{busy() ? "cancelling" : "cancel"}</span>{" "}
                  <span style={{ fg: theme().textMuted }}>ctrl+o</span>
                </text>
              </box>
              <text fg={theme().textMuted}>pageup/pagedown scroll</text>
            </box>
          </>
        )}
      </Show>
    </box>
  )
}

const tui: TuiPlugin = async (api) => {
  api.keymap.registerLayer({
    commands: [
      {
        namespace: "palette",
        name: "background_job.list",
        title: "Background processes",
        desc: "List and manage background processes",
        category: "Session",
        slashName: "process",
        slashAliases: ["processes"],
        run() {
          api.ui.dialog.replace(() => <DialogProcessList api={api} />)
        },
      },
    ],
  })
}

const plugin: BuiltinTuiPlugin = { id, tui }

export default plugin
