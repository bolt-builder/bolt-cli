import { TextAttributes, type ScrollBoxRenderable } from "@opentui/core"
import { MEMORY_COMMAND_CATALOG } from "@opencode-ai/memory/commands"
import { MemoryControls } from "@opencode-ai/memory/controls"
import { MemoryToken } from "@opencode-ai/memory/token"
import { createMemo, createResource, For, Match, Show, Switch } from "solid-js"
import { useTerminalDimensions } from "@opentui/solid"
import { useTuiConfig } from "../config"
import { useSDK } from "../context/sdk"
import { useSync } from "../context/sync"
import { useTheme } from "../context/theme"
import { useBindings } from "../keymap"
import { useDialog, type DialogContext } from "../ui/dialog"
import { DialogSelect, type DialogSelectOption } from "../ui/dialog-select"
import { useToast } from "../ui/toast"
import { errorMessage } from "../util/error"
import { getScrollAcceleration } from "../util/scroll"

function fmt(value: number) {
  return value.toLocaleString()
}

function count(text: string) {
  return text.split("\n").filter((line) => line.trim().startsWith("- ")).length
}

function records(text: string) {
  return (text.match(/^record id=/gm) ?? []).length
}

function stored(text: string) {
  return text
    .split("\n")
    .filter((line) => line.trim())
    .map((line) => line.split(":: ").at(-1) ?? line)
    .slice(0, 16)
}

export function showMemoryDialog(dialog: DialogContext) {
  dialog.setSize("large")
  dialog.replace(() => <DialogMemory />)
}

export function showMemoryHelpDialog(dialog: DialogContext, input?: { reason?: string; sessionID?: string }) {
  dialog.setSize("large")
  dialog.replace(() => <DialogMemoryHelp reason={input?.reason} sessionID={input?.sessionID} />)
}

export function showMemoryStatusDialog(dialog: DialogContext) {
  dialog.setSize("large")
  dialog.replace(() => <DialogMemoryStatus />)
}

function MemoryHeaderInfo(props: {
  root: string
  state: {
    enabled: boolean
    scope: string
  }
}) {
  const { theme } = useTheme()
  return (
    <>
      <text fg={theme.text}>
        {props.state.enabled ? "Enabled" : "Disabled"} · {props.state.scope}
      </text>
      <text fg={theme.textMuted} wrapMode="word">
        {props.root}
      </text>
    </>
  )
}

function MemorySourcesInfo(props: {
  sources: {
    project: string
    environment: string
    corrections: string
  }
}) {
  const { theme } = useTheme()
  return (
    <box>
      <text fg={theme.text}>Sources</text>
      <text fg={theme.textMuted}>
        project.md {count(props.sources.project)} · environment.md {count(props.sources.environment)} · corrections.md{" "}
        {count(props.sources.corrections)}
      </text>
    </box>
  )
}

function MemoryItemsInfo(props: { items: string }) {
  const { theme } = useTheme()
  return (
    <box>
      <text fg={theme.text}>Stored memory</text>
      <Show when={stored(props.items).length > 0} fallback={<text fg={theme.textMuted}>No items</text>}>
        <For each={stored(props.items)}>{(line) => <text fg={theme.textMuted}>{line}</text>}</For>
      </Show>
    </box>
  )
}

function draft(usage: string) {
  const head = usage.split(" ")[0]
  if (usage.includes("<") || usage.includes("|")) return `${head} `
  return usage
}

const toggles = ["use", "contribute"] as const

export function DialogMemoryHelp(props: { reason?: string; sessionID?: string }) {
  const sdk = useSDK()
  const sync = useSync()
  const dialog = useDialog()
  const { theme } = useTheme()
  const toast = useToast()
  const metadata = () => (props.sessionID ? sync.session.get(props.sessionID)?.metadata : undefined)

  async function toggle(key: string) {
    const id = props.sessionID
    if (!id) return
    const meta = metadata()
    const result = await sdk.client.session.update({ sessionID: id, metadata: { ...meta, [key]: meta?.[key] === false } })
    if (!result.error) return
    toast.show({ variant: "error", message: `Memory toggle failed: ${errorMessage(result.error)}` })
  }

  function mark(on: boolean) {
    return on ? "[x]" : "[ ]"
  }

  // Session toggle rows flip in place; catalog rows draft the typed command into the prompt.
  const options = createMemo<DialogSelectOption<string>[]>(() => [
    ...(props.sessionID
      ? [
          {
            title: `${mark(MemoryControls.use(metadata()))} Use saved memories in this session`,
            footer: "/memory use on|off",
            category: "Session",
            value: "use",
            onSelect: () => void toggle(MemoryControls.USE),
          },
          {
            title: `${mark(MemoryControls.contribute(metadata()))} Save new memories from this session`,
            footer: "/memory contribute on|off",
            category: "Session",
            value: "contribute",
            onSelect: () => void toggle(MemoryControls.CONTRIBUTE),
          },
        ]
      : []),
    ...MEMORY_COMMAND_CATALOG.filter(
      (item) => !props.sessionID || !toggles.some((verb) => item.usage.startsWith(`${verb} `)),
    ).map((item) => ({
      title: item.description,
      footer: `/memory ${item.usage}`,
      category: "Memory",
      value: item.usage,
    })),
  ])

  return (
    <DialogSelect
      title="Memory"
      options={options()}
      flat
      footer={<Show when={props.reason}>{(reason) => <text fg={theme.error}>{reason()}</text>}</Show>}
      onSelect={async (option) => {
        if (toggles.some((verb) => option.value === verb)) return
        dialog.clear()
        const result = await sdk.client.tui.appendPrompt({ text: `/memory ${draft(option.value)}` })
        if (!result.error) return
        toast.show({ variant: "error", message: `Memory menu failed: ${errorMessage(result.error)}` })
      }}
    />
  )
}

export function DialogMemoryStatus() {
  const sdk = useSDK()
  const dialog = useDialog()
  const { theme } = useTheme()
  const [data, api] = createResource(async () => {
    const result = await sdk.client.memory.show()
    if (result.error) throw new Error(errorMessage(result.error))
    if (!result.data) throw new Error("Memory response had no data")
    return result.data
  })

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Memory Status
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <Switch>
        <Match when={data.loading}>
          <text fg={theme.textMuted}>Loading memory...</text>
        </Match>
        <Match when={data.error}>
          <text fg={theme.error} wrapMode="word">
            {errorMessage(data.error)}
          </text>
        </Match>
        <Match when={data()}>
          {(item) => (
            <box gap={1}>
              <box>
                <MemoryHeaderInfo root={item().root} state={item().state} />
              </box>
              <box>
                <text fg={theme.text}>Auto-save</text>
                <text fg={theme.textMuted}>{item().state.autoConsolidate ? "on" : "off"}</text>
              </box>
              <MemorySourcesInfo sources={item().sources} />
              <MemoryItemsInfo items={item().items} />
              <box>
                <text fg={theme.text}>Index</text>
                <text fg={theme.textMuted}>
                  {fmt(records(item().index))} entries · {fmt(MemoryToken.estimate(item().index))} estimated tokens
                </text>
              </box>
            </box>
          )}
        </Match>
      </Switch>
      <box flexDirection="row" justifyContent="flex-start">
        <text fg={theme.textMuted} onMouseUp={() => void api.refetch()}>
          refresh
        </text>
      </box>
    </box>
  )
}

export function DialogMemory() {
  const sdk = useSDK()
  const dialog = useDialog()
  const { theme } = useTheme()
  const dimensions = useTerminalDimensions()
  const config = useTuiConfig()
  const height = createMemo(() => Math.max(6, Math.min(24, Math.floor(dimensions().height * 0.7) - 5)))
  const scroll = createMemo(() => getScrollAcceleration(config))
  let box: ScrollBoxRenderable | undefined
  const [data, api] = createResource(async () => {
    const result = await sdk.client.memory.show()
    if (result.error) throw new Error(errorMessage(result.error))
    if (!result.data) throw new Error("Memory response had no data")
    return result.data
  })

  useBindings(() => ({
    bindings: [
      { key: "pageup", desc: "Scroll memory up", group: "Memory", cmd: () => box?.scrollBy(-height()) },
      { key: "pagedown", desc: "Scroll memory down", group: "Memory", cmd: () => box?.scrollBy(height()) },
    ],
  }))

  return (
    <box paddingLeft={2} paddingRight={2} gap={1} paddingBottom={1}>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.text} attributes={TextAttributes.BOLD}>
          Memory
        </text>
        <text fg={theme.textMuted} onMouseUp={() => dialog.clear()}>
          esc
        </text>
      </box>
      <scrollbox
        ref={(ref: ScrollBoxRenderable) => (box = ref)}
        height={height()}
        scrollAcceleration={scroll()}
        verticalScrollbarOptions={{ visible: true }}
        viewportOptions={{ paddingRight: 1 }}
      >
        <Switch>
          <Match when={data.loading}>
            <text fg={theme.textMuted}>Loading memory...</text>
          </Match>
          <Match when={data.error}>
            <text fg={theme.error} wrapMode="word">
              {errorMessage(data.error)}
            </text>
          </Match>
          <Match when={data()}>
            {(item) => (
              <box gap={1}>
                <box>
                  <MemoryHeaderInfo root={item().root} state={item().state} />
                </box>
                <MemorySourcesInfo sources={item().sources} />
                <MemoryItemsInfo items={item().items} />
              </box>
            )}
          </Match>
        </Switch>
      </scrollbox>
      <box flexDirection="row" justifyContent="space-between">
        <text fg={theme.textMuted} onMouseUp={() => void api.refetch()}>
          refresh
        </text>
        <text fg={theme.textMuted}>pageup/pagedown scroll</text>
      </box>
    </box>
  )
}
