import { Agent } from "@bolt-ai/core/agent"
import { AISDK } from "@bolt-ai/core/aisdk"
import { Command } from "@bolt-ai/core/command"
import { Config } from "@bolt-ai/core/config"
import { Credential } from "@bolt-ai/core/credential"
import { Database } from "@bolt-ai/core/database/database"
import { FileAccess } from "@bolt-ai/core/file-access"
import { LayerNodePlatform } from "@bolt-ai/util/effect/app-node-platform"
import { AppProcess } from "@bolt-ai/util/process"
import { LayerNode } from "@bolt-ai/util/effect/layer-node"
import { Bus } from "@bolt-ai/core/bus"
import { FileSystem } from "@bolt-ai/core/filesystem"
import { FSUtil } from "@bolt-ai/util/fs-util"
import { Form } from "@bolt-ai/core/form"
import { Generate } from "@bolt-ai/core/generate"
import { Integration } from "@bolt-ai/core/integration"
import { KV } from "@bolt-ai/core/kv"
import { Location } from "@bolt-ai/core/location"
import { ManagedPolicy } from "@bolt-ai/core/managed-policy"
import { Mcp } from "@bolt-ai/core/mcp/index"
import { Model } from "@bolt-ai/core/model"
import { Npm } from "@bolt-ai/util/npm"
import { Plugin } from "@bolt-ai/core/plugin"
import { PluginHooks } from "@bolt-ai/core/plugin/hooks"
import { Provider } from "@bolt-ai/core/provider"
import { Session } from "@bolt-ai/core/session"
import { PersistentPty } from "@bolt-ai/core/persistent-pty"
import { LocationServiceMap } from "@bolt-ai/core/location-service-map"
import { AppNodeBuilder } from "@bolt-ai/core/effect/app-node-builder"
import { Permission } from "@bolt-ai/core/permission"
import { Reference } from "@bolt-ai/core/reference"
import { Rpc } from "@bolt-ai/core/rpc"
import { Skill } from "@bolt-ai/core/skill"
import { SkillDiscovery } from "@bolt-ai/core/skill/discovery"
import { Watcher } from "@bolt-ai/core/filesystem/watcher"
import { Tool } from "@bolt-ai/core/tool"
import { Vcs } from "@bolt-ai/core/vcs"
import { WebSearch } from "@bolt-ai/core/websearch"
import { Worktree } from "@bolt-ai/core/worktree"
import { WorktreeStrategies } from "@bolt-ai/core/worktree/strategies"
import { Effect, Layer } from "effect"
import { tempLocationLayer } from "../fixture/location"
import { emptyMcpLayer } from "../fixture/mcp"

const npmLayer = Layer.succeed(
  Npm.Service,
  Npm.Service.of({
    add: (name) => Effect.succeed({ directory: "", name }),
    resolve: (name) => Effect.succeed({ directory: "", name }),
    check: () => Effect.succeed(false),
    update: (name) => Effect.succeed({ directory: "", name }),
    which: () => Effect.undefined,
  }),
)

const generateLayer = Layer.succeed(Generate.Service, Generate.Service.of({ text: () => Effect.succeed("") }))

const configLayer = Config.testLayer()

const permissionLayer = Layer.succeed(
  Permission.Service,
  Permission.Service.of({
    close: Effect.void,
    ask: (input) => Effect.succeed({ id: input.id ?? Permission.ID.create(), effect: "ask" }),
    assert: () => Effect.void,
    reply: () => Effect.void,
    get: () => Effect.succeed(undefined),
    forSession: () => Effect.succeed([]),
    list: () => Effect.succeed([]),
  }),
)

export const makePluginTestLayer = (permission = permissionLayer) =>
  AppNodeBuilder.build(
    LayerNode.group([
      AppProcess.node,
      FileSystem.node,
      FSUtil.node,
      Location.node,
      Npm.node,
      Credential.node,
      Config.node,
      Database.node,
      FileAccess.node,
      Bus.node,
      Form.node,
      Generate.node,
      LayerNodePlatform.httpClient,
      Plugin.node,
      Agent.node,
      AISDK.node,
      Provider.node,
      Model.node,
      Command.node,
      Integration.node,
      KV.node,
      ManagedPolicy.node,
      Mcp.node,
      Session.node,
      PersistentPty.node,
      LocationServiceMap.node,
      Permission.node,
      PluginHooks.node,
      Reference.node,
      Rpc.node,
      Skill.node,
      SkillDiscovery.node,
      Tool.node,
      Vcs.node,
      Watcher.node,
      WebSearch.node,
      Worktree.node,
      WorktreeStrategies.node,
    ]),
    [
      Location.node.replace(tempLocationLayer),
      Npm.node.replace(npmLayer),
      Config.node.replace(configLayer),
      Mcp.node.replace(emptyMcpLayer),
      Generate.node.replace(generateLayer),
      Permission.node.replace(permission),
    ],
  ).pipe(Layer.provideMerge(configLayer))

export const PluginTestLayer = makePluginTestLayer()
