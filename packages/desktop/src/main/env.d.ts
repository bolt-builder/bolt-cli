interface ImportMetaEnv {
  readonly BOLT_CHANNEL: string
  readonly BOLT_VERSION?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
