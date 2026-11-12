import AxeBuilder from "@axe-core/playwright"
import { expect, test } from "./live-fixtures"

test("visitor searches Kuakata and changes comparison mode", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop workspace journey")
  await page.goto("/explore/jakobshavn-glacier?module=ice&mode=swipe")
  const search = page.getByRole("combobox", { name: "Search places and investigations" }).first()
  await search.fill("Kuakata")
  await page.getByRole("option", { name: /Kuakata coast/ }).click()
  await expect(page).toHaveURL(/explore\/kuakata-bangladesh/)
  await expect(page.getByRole("heading", { level: 1, name: "Kuakata Bangladesh" })).toBeVisible()
  await page.getByRole("button", { name: "Compare" }).first().click()
  await expect(page.getByRole("heading", { name: /Jelly swipe comparison/ })).toBeVisible()
  const controls = page.getByLabel("Explorer controls")
  if (await controls.isVisible()) {
    await controls.getByText("Advanced (optional)", { exact: true }).click()
    await controls.getByRole("button", { name: "Side by side" }).click()
    await expect(page).toHaveURL(/mode=side-by-side/)
    await page.reload()
    await controls.getByText("Advanced (optional)", { exact: true }).click()
    await expect(controls.getByRole("button", { name: "Side by side" })).toHaveAttribute("aria-pressed", "true")
    await expect(page.getByRole("heading", { name: "SAR browse previews" })).toBeVisible()
  }
})

test("landing page has no serious accessibility violations", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Chromium is the canonical axe audit project")
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  const results = await new AxeBuilder({ page }).withTags(["wcag2a", "wcag2aa", "wcag21aa", "wcag22aa"]).analyze()
  expect(results.violations.filter((violation) => ["serious", "critical"].includes(violation.impact ?? ""))).toEqual([])
})

test("mobile explorer exposes controls through a bottom sheet", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile-only journey")
  await page.goto("/explore/jakobshavn-glacier?module=ice")
  await page.getByRole("button", { name: /Controls/ }).click()
  await expect(page.getByRole("dialog", { name: "controls panel" })).toBeVisible()
  await expect(page.getByText("Auto analysis")).toBeVisible()
})

test("GroundLine separates authority notices from review candidates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Canonical GroundLine journey")
  await page.goto("/groundline")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Before a warning")
  await expect(page.getByText("Authority-issued demo records")).toBeVisible()
  await page.getByRole("tab", { name: "Review candidates" }).click()
  await expect(page.getByText("Internal review only")).toBeVisible()
  await expect(page.getByText(/must not appear in a public alert feed/i)).toBeVisible()
})

test("Save-Data mode preserves evidence without remote imagery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Canonical low-bandwidth journey")
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "connection", { configurable: true, value: { saveData: true } })
  })
  await page.goto("/explore/jakobshavn-glacier?module=ice&mode=swipe")
  await expect(page.getByText(/remote basemap tiles are paused/i)).toBeVisible()
  await page.getByRole("button", { name: "Compare" }).first().click()
  await expect(page.getByText(/imagery paused/i).first()).toBeVisible()
})

test("difference analysis stays exploratory and safety controls remain available", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Canonical safety-state journey")
  await page.goto("/explore/imja-tsho-nepal?module=ice")
  const controls = page.getByLabel("Explorer controls")
  await controls.getByText("Advanced (optional)", { exact: true }).click()
  await expect(controls.getByRole("button", { name: /GLOF/ })).toBeVisible()
  await controls.getByRole("button", { name: /GLOF/ }).click()
  await expect(page.getByLabel("Observation timeline")).toBeVisible()
  await expect(controls.getByText("Authority assessment")).toHaveCount(0)

  await page.goto("/explore/kuakata-bangladesh?module=coastal&mode=difference&view=compare")
  await expect(page.getByRole("heading", { name: "Exploratory difference" })).toBeVisible()
  await expect(page.getByText(/not calibrated, not georeferenced, not a change measurement/i)).toBeVisible()
})
