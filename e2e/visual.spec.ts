import { expect, test } from "@playwright/test"

test("landing page visual baseline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Desktop visual baseline")
  await page.goto("/")
  await page.getByRole("heading", { level: 1 }).waitFor()
  await expect(page).toHaveScreenshot("landing-desktop.png", { fullPage: true, animations: "disabled" })
})

test("mobile explorer visual baseline", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile visual baseline")
  await page.goto("/explore/jakobshavn-glacier?module=ice&mode=swipe")
  await page.getByRole("button", { name: /Controls/ }).waitFor()
  await page.addStyleTag({ content: ".earth-map__canvas { visibility: hidden !important; } .earth-map { background: #173a36 !important; }" })
  await expect(page).toHaveScreenshot("explorer-mobile.png", { animations: "disabled" })
})
