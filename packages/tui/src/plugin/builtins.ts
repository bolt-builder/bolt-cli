import HomeFooter from "../feature-plugins/home/footer"
import PromptBtw from "../feature-plugins/prompt/btw"
import PromptFooter from "../feature-plugins/prompt/footer"
import SidebarContext from "../feature-plugins/sidebar/context"
import SidebarFooter from "../feature-plugins/sidebar/footer"
import SidebarLimit from "../feature-plugins/sidebar/limit"
import SidebarMcp from "../feature-plugins/sidebar/mcp"
import SidebarTodo from "../feature-plugins/sidebar/todo"
import DiffViewer from "../feature-plugins/system/diff-viewer"
import Notifications from "../feature-plugins/system/notifications"
import Plugins from "../feature-plugins/system/plugins"
import Storybook from "../feature-plugins/system/storybook"
import CostAlert from "../feature-plugins/system/cost-alert"
import Voice from "../feature-plugins/system/voice"
import Sandbox from "../feature-plugins/system/sandbox"
import Memory from "../feature-plugins/system/memory"
import Process from "../feature-plugins/system/process"
import Stats from "../feature-plugins/system/stats"
import Latex from "@opencode/latex/plugin"
import Merman from "@opencode/merman/plugin"

export const builtins = [
  HomeFooter,
  PromptFooter,
  PromptBtw,
  SidebarContext,
  SidebarLimit,
  SidebarMcp,
  SidebarTodo,
  SidebarFooter,
  Notifications,
  Plugins,
  Stats,
  CostAlert,
  Process,
  Memory,
  Sandbox,
  Voice,
  Merman,
  Latex,
  // The storybook is a development tool; keep its route and palette commands out of
  // normal launches and register it only for OPENCODE_STORY runs.
  ...(process.env.OPENCODE_STORY ? [Storybook] : []),
  DiffViewer,
]
