import { execFile } from "node:child_process"
import path from "node:path"
import { fileURLToPath } from "node:url"
import { promisify } from "node:util"

import type { AfterPackContext, Configuration } from "electron-builder"

const execFileAsync = promisify(execFile)
const packageDir = path.dirname(fileURLToPath(import.meta.url))
const rootDir = path.resolve(packageDir, "../..")
const signScript = path.join(rootDir, "script", "sign-windows.ps1")
// Upstream's Electron 42 packaging update briefly installed Linux launchers/icons under
// a "<name>-desktop" entry. Keep that hidden desktop entry around so GNOME/KDE
// pins against it still resolve alongside the canonical app id com.boltbuilder.bolt.
const legacyDesktopEntry = path.join(packageDir, "resources", "linux", "bolt-desktop.desktop")
const legacyDesktopEntryFpm = `${legacyDesktopEntry}=/usr/share/applications/bolt-desktop.desktop`

const metainfoFpm = (appId: string) =>
  `${path.join(packageDir, "resources", `${appId}.metainfo.xml`)}=/usr/share/metainfo/${appId}.metainfo.xml`

async function signWindows(configuration: { path: string }) {
  if (process.platform !== "win32") return
  if (process.env.GITHUB_ACTIONS !== "true") return

  await execFileAsync(
    "pwsh",
    ["-NoLogo", "-NoProfile", "-ExecutionPolicy", "Bypass", "-File", signScript, configuration.path],
    { cwd: rootDir },
  )
}

// Without a Developer ID identity electron-builder skips signing entirely and
// Gatekeeper reports the quarantined download as "damaged". Ad-hoc signing keeps
// the bundle seal valid so users get the bypassable "unidentified developer"
// dialog instead. Only runs when CI has explicitly disabled identity discovery
// because the certificate secret is absent.
async function adhoc(context: AfterPackContext) {
  if (context.electronPlatformName !== "darwin") return
  if (process.env.CSC_LINK || process.env.CSC_IDENTITY_AUTO_DISCOVERY !== "false") return
  if (process.platform !== "darwin")
    throw new Error("ad-hoc signing the macOS bundle requires codesign, which is only available on macOS hosts")
  const app = path.join(context.appOutDir, `${context.packager.appInfo.productFilename}.app`)
  await execFileAsync("codesign", ["--force", "--deep", "--sign", "-", app])
  console.log(`ad-hoc signed ${app} (no Developer ID identity available)`)
}

const channel = (() => {
  const raw = process.env.OPENCODE_CHANNEL
  if (raw === "dev" || raw === "beta" || raw === "prod") return raw
  return "dev"
})()

const APP_IDS = {
  dev: "com.boltbuilder.bolt.dev",
  beta: "com.boltbuilder.bolt.beta",
  prod: "com.boltbuilder.bolt",
} as const

const getBase = (appId: string): Configuration => ({
  artifactName: "bolt-desktop-${os}-${arch}.${ext}",
  afterPack: adhoc,
  directories: {
    output: "dist",
    buildResources: "resources",
  },
  // Linux launchers are .desktop files, so this is the desktop file name,
  // not just the app id. For prod, app id "com.boltbuilder.bolt" becomes
  // "com.boltbuilder.bolt.desktop".
  // https://developer.gnome.org/documentation/guidelines/maintainer/integrating.html
  // https://www.electron.build/docs/linux/
  extraMetadata: {
    desktopName: `${appId}.desktop`,
  },
  files: ["out/**/*", "resources/**/*", "!resources/bolt-cli*"],
  extraResources: [
    ...(channel === "dev"
      ? [
          {
            from: "resources/",
            to: "",
            filter: ["bolt-cli*"],
          },
        ]
      : []),
    {
      from: "native/",
      to: "native/",
      filter: ["index.js", "index.d.ts", "build/Release/mac_window.node", "swift-build/**"],
    },
  ],
  mac: {
    category: "public.app-category.developer-tools",
    icon: `resources/icons/icon.icns`,
    hardenedRuntime: true,
    gatekeeperAssess: false,
    entitlements: "resources/entitlements.plist",
    entitlementsInherit: "resources/entitlements.plist",
    notarize: true,
    target: ["dmg", "zip"],
  },
  dmg: {
    sign: true,
  },
  protocols: {
    name: "Bolt",
    schemes: ["bolt"],
  },
  win: {
    icon: `resources/icons/icon.ico`,
    signtoolOptions: {
      sign: signWindows,
    },
    target: ["nsis"],
    verifyUpdateCodeSignature: false,
  },
  nsis: {
    oneClick: true,
    perMachine: false,
    installerIcon: `resources/icons/icon.ico`,
    installerHeaderIcon: `resources/icons/icon.ico`,
  },
  linux: {
    icon: `resources/icons`,
    category: "Development",
    executableName: appId,
    desktop: {
      entry: {
        // Match the installed .desktop file and hicolor icon basename so
        // Linux shells can associate the running Electron window with its launcher.
        StartupWMClass: appId,
      },
    },
    target: ["AppImage", "deb", "rpm"],
  },
})

function getConfig() {
  const appId = APP_IDS[channel]
  const base = getBase(appId)

  switch (channel) {
    case "dev": {
      return {
        ...base,
        appId,
        productName: "Bolt Dev",
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "bolt-dev", fpm: [metainfoFpm(appId)] },
      }
    }
    case "beta": {
      return {
        ...base,
        appId,
        productName: "Bolt Beta",
        protocols: { name: "Bolt Beta", schemes: ["bolt"] },
        publish: { provider: "github", owner: "bolt-builder", repo: "bolt-cli", channel: "latest" },
        deb: { fpm: [metainfoFpm(appId)] },
        rpm: { packageName: "bolt-beta", fpm: [metainfoFpm(appId)] },
      }
    }
    case "prod": {
      return {
        ...base,
        appId,
        productName: "Bolt",
        protocols: { name: "Bolt", schemes: ["bolt"] },
        publish: { provider: "github", owner: "bolt-builder", repo: "bolt-cli", channel: "latest" },
        deb: { fpm: [metainfoFpm(appId), legacyDesktopEntryFpm] },
        rpm: { packageName: "bolt", fpm: [metainfoFpm(appId), legacyDesktopEntryFpm] },
      }
    }
  }
}

export default getConfig()
