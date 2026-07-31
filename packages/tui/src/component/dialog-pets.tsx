import { createMemo } from "solid-js"
import { useKV } from "../context/kv"
import { DialogSelect } from "../ui/dialog-select"
import { useDialog } from "../ui/dialog"
import { PET_KEY, PET_OFF, PETS } from "./pet"

export function DialogPets() {
  const kv = useKV()
  const dialog = useDialog()

  const options = createMemo(() => [
    ...Object.entries(PETS).map(([name, pet]) => ({
      value: name,
      title: `${name}  ${pet.idle[0]}`,
      description: undefined,
    })),
    { value: PET_OFF, title: "off", description: "no pet" },
  ])

  return (
    <DialogSelect
      title="Choose a pet"
      current={kv.get(PET_KEY, PET_OFF)}
      options={options()}
      onSelect={(option) => {
        kv.set(PET_KEY, option.value)
        dialog.clear()
      }}
    />
  )
}
