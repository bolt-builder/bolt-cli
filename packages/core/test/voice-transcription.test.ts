import { expect } from "bun:test"
import path from "node:path"
import { chmod } from "node:fs/promises"
import { Effect, Layer } from "effect"
import { HttpClient, HttpClientResponse } from "effect/http"
import { AppNodeBuilder } from "@opencode/core/effect/app-node-builder"
import { Credential } from "@opencode/core/credential"
import { Integration } from "@opencode/core/integration"
import { VoiceTranscription } from "@opencode/core/voice/transcription"
import { FSUtil } from "@opencode/util/fs-util"
import { Global } from "@opencode/util/global"
import { AppProcess } from "@opencode/util/process"
import { LayerNode } from "@opencode/util/effect/layer-node"
import { tmpdirScoped } from "./fixture/tmpdir"
import { tempGlobalLayer } from "./fixture/global"
import { testEffect } from "./lib/effect"

const it = testEffect(
  AppNodeBuilder.build(LayerNode.group([FSUtil.node, Global.node, AppProcess.node]), [
    Global.node.replace(tempGlobalLayer),
  ]),
)

const unused = () => Effect.die("provider must not be accessed")
const integration = (
  get: Integration.Interface["get"],
  resolve: Integration.Interface["connection"]["resolve"] = unused,
) =>
  Layer.mock(Integration.Service, {
    revision: () => 0,
    get,
    connection: {
      active: unused,
      resolve,
      key: unused,
      external: unused,
      activate: unused,
      update: unused,
      remove: unused,
      status: unused,
    },
    oauth: { connect: unused, status: unused, complete: unused, cancel: unused },
    command: { connect: unused, status: unused, cancel: unused },
  })

it.live("invokes local whisper and removes staged audio after success and failure", () =>
  Effect.gen(function* () {
    const temporary = yield* tmpdirScoped()
    const global = yield* Global.Service
    const fs = yield* FSUtil.Service
    const binary = path.join(temporary.path, "whisper")
    yield* Effect.promise(() =>
      Bun.write(binary, '#!/bin/sh\ntest -s "$4" || exit 2\nprintf "Restored Bolt voice input"\n'),
    )
    yield* Effect.promise(() => chmod(binary, 0o700))
    const result = yield* VoiceTranscription.transcribeLocal(
      { binary, model: "/synthetic-model" },
      { audio: Uint8Array.of(1, 2, 3), mime: "audio/wav" },
    )
    expect(result.text).toBe("Restored Bolt voice input")
    expect((yield* fs.readDirectory(global.tmp)).filter((name) => name.startsWith("voice-"))).toEqual([])
    yield* Effect.promise(() => Bun.write(binary, "#!/bin/sh\nexit 3\n"))
    expect(
      yield* VoiceTranscription.transcribeLocal(
        { binary, model: "/synthetic-model" },
        { audio: Uint8Array.of(1), mime: "audio/wav" },
      ).pipe(Effect.flip),
    ).toMatchObject({ _tag: "VoiceTranscribeError" })
    expect((yield* fs.readDirectory(global.tmp)).filter((name) => name.startsWith("voice-"))).toEqual([])
  }),
)

it.live("uploads the original multipart contract through V2 credentials and validates the response", () =>
  Effect.gen(function* () {
    const integrations = integration(
      (id) =>
        Effect.succeed({
          id,
          name: "OpenAI",
          methods: [],
          connections: [{ type: "env", name: "SYNTHETIC_OPENAI_KEY" }],
        }),
      () => Effect.succeed(Credential.Key.make({ type: "key", key: "synthetic-test-key" })),
    )
    let response: unknown = { text: "Hello Bolt" }
    let status = 200
    const requests: string[] = []
    const http = HttpClient.make((request) =>
      Effect.sync(() => {
        requests.push(request.url)
        expect(request.headers.authorization).toBe("Bearer synthetic-test-key")
        expect(request.body._tag).toBe("FormData")
        if (request.body._tag === "FormData") {
          expect(request.body.formData.get("model")).toBe("whisper-1")
          expect(request.body.formData.get("language")).toBe("en")
          expect(request.body.formData.get("file")).toBeInstanceOf(File)
        }
        return HttpClientResponse.fromWeb(request, Response.json(response, { status }))
      }),
    )
    const run = VoiceTranscription.transcribe({ audio: Uint8Array.of(1), mime: "audio/mp4", language: "en" }).pipe(
      Effect.provide(integrations),
      Effect.provideService(HttpClient.HttpClient, http),
    )
    expect(yield* run).toEqual({ text: "Hello Bolt" })
    expect(requests[0]).toBe("https://api.openai.com/v1/audio/transcriptions")
    response = { unexpected: true }
    expect(yield* run.pipe(Effect.flip)).toMatchObject({
      _tag: "VoiceTranscribeError",
      message: "Transcription returned an unexpected response shape",
    })
    status = 429
    expect(yield* run.pipe(Effect.flip)).toMatchObject({ _tag: "VoiceTranscribeError", status: 429 })
  }),
)

it.live("keeps one-shot local-only transcription from calling a provider", () =>
  Effect.gen(function* () {
    const error = yield* VoiceTranscription.transcribe({
      audio: Uint8Array.of(1),
      mime: "audio/mp4",
      localOnly: true,
    }).pipe(
      Effect.provide(integration(unused)),
      Effect.provideService(
        HttpClient.HttpClient,
        HttpClient.make(() => Effect.die("provider must not be called")),
      ),
      Effect.flip,
    )
    expect(error._tag).toBe("VoiceNoCredentialError")
  }),
)
