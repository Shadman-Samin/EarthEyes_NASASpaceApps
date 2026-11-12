import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "./live-fixtures"

test("Argus is Explore-only and answers from the current computed view", async ({ page }, testInfo) => {
  await page.goto("/about")
  await expect(page.getByRole("button", { name: "Ask Argus evidence guide" })).toHaveCount(0)
  await page.goto("/explore/kuakata-bangladesh")
  const launcher = page.getByRole("button", { name: "Ask Argus evidence guide" })
  await launcher.click()
  const panel = page.locator("#argus-panel")
  await expect(panel.getByText(/loaded \/ \d+ in this footprint/)).toBeVisible()
  await expect(panel).toHaveAttribute("data-comparison", "ready")
  await panel.getByRole("button", { name: "What changed?", exact: true }).click()
  await expect(panel.getByRole("log")).toContainText("%")
  await expect(panel.getByRole("log")).toContainText("not")
  await panel.getByRole("textbox", { name: "Ask about this view" }).fill("Which dates and polarization?")
  await panel.getByRole("button", { name: "Send question" }).click()
  await expect(panel.getByRole("log")).toContainText(/\d{4}-\d{2}-\d{2}/)
  await page.keyboard.press("Escape")
  await expect(launcher).toBeFocused()
  await launcher.click()
  await expect(panel.getByRole("log")).toContainText(/\d{4}-\d{2}-\d{2}/)
  const box = (await panel.boundingBox())!
  expect(box.width).toBeLessThanOrEqual(360)
  expect(box.height).toBeLessThanOrEqual(440)
  await expect(panel.getByRole("button", { name: "Expand", exact: true })).toHaveCount(0)
  expect((await new AxeBuilder({ page }).include("#argus-panel").withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()).violations).toEqual([])
  await panel.screenshot({ path: testInfo.outputPath("argus-current-view.png") })
})

test("Argus reports missing selections instead of analyzing a substitute", async ({ page }) => {
  await page.goto("/explore/kuakata-bangladesh?left=not-loaded&right=also-not-loaded")
  await page.getByRole("button", { name: "Ask Argus evidence guide" }).click()
  await expect(page.locator("#argus-panel").getByText(/loaded \/ \d+ in this footprint/)).toBeVisible()
  await page.locator("#argus-panel").getByRole("button", { name: "What changed?", exact: true }).click()
  await expect(page.getByRole("log", { name: "Argus conversation" })).toContainText("selection is not loaded")
})
