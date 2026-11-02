import { benchmark, expect } from "./benchmark"
import { openSession } from "../utils/workspace"

benchmark.use({ serviceWorkers: "block", trace: "off", video: "off", traceScope: "interaction" })

benchmark("session location menu opens with project, branch and actions", async ({ page, report }) => {
  await openSession(page, { name: "LocationBenchmark" })
  const trigger = page.locator('[data-slot="session-location-trigger"]')
  await expect(trigger).toBeEnabled()
  const start = await page.evaluate(() => performance.now())
  await trigger.click()
  const menu = page.locator('[data-slot="session-location-card"]')
  await expect(menu.getByRole("menuitem", { name: "Edit project", exact: true })).toBeVisible()
  await expect(menu.getByRole("menuitem", { name: "Local repository", exact: true })).toBeVisible()
  const end = await page.evaluate(() => performance.now())
  report({ openObservedMs: end - start }, { fixture: "single-session", inputEvent: "click" })
})
