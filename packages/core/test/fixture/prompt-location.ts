import type { FileSystem } from "@bolt-ai/core/filesystem"
import { Bus } from "@bolt-ai/core/bus"
import { Image } from "@bolt-ai/core/image"
import { LocationServiceMap } from "@bolt-ai/core/location-service-map"
import type { LocationServices } from "@bolt-ai/core/location-services"
import { Plugin } from "@bolt-ai/core/plugin"
import { PluginHooks } from "@bolt-ai/core/plugin/hooks"
import { Skill } from "@bolt-ai/core/skill"
import type { Location } from "@bolt-ai/schema/location"
import { makeGlobalNode } from "@bolt-ai/util/effect/app-node"
import { LayerNode } from "@bolt-ai/util/effect/layer-node"
import { Effect, Layer, LayerMap } from "effect"

// Plain-prompt unit fixtures use virtual directories.
export const promptLocationNode = makeGlobalNode({
  service: LocationServiceMap.Service,
  layer: Layer.effect(
    LocationServiceMap.Service,
    Effect.gen(function* () {
      const bus = yield* Bus.Service
      return yield* LayerMap.make(
        (_ref: Location.Ref) =>
          LayerNode.compile(LayerNode.group([PluginHooks.node, Image.node, Skill.node, Plugin.node]), {
            replacements: [
              Bus.node.replace(Layer.succeed(Bus.Service, bus)),
              Plugin.node.replace(Layer.mock(Plugin.Service, { awaitActivation: Effect.void })),
            ],
          }) as unknown as Layer.Layer<LocationServices, FileSystem.DirectoryNotFoundError>,
      )
    }),
  ),
  deps: [Bus.node],
})
