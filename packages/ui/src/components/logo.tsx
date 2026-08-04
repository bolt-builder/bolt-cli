import { type ComponentProps } from "solid-js"

export const Mark = (props: { class?: string }) => {
  return (
    <svg
      data-component="logo-mark"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 16 20"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path data-slot="logo-logo-mark-shadow" d="M12 16H4V8H12V16Z" fill="var(--icon-weak-base)" />
      <path data-slot="logo-logo-mark-o" d="M12 4H4V16H12V4ZM16 20H0V0H16V20Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Splash = (props: Pick<ComponentProps<"svg">, "ref" | "class">) => {
  return (
    <svg
      ref={props.ref}
      data-component="logo-splash"
      classList={{ [props.class ?? ""]: !!props.class }}
      viewBox="0 0 80 100"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
    >
      <path d="M60 80H20V40H60V80Z" fill="var(--icon-base)" />
      <path d="M60 20H20V80H60V20ZM80 100H0V0H80V100Z" fill="var(--icon-strong-base)" />
    </svg>
  )
}

export const Logo = (props: { class?: string }) => {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 234 42"
      fill="none"
      classList={{ [props.class ?? ""]: !!props.class }}
    >
      <g>
        <path d="M90 30H78V18H90V30Z" fill="var(--icon-weak-base)" />
        <path d="M90 12H78V30H90V12ZM96 36H72V0H78V6H96V36Z" fill="var(--icon-base)" />
        <path d="M120 30H108V18H120V30Z" fill="var(--icon-weak-base)" />
        <path d="M120 12H108V30H120V12ZM126 36H102V6H126V36Z" fill="var(--icon-base)" />
        <path d="M138 36H132V0H138V36Z" fill="var(--icon-strong-base)" />
        <path d="M150 36H144V0H150V36ZM162 12H144V6H162V12ZM162 36H150V30H162V36Z" fill="var(--icon-strong-base)" />
      </g>
    </svg>
  )
}
