const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://opencode.ai" : `https://${stage}.opencode.ai`,
  console: stage === "production" ? "https://opencode.ai/auth" : `https://${stage}.opencode.ai/auth`,
  email: "help@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/Bolt-builder/bolt-cli/actions/workflows/publish.ym",
  discord: "https://opencode.ai/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/docs/" },
  ],
}
