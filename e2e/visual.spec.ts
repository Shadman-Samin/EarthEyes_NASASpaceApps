import { expect, test } from "./live-fixtures"

test("landing page visual baseline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop visual baseline")
  await page.goto("/")
  await page.getByRole("heading", { level: 1 }).waitFor()
  await page.getByRole("heading", { name: "Kuakata", exact: true }).waitFor()
  await page.evaluate(() => document.fonts.ready)
  await expect(page).toHaveScreenshot("landing-desktop.png", { fullPage: true, animations: "disabled" })
})

test("mobile explorer visual baseline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile visual baseline")
  await page.goto("/explore/jakobshavn-glacier?module=ice&mode=swipe")
  await page.getByRole("button", { name: /Controls/ }).waitFor()
  await page.getByLabel("Observation timeline").waitFor()
  await page.locator(".earth-map__preview img").evaluate((image: HTMLImageElement) => image.decode())
  await page.evaluate(() => document.fonts.ready)
  await page.addStyleTag({ content: ".earth-map__canvas { visibility: hidden !important; } .earth-map { background: #173a36 !important; }" })
  await expect(page).toHaveScreenshot("explorer-mobile.png", { animations: "disabled", mask: [page.getByRole("button", { name: "Search this map area", exact: true })] })
})
