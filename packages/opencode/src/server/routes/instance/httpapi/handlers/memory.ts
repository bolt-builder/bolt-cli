import { InstanceState } from "@/effect/instance-state"
import { MemoryError } from "@opencode-ai/memory/effect/errors"
import { MemoryContract } from "@opencode-ai/memory/effect/httpapi"
import { MemoryService } from "@opencode-ai/memory/effect/service"
import { Effect } from "effect"
import { HttpApiBuilder } from "effect/unstable/httpapi"
import { InstanceHttpApi } from "../api"
import {
  MemoryConfigurePayload,
  MemoryCorrectPayload,
  MemoryForgetPayload,
  MemoryPurgePayload,
  MemoryRememberPayload,
} from "../groups/memory"

function api<T>(effect: Effect.Effect<T, MemoryError>) {
  return effect.pipe(Effect.mapError(MemoryError.toHttp))
}

export const memoryHandlers = HttpApiBuilder.group(InstanceHttpApi, "memory", (handlers) =>
  Effect.gen(function* () {
    const svc = yield* MemoryService.Service

    const status = Effect.fn("MemoryHttpApi.status")(function* () {
      const ctx = yield* InstanceState.context
      return MemoryContract.output(yield* api(svc.status({ ctx })))
    })

    const show = Effect.fn("MemoryHttpApi.show")(function* () {
      const ctx = yield* InstanceState.context
      return MemoryContract.output(yield* api(svc.show({ ctx })))
    })

    const enable = Effect.fn("MemoryHttpApi.enable")(function* () {
      const ctx = yield* InstanceState.context
      return MemoryContract.output(yield* api(svc.enable({ ctx })))
    })

    const disable = Effect.fn("MemoryHttpApi.disable")(function* () {
      const ctx = yield* InstanceState.context
      return MemoryContract.output(yield* api(svc.disable({ ctx })))
    })

    const configure = Effect.fn("MemoryHttpApi.configure")(function* (req: {
      payload: typeof MemoryConfigurePayload.Type
    }) {
      const ctx = yield* InstanceState.context
      return MemoryContract.output(
        yield* api(
          svc.configure({
            ctx,
            settings: { autoConsolidate: req.payload.autoConsolidate, verbose: req.payload.verbose },
          }),
        ),
      )
    })

    const rebuild = Effect.fn("MemoryHttpApi.rebuild")(function* () {
      const ctx = yield* InstanceState.context
      return MemoryContract.output(yield* api(svc.rebuild({ ctx })))
    })

    const remember = Effect.fn("MemoryHttpApi.remember")(function* (req: {
      payload: typeof MemoryRememberPayload.Type
    }) {
      const ctx = yield* InstanceState.context
      return MemoryContract.operation(
        yield* api(
          svc.remember({
            ctx,
            sessionID: req.payload.sessionID,
            file: req.payload.file,
            section: req.payload.section,
            key: req.payload.key,
            text: req.payload.text,
          }),
        ),
      )
    })

    const correct = Effect.fn("MemoryHttpApi.correct")(function* (req: { payload: typeof MemoryCorrectPayload.Type }) {
      const ctx = yield* InstanceState.context
      return MemoryContract.operation(
        yield* api(
          svc.correct({
            ctx,
            sessionID: req.payload.sessionID,
            key: req.payload.key,
            text: req.payload.text,
          }),
        ),
      )
    })

    const forget = Effect.fn("MemoryHttpApi.forget")(function* (req: { payload: typeof MemoryForgetPayload.Type }) {
      const ctx = yield* InstanceState.context
      return MemoryContract.operation(
        yield* api(svc.forget({ ctx, query: req.payload.query, sessionID: req.payload.sessionID })),
      )
    })

    const purge = Effect.fn("MemoryHttpApi.purge")(function* (_req: { payload: typeof MemoryPurgePayload.Type }) {
      const ctx = yield* InstanceState.context
      return yield* api(svc.purge({ ctx }))
    })

    return handlers
      .handle("status", status)
      .handle("show", show)
      .handle("enable", enable)
      .handle("disable", disable)
      .handle("configure", configure)
      .handle("rebuild", rebuild)
      .handle("remember", remember)
      .handle("correct", correct)
      .handle("forget", forget)
      .handle("purge", purge)
  }),
)
