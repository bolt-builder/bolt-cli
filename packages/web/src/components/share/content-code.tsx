import { codeToHtml, bundledLanguages } from "shiki"
import { createResource, Suspense } from "solid-js"
import style from "./content-code.module.css"

interface Props {
  code: string
  lang?: string
  flush?: boolean
}
export function ContentCode(props: Props) {
  const [html] = createResource(
    () => [props.code, props.lang],
    async ([code, lang]) => {
      return (await codeToHtml(code || "", {
        lang: lang && lang in bundledLanguages ? lang : "text",
        themes: {
          light: "github-light",
          dark: "github-dark",
        },
      })) as string
    },
  )
  return (
    <Suspense
      fallback={
        <div class={style.root} data-flush={props.flush === true ? true : undefined}>
          <pre>{props.code}</pre>
        </div>
      }
    >
      <div innerHTML={html()} class={style.root} data-flush={props.flush === true ? true : undefined} />
    </Suspense>
  )
}
