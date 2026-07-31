import { createMemo } from "solid-js"
import { useKV } from "../context/kv"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { useToast } from "../ui/toast"
import { PETS_KEY, SPECIES } from "./pet"

const CAP = 24

export function DialogPets() {
  const kv = useKV()
  const dialog = useDialog()
  const toast = useToast()
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
        // Close on select like every other dialog: a dialog that swallows
        // enter without visible feedback reads as a frozen app. Reopen /pets
        // to spawn more.
        dialog.clear()
        if (!option.value) {
          kv.set(PETS_KEY, [])
          return
        }
        if (list().length >= CAP) {
          toast.show({ message: `the ${CAP}-pet kennel is full`, variant: "warning" })
          return
        }
        const next = [...list(), option.value]
        kv.set(PETS_KEY, next)
        toast.show({ message: `${option.value} spawned (${next.length} roaming)`, variant: "success" })
      }}
    />
  )
}
