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
    await controls.getByRole("button", { name: "Side by side" }).click()
    await expect(page).toHaveURL(/mode=side-by-side/)
    await page.reload()
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
  await expect(page.getByText("Evidence layers")).toBeVisible()
})

test("Argus docks, minimizes, and keeps contextual safety language", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Canonical desktop Argus journey")
  await page.goto("/explore/imja-tsho-nepal?module=glof")
  await page.getByRole("button", { name: /Ask Argus/ }).click()
  const argus = page.getByLabel("Argus evidence guide")
  await expect(argus).toBeVisible()
  await argus.getByRole("button", { name: "Right" }).click()
  await expect(argus.getByRole("button", { name: "Right" })).toHaveAttribute("aria-pressed", "true")
  await argus.getByRole("button", { name: "Why is this not proof?" }).click()
  await expect(argus.getByText(/not an automatic public warning/i)).toBeVisible()
  await argus.getByRole("button", { name: "Minimize Argus" }).click()
  await expect(page.getByRole("button", { name: /Argus \/ docked-right/ })).toBeVisible()
})

test("GroundLine separates authority notices from review candidates", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Canonical GroundLine journey")
  await page.goto("/groundline")
  await expect(page.getByRole("heading", { level: 1 })).toContainText("Warnings should reach")
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

test("unimplemented measurements and difference analysis fail closed without hiding controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Canonical safety-state journey")
  await page.goto("/explore/imja-tsho-nepal?module=ice")
  const controls = page.getByLabel("Explorer controls")
  await expect(page.getByText("Measurements unavailable", { exact: true })).toBeVisible()
  await expect(controls.getByRole("button", { name: /GLOF/ })).toBeVisible()
  await controls.getByRole("button", { name: /GLOF/ }).click()
  await expect(page.getByLabel("Observation timeline")).toBeVisible()
  await expect(controls.getByText("Authority assessment")).toHaveCount(0)

  await page.goto("/explore/kuakata-bangladesh?module=coastal&mode=difference&view=compare&left=kua-s1-20240413&right=kua-nisar-20261018")
  await expect(page.getByText("Calibrated difference unavailable", { exact: true })).toBeVisible()
})
