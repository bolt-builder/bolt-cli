# Publishing the Bolt VS Code Extension

These steps require a human with access to the bolt-builder GitHub organization. Nothing in this document is automated; the CI workflow only builds and uploads a `.vsix` artifact.

## One-time setup: Visual Studio Marketplace

1. Create an Azure DevOps organization at https://dev.azure.com (any name works; it only hosts the token).
2. Create a Marketplace publisher at https://marketplace.visualstudio.com/manage named `bolt-builder`. If you pick a different name, update the `publisher` field in `sdks/vscode/package.json` before publishing.
3. In Azure DevOps, create a Personal Access Token: User settings, Personal access tokens, New Token, organization "All accessible organizations", scope Marketplace with Manage permission.
4. Store the token as the `VSCE_PAT` secret in this repository (Settings, Secrets and variables, Actions).

## One-time setup: Open VSX (optional, for VSCodium users)

1. Create an account at https://open-vsx.org (sign in with GitHub).
2. Create the `bolt-builder` namespace: `npx ovsx create-namespace bolt-builder -p <token>`, using an access token from your Open VSX user settings.
3. Store the token as the `OPENVSX_TOKEN` secret in this repository. `script/publish` skips Open VSX when the secret is absent.

## Releasing a version

1. Make sure `version` in `sdks/vscode/package.json` and the `CHANGELOG.md` entry match the release.
2. Run `./script/release` from `sdks/vscode` (or `./script/release --minor`). It creates and pushes the next `vscode-vX.Y.Z` tag.
3. The `publish-vscode` workflow runs on the tag and executes `script/publish`, which packages `dist/bolt.vsix` and publishes to the Marketplace (and Open VSX when configured).

## Manual publish (fallback)

From `sdks/vscode`:

```sh
bun install
bunx @vscode/vsce package --no-dependencies -o dist/bolt.vsix
bunx @vscode/vsce publish --packagePath dist/bolt.vsix   # uses VSCE_PAT from the environment
npx ovsx publish dist/bolt.vsix -p "$OPENVSX_TOKEN"      # optional
```
