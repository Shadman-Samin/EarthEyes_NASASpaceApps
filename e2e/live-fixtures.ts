import { test as base, expect } from "@playwright/test"

type CatalogueItem = {
  id: string
  collectionId: string
  provider: string
  sourceMaturity: string
  processingFamily: string
  acquiredAt: string
  startAt: null
  endAt: null
  bbox: number[]
  geometry: null
  platform: string | null
  relativeOrbit: null
  absoluteOrbit: null
  orbitDirection: null
  polarizations: string[]
  sourceUrl: string
  assets: Array<{ key: string; href: string; roles: string[]; mediaType: string; sizeBytes: null; access: string }>
}

function operaItems(bbox: number[]): CatalogueItem[] {
  return ["T001-000001-IW1", "T002-000002-IW1"].flatMap((burst) => ["2024-05-03T06:00:00Z", "2024-05-15T06:00:00Z"].map((date) => {
    const id = `OPERA_L2_RTC-S1_${burst}_${date.replace(/[-:]/g, "")}_TEST_S1A_30_v1.0`
    return {
      id, collectionId: "OPERA_L2_RTC-S1_V1_1", provider: "asf", sourceMaturity: "validated", processingFamily: "OPERA-RTC-S1",
      acquiredAt: date, startAt: null, endAt: null, bbox, geometry: null,
      platform: "Sentinel-1A", relativeOrbit: null, absoluteOrbit: null, orbitDirection: null, polarizations: [],
      sourceUrl: `https://cmr.earthdata.nasa.gov/stac/ASF/collections/OPERA_L2_RTC-S1_V1_1/items/${id}`,
      assets: [{ key: "browse", href: `https://datapool.asf.alaska.edu/BROWSE/OPERA-S1/${id}_BROWSE_low-res.png`, roles: ["browse"], mediaType: "image/png", sizeBytes: null, access: "public" }],
    }
  }))
}

function nisarItems(bbox: number[]): CatalogueItem[] {
  const frames = ["023_069_A_012_4005_DHDH_A", "023_091_D_077_2005_DHDH_M"]
  return frames.flatMap((frame) => ["2026-06-18T23:20:37Z", "2026-06-30T23:20:36Z"].map((date) => {
    const id = `NISAR_L2_PR_GCOV_${frame}_${date.replace(/[-:]/g, "")}_P05023_N_P_J_001`
    const base = "https://nisar.asf.earthdatacloud.nasa.gov/BROWSE/NISAR_L2_GCOV_PROVISIONAL_V1"
    return {
      id, collectionId: "NISAR_L2_GCOV_PROVISIONAL_V1_1", provider: "asf", sourceMaturity: "provisional", processingFamily: "NISAR-GCOV",
      acquiredAt: date, startAt: null, endAt: null, bbox, geometry: null,
      platform: null, relativeOrbit: null, absoluteOrbit: null, orbitDirection: null, polarizations: [],
      sourceUrl: `https://cmr.earthdata.nasa.gov/stac/ASF/collections/NISAR_L2_GCOV_PROVISIONAL_V1_1/items/${id}`,
      assets: [
        { key: "browse", href: `${base}/${id}/${id}_NATIVE_B_HVHV.png`, roles: ["browse"], mediaType: "image/png", sizeBytes: null, access: "public" },
        { key: "thumbnail_0", href: `${base}/${id}/${id}_NATIVE_A_HVHV.png`, roles: ["thumbnail"], mediaType: "image/png", sizeBytes: null, access: "public" },
        { key: "thumbnail_1", href: `${base}/${id}/${id}_NATIVE_B_HHHH.png`, roles: ["thumbnail"], mediaType: "image/png", sizeBytes: null, access: "public" },
      ],
    }
  }))
}

export const test = base.extend<{ liveArchive: void }>({
  liveArchive: [async ({ page }, use) => {
    // Browser verification must not spend an account's AI quota or send live credentials.
    await page.route("https://api.groq.com/**", (route) => route.abort())
    // Verify our embed contract without depending on YouTube availability or its changing UI.
    await page.route("https://www.youtube.com/embed/**", (route) => route.fulfill({
      contentType: "text/html",
      body: '<!doctype html><html lang="en"><head><title>Walkthrough player test boundary</title></head><body><main><p>YouTube player placeholder for deterministic browser tests.</p></main></body></html>',
    }))
    await page.route("**/api/catalog/search?*", (route) => {
      const params = new URL(route.request().url()).searchParams
      const bbox = params.get("bbox")!.split(",").map(Number)
      const product = params.get("product")
      const items = product === "opera-rtc-s1" ? operaItems(bbox) : nisarItems(bbox)
      return route.fulfill({ json: {
        query: { product, bbox, start: params.get("start"), end: params.get("end"), limit: Number(params.get("limit")) },
        provider: "asf", fetchedAt: "2026-11-11T00:00:00Z", metadataOnly: true, items, next: [], hasMore: false,
      } })
    })
    await page.route(/nisar\.asf\.earthdatacloud\.nasa\.gov|datapool\.asf\.alaska\.edu/, (route) => route.fulfill({
      contentType: "image/svg+xml",
      headers: { "Access-Control-Allow-Origin": "*" },
      body: '<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#aab4ad"/></svg>',
    }))
    await use()
  }, { auto: true }],
})

export { expect }
