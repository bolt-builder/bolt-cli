import { MemoryApiClientError, MemoryApiServerError } from "@opencode-ai/memory/effect/errors"
import { MemoryContract } from "@opencode-ai/memory/effect/httpapi"
import { HttpApi, HttpApiEndpoint, HttpApiGroup, OpenApi } from "effect/unstable/httpapi"
import { Authorization } from "../middleware/authorization"
import { InstanceContextMiddleware } from "../middleware/instance-context"
import { WorkspaceRoutingMiddleware, WorkspaceRoutingQuery } from "../middleware/workspace-routing"
import { described } from "./metadata"

const MemoryErrors = [MemoryApiClientError, MemoryApiServerError] as const

export const MemoryRememberPayload = MemoryContract.RememberPayload
export const MemoryCorrectPayload = MemoryContract.CorrectPayload
export const MemoryForgetPayload = MemoryContract.ForgetPayload
export const MemoryConfigurePayload = MemoryContract.ConfigurePayload
export const MemoryPurgePayload = MemoryContract.PurgePayload

export const MemoryApi = HttpApi.make("memory")
  .add(
    HttpApiGroup.make("memory")
      .add(
        HttpApiEndpoint.get("status", MemoryContract.Paths.status, {
          query: WorkspaceRoutingQuery,
          success: described(MemoryContract.Status, "Memory status"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.status",
            summary: "Get memory status",
            description: "Return memory state, index preview, and token estimate for the active workspace.",
          }),
        ),
        HttpApiEndpoint.get("show", MemoryContract.Paths.show, {
          query: WorkspaceRoutingQuery,
          success: described(MemoryContract.Show, "Memory source and index"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.show",
            summary: "Show memory",
            description:
              "Return source memory files, generated index, recent decision summary, and memory save decisions.",
          }),
        ),
        HttpApiEndpoint.post("enable", MemoryContract.Paths.enable, {
          query: WorkspaceRoutingQuery,
          success: described(MemoryContract.Enable, "Memory enabled"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.enable",
            summary: "Enable memory",
            description: "Scaffold and enable project memory for the active workspace.",
          }),
        ),
        HttpApiEndpoint.post("disable", MemoryContract.Paths.disable, {
          query: WorkspaceRoutingQuery,
          success: described(MemoryContract.Disable, "Memory disabled"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.disable",
            summary: "Disable memory",
            description: "Disable project memory without deleting local memory files.",
          }),
        ),
        HttpApiEndpoint.post("configure", MemoryContract.Paths.configure, {
          query: WorkspaceRoutingQuery,
          payload: MemoryConfigurePayload,
          success: described(MemoryContract.Configure, "Memory configured"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.configure",
            summary: "Configure memory",
            description: "Update project memory settings such as automatic project fact capture.",
          }),
        ),
        HttpApiEndpoint.post("rebuild", MemoryContract.Paths.rebuild, {
          query: WorkspaceRoutingQuery,
          success: described(MemoryContract.Enable, "Memory rebuilt"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.rebuild",
            summary: "Rebuild memory index",
            description: "Regenerate the memory index from source memory files.",
          }),
        ),
        HttpApiEndpoint.post("remember", MemoryContract.Paths.remember, {
          query: WorkspaceRoutingQuery,
          payload: MemoryRememberPayload,
          success: described(MemoryContract.Operation, "Memory operation result"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.remember",
            summary: "Remember text",
            description: "Persist explicit user-provided memory text through the deterministic operation pipeline.",
          }),
        ),
        HttpApiEndpoint.post("correct", MemoryContract.Paths.correct, {
          query: WorkspaceRoutingQuery,
          payload: MemoryCorrectPayload,
          success: described(MemoryContract.Operation, "Memory correction result"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.correct",
            summary: "Remember correction",
            description: "Persist explicit corrective memory under corrections.md.",
          }),
        ),
        HttpApiEndpoint.post("forget", MemoryContract.Paths.forget, {
          query: WorkspaceRoutingQuery,
          payload: MemoryForgetPayload,
          success: described(MemoryContract.Operation, "Memory forget result"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.forget",
            summary: "Forget memory",
            description: "Remove memory lines by exact key, id, or normalized key text and rebuild the index.",
          }),
        ),
        HttpApiEndpoint.post("purge", MemoryContract.Paths.purge, {
          query: WorkspaceRoutingQuery,
          payload: MemoryPurgePayload,
          success: described(MemoryContract.Purge, "Memory purged"),
          error: MemoryErrors,
        }).annotateMerge(
          OpenApi.annotations({
            identifier: "memory.purge",
            summary: "Purge memory",
            description: "Delete all project memory files for the active workspace.",
          }),
        ),
      )
      .annotateMerge(
        OpenApi.annotations({
          title: "memory",
          description: "Project memory routes.",
        }),
      )
      .middleware(InstanceContextMiddleware)
      .middleware(WorkspaceRoutingMiddleware)
      .middleware(Authorization),
  )
  .annotateMerge(
    OpenApi.annotations({
      title: "opencode memory HttpApi",
      version: "0.0.1",
      description: "Project memory HttpApi surface.",
    }),
  )
