import { createMemo } from "solid-js"
import { useKV } from "../context/kv"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { PETS_KEY, SPECIES } from "./pet"

const CAP = 24

export function DialogPets() {
  const kv = useKV()
  const dialog = useDialog()
  const list = createMemo(() => (kv.get(PETS_KEY, []) as string[]).filter((name) => SPECIES[name] !== undefined))

  const options = createMemo(() => {
    const counts = new Map<string, number>()
    for (const name of list()) counts.set(name, (counts.get(name) ?? 0) + 1)
    return [
      ...Object.keys(SPECIES).map((name) => {
        const count = counts.get(name) ?? 0
        return {
          value: name,
          title: count ? `${name} ×${count}` : name,
          description: "spawn one",
        }
      }),
      { value: "", title: "dismiss all", description: list().length ? `${list().length} roaming` : "none roaming" },
    ]
  })

  return (
    <DialogSelect
      title="Pets"
      options={options()}
      onSelect={(option) => {
        if (!option.value) {
          kv.set(PETS_KEY, [])
          dialog.clear()
          return
        }
        // Stay open so spawning a whole litter is one keypress per pet.
        if (list().length >= CAP) return
        kv.set(PETS_KEY, [...list(), option.value])
      }}
    />
  )
}
