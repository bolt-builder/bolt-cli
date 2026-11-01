import { createEffect, createMemo, createSignal } from "solid-js"
import { type KeyEvent, type TextareaRenderable } from "@opentui/core"
import {
  createVimState,
  enterNormal,
  handleNormalKey,
  handleVisualKey,
  type VimDoc,
  type VimKey,
  type VimMode,
} from "./vim"

export interface VimDeps {
  input: () => TextareaRenderable | undefined
  disabled: () => boolean
  autocompleteVisible: () => boolean
  getVimEnabled: () => boolean
  measure: (text: string) => number
  bumpCursor: () => void
  cursorVersion: () => number
}

export interface VimApi {
  vimEnabled: () => boolean
  vimMode: () => VimMode
  vimOnKey: (e: KeyEvent) => boolean
  resetVim: () => void
}

/**
 * Set up vim modal editing for the prompt textarea. Returns the reactive
 * accessors and key handler the `Prompt` component wires into its textarea,
 * command palette, and meta-row indicator.
 *
 * Must be called within the `Prompt` component body so the SolidJS effects
 * are owned by the component.
 */
export function useVim(deps: VimDeps): VimApi {
  const state = createVimState("insert")
  const [mode, setMode] = createSignal<VimMode>("insert")
  const enabled = createMemo(() => deps.getVimEnabled())

  function sync() {
    if (state.mode !== mode()) setMode(state.mode)
    deps.bumpCursor()
  }

  function resetVim() {
    state.mode = "insert"
    state.operator = undefined
    state.awaitingG = false
    state.awaitingReplace = false
    state.countDigits = ""
    state.desiredColumn = undefined
    state.visualAnchor = undefined
    const input = deps.input()
    if (input && !input.isDestroyed) input.clearSelection()
    setMode("insert")
  }

  function doc(input: TextareaRenderable): VimDoc {
    // The Vim engine uses UTF-16 indices; OpenTUI uses display-cell offsets.
    // Snap edits to whole graphemes so emoji, combining marks and CJK survive.
    const segments = new Intl.Segmenter(undefined, { granularity: "grapheme" })
    function boundary(offset: number, forward = false) {
      const text = input.plainText
      const at = Math.max(0, Math.min(offset, text.length))
      for (const part of segments.segment(text)) {
        const end = part.index + part.segment.length
        if (at > part.index && at < end) return forward ? end : part.index
      }
      return at
    }
    function position(offset: number, forward = false) {
      return deps.measure(input.plainText.slice(0, boundary(offset, forward)))
    }
    return {
      get text() {
        return input.plainText
      },
      get cursor() {
        return input.getTextRange(0, input.cursorOffset).length
      },
      setCursor(offset: number) {
        input.cursorOffset = position(offset, offset > input.getTextRange(0, input.cursorOffset).length)
      },
      insert(offset: number, value: string) {
        input.cursorOffset = position(offset)
        input.insertText(value)
      },
      remove(start: number, end: number) {
        const removed = input.plainText.slice(boundary(start), boundary(end, true))
        input.setSelection(position(start), position(end, true))
        input.deleteSelection()
        return removed
      },
      undo() {
        input.undo()
      },
      redo() {
        input.redo()
      },
      setSelection(start: number, end: number) {
        input.setSelection(position(start), position(end, true))
      },
      clearSelection() {
        input.clearSelection()
      },
    }
  }

  /**
   * Intercept a key while vim mode is active. Returns true when the key was
   * consumed by the vim layer (caller must preventDefault so the textarea does
   * not also process it).
   */
  function vimOnKey(e: KeyEvent): boolean {
    const input = deps.input()
    if (!enabled() || deps.disabled() || !input || input.isDestroyed) return false

    // INSERT mode: only Escape is special (switch to NORMAL). Everything else
    // is left to the native textarea so typing behaves normally.
    if (state.mode === "insert") {
      if (e.name === "escape" && !deps.autocompleteVisible()) {
        enterNormal(doc(input), state)
        sync()
        return true
      }
      return false
    }

    const visual = state.mode === "visual" || state.mode === "visual-line"

    // In NORMAL mode keep Enter (submit) and Tab (autocomplete) working rather
    // than emulating strict vim line motions for them. In VISUAL mode the user
    // is selecting, so let the engine handle those keys instead.
    if (!visual && (e.name === "return" || e.name === "enter" || e.name === "tab")) return false

    // Let global ctrl/meta combos (e.g. ctrl+c to exit) through, except ctrl+r
    // which is vim redo.
    const ctrl = e.ctrl === true
    if ((ctrl || e.meta === true || e.super === true) && !(ctrl && e.name === "r")) return false

    const key: VimKey = ctrl
      ? { key: e.name, ctrl: true }
      : { key: e.sequence && e.sequence.length === 1 ? e.sequence : e.name }

    const result = visual ? handleVisualKey(doc(input), state, key) : handleNormalKey(doc(input), state, key)
    if (result.handled) sync()
    return result.handled
  }

  createEffect(() => {
    if (!enabled() && state.mode !== "insert") resetVim()
  })

  return { vimEnabled: enabled, vimMode: mode, vimOnKey, resetVim }
}

/**
 * Command-palette entry that toggles vim mode on or off.
 */
export function vimToggleCommand(opts: {
  vimEnabled: () => boolean
  setVimEnabled: (value: boolean) => Promise<void>
  resetVim: () => void
  clearDialog: () => void
  showToast: (message: string) => void
}) {
  return {
    title: "Toggle vim mode",
    desc: "Enable or disable vim modal editing in the prompt input",
    name: "prompt.vim.toggle",
    category: "Prompt",
    slash: { name: "vim" },
    run: async () => {
      const next = !opts.vimEnabled()
      await opts.setVimEnabled(next)
      opts.resetVim()
      opts.clearDialog()
      opts.showToast(next ? "Vim mode enabled" : "Vim mode disabled")
    },
  }
}
