import { test, expect } from "./live-fixtures"

test("shared selections never silently substitute a different acquisition or footprint", async ({ page }) => {
  for (const selection of ["right=NOT-LOADED", "burst=NOT-LOADED"]) {
    await page.goto(`/explore/kuakata-bangladesh?view=compare&mode=side-by-side&${selection}`)
    await expect(page.getByText("Selection not loaded", { exact: true })).toBeVisible()
    await expect(page.locator('.comparison-viewer[data-origin="live"] img')).toHaveCount(0)
    await page.getByRole("button", { name: "Use loaded", exact: true }).click()
    await expect(page.locator('.comparison-viewer[data-origin="live"] img')).toHaveCount(2)
  }
})

test("the development explorer loads its map worker from a valid JavaScript URL", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "firefox", "Firefox development-worker regression")
  const { createServer } = await import("vite")
  const server = await createServer({ server: { host: "127.0.0.1", port: 0 }, logLevel: "silent" })
  try {
    await server.listen()
    const workerResponse = page.waitForResponse((response) => response.url().includes("maplibre-gl-worker"), { timeout: 20000 })
    await page.goto(`${server.resolvedUrls!.local[0]}explore/kuakata-bangladesh`)
    const response = await workerResponse
    expect(response.ok()).toBe(true)
    expect(response.headers()["content-type"]).toMatch(/javascript/)
  } finally { await server.close() }
})

test("the production explorer loads its map worker from a JavaScript asset", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "chromium", "Canonical production-worker regression")
  const workerResponse = page.waitForResponse((response) => response.url().includes("maplibre-gl-worker"), { timeout: 20000 })
  await page.goto("/explore/kuakata-bangladesh")
  const response = await workerResponse
  expect(response.ok()).toBe(true)
  expect(response.headers()["content-type"]).toMatch(/javascript/)
})

test("the existing explorer loads real NISAR source images and keeps its comparison controls", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop workspace journey")
  await page.goto("/explore/kuakata-bangladesh?module=coastal&view=compare&mode=swipe")
  await expect(page.getByText("Live radar data", { exact: true }).first()).toBeVisible()
  await expect(page.getByRole("heading", { name: "Jelly swipe comparison" })).toBeVisible()
  const viewer = page.locator('.comparison-viewer[data-origin="live"]')
  await expect(viewer.locator('img[src*="nisar.asf.earthdatacloud.nasa.gov"]')).toHaveCount(2)
  await expect(viewer.locator("img").first()).toHaveCSS("filter", "none")
  await expect(page.getByLabel("Evidence drawer").getByText("Real-time analysis", { exact: true })).toBeVisible()
  await page.getByLabel("Explorer controls").getByText("Advanced (optional)", { exact: true }).click()
  await expect(page.getByLabel("Explorer controls").getByRole("button", { name: "Difference", exact: true })).toBeEnabled()
  await page.getByLabel("Explorer controls").getByRole("button", { name: "Difference", exact: true }).click()
  await expect(page.getByRole("heading", { name: "Exploratory difference" })).toBeVisible()
  await expect(page.locator(".live-difference canvas")).toBeVisible()
  await expect(page.getByText(/Exploratory pixel difference of official browse renders/)).toBeVisible()
  await page.getByLabel("Explorer controls").getByRole("button", { name: "Side by side", exact: true }).click()
  await expect(page.getByRole("heading", { name: "SAR browse previews" })).toBeVisible()
  await page.getByLabel("Explorer controls").getByText("Advanced options (optional)", { exact: true }).click()
  await page.getByRole("combobox", { name: "Footprint", exact: true }).selectOption("091_D_077")
  await expect(viewer.locator('img[src*="091_D_077"]')).toHaveCount(2)
  await expect(page.getByRole("link", { name: "Live catalogue", exact: true })).toHaveCount(0)
})

test("the polarization switch reloads the same NISAR acquisitions with co-pol imagery", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop workspace journey")
  await page.goto("/explore/kuakata-bangladesh?module=coastal&view=compare&mode=side-by-side")
  const viewer = page.locator('.comparison-viewer[data-origin="live"]')
  await expect(viewer.locator('img[src*="NATIVE_B_HVHV"]')).toHaveCount(2)
  await page.getByLabel("Explorer controls").getByText("Advanced options (optional)", { exact: true }).click()
  await page.getByRole("combobox", { name: "Polarization", exact: true }).selectOption("HHHH")
  await expect(viewer.locator('img[src*="NATIVE_B_HHHH"]')).toHaveCount(2)
  await expect(page.locator(".observation-image, .comparison-image").first()).toBeVisible()
})

test("the OPERA product switch restores the Sentinel-1 C-band archive", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name === "mobile", "Desktop workspace journey")
  await page.goto("/explore/kuakata-bangladesh?module=coastal&view=compare&product=opera-rtc-s1&start=2024-05-01&end=2024-05-31")
  await expect(page.getByText("Live radar data", { exact: true }).first()).toBeVisible()
  const viewer = page.locator('.comparison-viewer[data-origin="live"]')
  await expect(viewer.locator('img[src*="datapool.asf.alaska.edu"]')).toHaveCount(2)
  await page.getByLabel("Explorer controls").getByText("Advanced options (optional)", { exact: true }).click()
  await expect(page.getByRole("combobox", { name: "Footprint", exact: true })).toBeVisible()
  await page.getByRole("combobox", { name: "Footprint", exact: true }).selectOption("T002-000002-IW1")
  await expect(viewer.locator('img[src*="T002-000002-IW1"]')).toHaveCount(2)
})

test("the explorer reports provider failure without falling back to fixture observations", async ({ page }) => {
  await page.route("**/api/catalog/search?*", (route) => route.fulfill({ status: 503, json: { error: { message: "The satellite provider is unavailable." } } }))
  const unavailable = page.waitForResponse((response) => response.url().includes("/api/catalog/search?") && response.status() === 503)
  await page.goto("/explore/kuakata-bangladesh")
  await unavailable
  await expect(page.getByText("Could not load data", { exact: true })).toBeVisible()
  await expect(page.locator(".explorer-center").getByText("The satellite provider is unavailable.", { exact: true })).toBeVisible()
  await expect(page.getByLabel("Observation timeline")).toHaveCount(0)
  await expect(page.locator('img[src*="unsplash"]')).toHaveCount(0)
})

test("mobile comparison uses the same live acquisitions", async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== "mobile", "Mobile workspace journey")
  await page.goto("/explore/kuakata-bangladesh?module=coastal")
  await expect(page.getByLabel("Observation timeline")).toBeVisible()
  await page.getByRole("navigation", { name: "Explorer panels" }).getByRole("button", { name: "Compare", exact: true }).click()
  const dialog = page.getByRole("dialog", { name: "comparison panel" })
  await expect(dialog.locator('img[src*="nisar.asf.earthdatacloud.nasa.gov"]')).toHaveCount(2)
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth + 1)).toBe(true)
})
