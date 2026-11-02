import { createUniqueId, For, type ComponentProps } from "solid-js"

export const boltLetters = [
  {
    cx: 84,
    weak: "M90 30H78V18H90V30Z",
    stem: "M90 12H78V30H90V12ZM96 36H72V0H78V6H96V36Z",
    fill: "var(--brand-accent, var(--icon-base))",
  },
  {
    cx: 114,
    weak: "M120 30H108V18H120V30Z",
    stem: "M120 12H108V30H120V12ZM126 36H102V6H126V36Z",
    fill: "var(--brand-accent, var(--icon-base))",
  },
  { cx: 135, weak: "", stem: "M138 36H132V0H138V36Z", fill: "var(--brand-primary, var(--icon-strong-base))" },
  {
    cx: 153,
    weak: "",
    stem: "M150 36H144V0H150V36ZM162 12H144V6H162V12ZM162 36H150V30H162V36Z",
    fill: "var(--brand-primary, var(--icon-strong-base))",
  },
] as const

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 24 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M18 30H6V18H18V30Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M18 12H6V30H18V12ZM24 36H0V0H6V6H24V36Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 24 36"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M18 30H6V18H18V30Z" fill="var(--icon-base)" />
      <path d="M18 12H6V30H18V12ZM24 36H0V0H6V6H24V36Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string; viewBox?: string }) => {
  const gradient = createUniqueId()

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox={props.viewBox ?? "0 0 234 42"}
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <defs>
        <linearGradient id={gradient} x1="72" x2="162" gradientUnits="userSpaceOnUse">
          <stop stop-color="var(--brand-accent, var(--icon-base))" />
          <stop offset="1" stop-color="var(--brand-primary, var(--icon-strong-base))" />
        </linearGradient>
      </defs>
      <For each={boltLetters}>
        {(letter) => (
          <>
            <path d={letter.weak} fill="var(--icon-weak-base)" />
            <path d={letter.stem} fill={`url(#${gradient})`} />
          </>
        )}
      </For>
    </svg>
  )
}
