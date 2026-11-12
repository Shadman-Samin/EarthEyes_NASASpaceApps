import { expect, test } from "./live-fixtures"

for (const width of [320, 360, 768, 1280, 1920]) {
  test(`editorial routes and explorer fit a ${width}px viewport`, async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== "chromium", "Canonical responsive sweep")
    test.setTimeout(90_000)
    await page.setViewportSize({ width, height: width < 800 ? 800 : 1000 })
    for (const path of ["/", "/methodology", "/data-sources", "/data-sources/nisar", "/groundline", "/about", "/stories/kuakata-changing-coast", "/stories/barishal-water-land", "/stories/jakobshavn-ice-in-motion", "/stories/imja-lake-review"]) {
      await page.goto(path)
      await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
      await expect(page.locator(".skeleton")).toHaveCount(0)
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `${path} overflow at ${width}px`).toBe(true)
      await expect(page.getByRole("heading", { level: 1 })).toHaveCount(1)
    }
    await page.goto("/explore/kuakata-bangladesh?module=coastal")
    await page.getByLabel("Observation timeline").waitFor()
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth + 1), `explorer overflow at ${width}px`).toBe(true)
  })
}
