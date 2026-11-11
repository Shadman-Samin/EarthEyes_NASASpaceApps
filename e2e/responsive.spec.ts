import { expect, test } from "./live-fixtures"

test("landing and explorer do not overflow from 320px to 1920px", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Canonical responsive sweep")
  for (const width of [320, 360, 768, 1280, 1920]) {
    await page.setViewportSize({ width, height: width < 800 ? 800 : 1000 })
    await page.goto("/")
    await page.getByRole("heading", { level: 1 }).waitFor()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `landing overflow at ${width}px`).toBe(true)

    await page.goto("/explore/kuakata-bangladesh?module=coastal")
    await page.getByLabel("Observation timeline").waitFor()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `explorer overflow at ${width}px`).toBe(true)
  }
})
