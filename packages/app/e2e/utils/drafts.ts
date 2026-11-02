import type { Page } from "@playwright/test"
import { Schema } from "effect"

// Reads committed prompt text, including externalized chunks, so reload tests do not race the draft writer.
export async function readSessionDraftText(page: Page, sessionID: string) {
  const raw = await page.evaluate(async (sessionID) => {
    const db = await new Promise<IDBDatabase>((resolve, reject) => {
      const request = indexedDB.open("opencode-drafts", 1)
      request.onsuccess = () => resolve(request.result)
      request.onerror = () => reject(request.error)
    })

    try {
      const transaction = db.transaction("documents", "readonly")
      const documents = transaction.objectStore("documents")

      const keys = await new Promise<IDBValidKey[]>((resolve, reject) => {
        const request = documents.getAllKeys()
        request.onsuccess = () => resolve(request.result)
        request.onerror = () => reject(request.error)
      })

      const key = keys.find((key) => String(key).endsWith(`:session:${sessionID}:prompt`))

      if (key === undefined) return null

      return await new Promise<unknown>((resolve, reject) => {
        const request = documents.get(key)
        transaction.oncomplete = () => resolve(request.result)
        transaction.onerror = () => reject(transaction.error)
        transaction.onabort = () => reject(transaction.error)
      })
    } finally {
      db.close()
    }
  }, sessionID)

  if (raw === null) return ""

  const draft = Schema.decodeUnknownSync(
    Schema.fromJsonString(
      Schema.Struct({
        prompt: Schema.Array(Schema.Struct({ type: Schema.String, content: Schema.optional(Schema.Unknown) })),
      }),
    ),
  )(raw)

  const parts = draft.prompt.filter((part) => part.type === "text")

  const content = Schema.Union([
    Schema.String,
    Schema.Struct({ blob: Schema.Struct({ kind: Schema.Literal("text"), ids: Schema.Array(Schema.String) }) }),
  ])

  return (
    await Promise.all(
      parts.map(async (part) => {
        const value = Schema.decodeUnknownSync(content)(part.content)

        // oxlint-disable-next-line anti-slop/no-runtime-typeof -- The validated persisted-text union is inline string or a text-chunk reference.
        if (typeof value === "string") return value

        return page.evaluate(async (ids) => {
          const db = await new Promise<IDBDatabase>((resolve, reject) => {
            const request = indexedDB.open("opencode-drafts", 1)
            request.onsuccess = () => resolve(request.result)
            request.onerror = () => reject(request.error)
          })

          try {
            const store = db.transaction("blobs", "readonly").objectStore("blobs")

            const chunks = await Promise.all(
              ids.map(
                (id) =>
                  new Promise<Blob>((resolve, reject) => {
                    const request = store.get(id)
                    request.onsuccess = () => resolve(request.result)
                    request.onerror = () => reject(request.error)
                  }),
              ),
            )

            return (await Promise.all(chunks.map((chunk) => chunk.text()))).join("")
          } finally {
            db.close()
          }
        }, value.blob.ids)
      }),
    )
  ).join("")
}
