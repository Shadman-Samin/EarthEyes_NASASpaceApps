import { expect, test } from "./live-fixtures"

test("the app does not wait for a mock service worker to render", async ({ page }) => {
  await page.addInitScript(() => {
    Object.defineProperty(navigator.serviceWorker, "register", { value: () => new Promise(() => {}) })
  })
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
})

test("landing has one usable navigation header across screen sizes", async ({ page }) => {
  for (const width of [1440, 768, 360]) {
    await page.setViewportSize({ width, height: 900 })
    await page.goto("/")
    await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
    await expect(page.getByRole("link", { name: /^EarthEyes.*home$/i })).toHaveCount(1)
    expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
    const menu = page.getByRole("button", { name: "Open navigation", exact: true })
    if (await menu.isVisible()) {
      await menu.click()
      await expect(page.getByRole("navigation", { name: "Mobile navigation" })).toBeVisible()
    }
  }
})

test("shared surfaces remain opaque and hero decoration stays behind its content", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/")
  await expect(page.getByRole("heading", { level: 1 })).toBeVisible()
  await expect(page.locator("body")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
  expect(await page.locator(".landing-hero").evaluate((hero) => {
    const decoration = Number.parseInt(getComputedStyle(hero, "::before").zIndex) || 0
    const copy = Number.parseInt(getComputedStyle(hero.querySelector(".landing-hero__copy")!).zIndex) || 0
    return decoration < copy
  })).toBe(true)
  await page.goto("/explore/kuakata-bangladesh?module=coastal")
  await expect(page.getByLabel("Explorer controls")).toBeVisible()
  await expect(page.locator(".control-rail")).not.toHaveCSS("background-color", "rgba(0, 0, 0, 0)")
})

test("comparison mode opens its view without stealing keyboard focus", async ({ page }) => {
  await page.setViewportSize({ width: 1440, height: 900 })
  await page.goto("/explore/kuakata-bangladesh?module=coastal")
  const sideBySide = page.getByLabel("Explorer controls").getByRole("button", { name: "Side by side", exact: true })
  await sideBySide.focus()
  await page.keyboard.press("Enter")
  await expect(page.getByRole("heading", { name: "SAR browse previews" })).toBeVisible()
  await expect(sideBySide).toBeFocused()
})
