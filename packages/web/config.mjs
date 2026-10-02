const stage = process.env.SST_STAGE || "dev"

export default {
  url: stage === "production" ? "https://bolt.ai" : `https://${stage}.bolt.ai`,
  console: stage === "production" ? "https://bolt.ai/auth" : `https://${stage}.bolt.ai/auth`,
  email: "help@anoma.ly",
  socialCard: "https://social-cards.sst.dev",
  github: "https://github.com/Bolt-builder/bolt-cli",
  discord: "https://bolt.ai/discord",
  headerLinks: [
    { name: "app.header.home", url: "/" },
    { name: "app.header.docs", url: "/v2/docs" },
  ],
}
