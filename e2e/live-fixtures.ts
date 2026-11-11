import { test as base, expect } from "@playwright/test"

export const test = base.extend<{ liveArchive: void }>({
  liveArchive: [async ({ page }, use) => {
    await page.route("**/api/catalog/search?*", (route) => {
      const params = new URL(route.request().url()).searchParams
      const bbox = params.get("bbox")!.split(",").map(Number)
      const items = ["T001-000001-IW1", "T002-000002-IW1"].flatMap((burst) => ["2024-05-03T06:00:00Z", "2024-05-15T06:00:00Z"].map((date) => {
        const id = `OPERA_L2_RTC-S1_${burst}_${date.replace(/[-:]/g, "")}_TEST_S1A_30_v1.0`
        return {
          id, collectionId: "OPERA_L2_RTC-S1_V1_1", provider: "asf", sourceMaturity: "validated", processingFamily: "OPERA-RTC-S1",
          acquiredAt: date, startAt: null, endAt: null, bbox, geometry: null,
          platform: "Sentinel-1A", relativeOrbit: null, absoluteOrbit: null, orbitDirection: null, polarizations: [],
          sourceUrl: `https://cmr.earthdata.nasa.gov/stac/ASF/collections/OPERA_L2_RTC-S1_V1_1/items/${id}`,
          assets: [{ key: "browse", href: `https://datapool.asf.alaska.edu/BROWSE/OPERA-S1/${id}_BROWSE_low-res.png`, roles: ["browse"], mediaType: "image/png", sizeBytes: null, access: "public" }],
        }
      }))
      return route.fulfill({ json: {
        query: { product: "opera-rtc-s1", bbox, start: params.get("start"), end: params.get("end"), limit: Number(params.get("limit")) },
        provider: "asf", fetchedAt: "2026-11-11T00:00:00Z", metadataOnly: true, items, next: [], hasMore: false,
      } })
    })
    await page.route("https://datapool.asf.alaska.edu/BROWSE/**", (route) => route.fulfill({
      contentType: "image/svg+xml", body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#aab4ad"/></svg>',
    }))
    await use()
  }, { auto: true }],
})

export { expect }
