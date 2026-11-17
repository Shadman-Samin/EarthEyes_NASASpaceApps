import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "@playwright/test"

const pilot = "/explore/kuakata-bangladesh?bbox=90.0575,21.7524,90.2025,21.8876&start=2026-06-01&end=2026-10-31&product=nisar-gcov-provisional&pol=HVHV&module=coastal&view=map"

test("published evidence, map and Argus work independently of the live catalogue", async ({ page }, testInfo) => {
  test.setTimeout(60_000)
  await page.route("**/api/catalog/search?*", (route) => route.fulfill({ status: 503, json: { error: { message: "Test boundary: catalogue unavailable" } } }))
  await page.route("https://tile.openstreetmap.org/**", (route) => route.fulfill({ contentType: "image/png",
    body: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAIAAACQd1PeAAAADElEQVR4nGP4//8/AAX+Av4N70a4AAAAAElFTkSuQmCC", "base64") }))
  let overlayFetched = false
  page.on("response", (response) => { if (response.url().endsWith("-water.webp") && response.ok()) overlayFetched = true })
  await page.goto(pilot)
  const narrow = page.viewportSize()!.width < 1100
  if (narrow) await page.getByRole("button", { name: "Summary", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Calibrated source analysis" })).toBeVisible({ timeout: 20_000 })
  await expect(page.getByText(/direction is not established/)).toBeVisible()
  await expect(page.getByRole("table", { name: "Calibrated time series" }).getByRole("row")).toHaveCount(11)
  await expect(page.getByText("Exploratory result, not ground-truth validated")).toBeVisible()
  await expect.poll(() => overlayFetched, { timeout: 20_000 }).toBe(true)
  await page.getByRole("button", { name: "Brightness screen", exact: true }).click()
  await expect(page.getByRole("button", { name: "Brightness screen", exact: true })).toHaveAttribute("aria-pressed", "true")
  await page.getByRole("button", { name: "Water candidates", exact: true }).click()
  expect((await new AxeBuilder({ page }).include(".calibrated-analysis").include(".explorer-analysis-banner").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([])
  await page.screenshot({ path: testInfo.outputPath("calibrated-evidence.png") })
  if (narrow) await page.getByRole("button", { name: "Close evidence panel" }).click()
  await page.getByRole("button", { name: "Ask Argus evidence guide" }).click()
  const panel = page.locator("#argus-panel")
  await expect(panel).toContainText("Published study / server-owned facts")
  await panel.getByRole("button", { name: "What changed?", exact: true }).click()
  await expect(panel.getByRole("log")).toContainText("0.38")
  await expect(panel.getByRole("log")).toContainText("Sensitivity")
  await expect(panel.getByRole("log")).toContainText("not ground-truth validated")
  await page.getByRole("button", { name: "Close Argus", exact: true }).click()

  if (narrow) await page.getByRole("button", { name: "Controls", exact: true }).click()
  await page.getByText("Advanced options (optional)", { exact: true }).click()
  await page.getByRole("combobox", { name: "Polarization", exact: true }).selectOption("HHHH")
  if (narrow) {
    await page.getByRole("button", { name: "Close controls panel" }).click()
    await page.getByRole("button", { name: "Summary", exact: true }).click()
  }
  await expect(page.getByRole("heading", { name: "No matching precomputed analysis" })).toBeVisible()
  await expect(page.getByRole("heading", { name: "Calibrated source analysis" })).toHaveCount(0)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
