import { afterEach, describe, expect, it, vi } from "vitest"
import type { CatalogueQuery } from "../../../src/domain/catalogue"
import { searchCatalogue } from "./catalogue"

const query: CatalogueQuery = {
  product: "opera-rtc-s1", bbox: [-51.2, 68.9, -50.7, 69.3],
  start: "2024-05-01", end: "2024-05-31", limit: 2,
}
const endpoint = "https://cmr.earthdata.nasa.gov/stac/ASF/search"
const item = {
  type: "Feature", stac_version: "1.0.0", id: "OPERA_TEST",
  collection: "OPERA_L2_RTC-S1_V1_1",
  bbox: [-51.7, 68.7, -49.2, 69.4],
  geometry: {
    type: "Polygon",
    coordinates: [[[-51.7, 68.7], [-49.2, 68.7], [-49.2, 69.4], [-51.7, 68.7]]],
  },
  properties: {
    datetime: "2024-05-31T06:40:46.572Z",
    start_datetime: "2024-05-31T06:40:46.572Z",
    end_datetime: "2024-05-31T06:40:49.000Z",
  },
  assets: {
    "0_HH": { href: "https://datapool.asf.alaska.edu/RTC/test_HH.tif", roles: ["data"] },
    "0_HV": { href: "https://datapool.asf.alaska.edu/RTC/test_HV.tif", roles: ["data"] },
    "0_mask": { href: "https://datapool.asf.alaska.edu/RTC/test_mask.tif", roles: ["data"] },
    browse: { href: "https://datapool.asf.alaska.edu/BROWSE/test.png", roles: ["browse"], type: "image/png" },
    s3: { href: "s3://example/test_HH.tif", roles: ["data"] },
  },
  links: [],
}

function page(features: unknown[] = [item], links: unknown[] = []) {
  return Response.json({ type: "FeatureCollection", features, links })
}

function nextLink(url: URL, token = "provider-cursor") {
  const next = new URL(url)
  next.searchParams.set("cursor", token)
  return { rel: "next", href: next.href, method: "GET" }
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("bounded live catalogue", () => {
  it("queries only metadata and preserves unknown NASA SAR properties", async () => {
    const upstream = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(async () => page())
    vi.stubGlobal("fetch", upstream)
    const result = await searchCatalogue(query)
    const [url, init] = upstream.mock.calls[0]
    expect(url.origin + url.pathname).toBe(endpoint)
    expect(Object.fromEntries(url.searchParams)).toEqual({
      collections: "OPERA_L2_RTC-S1_V1_1", bbox: "-51.2,68.9,-50.7,69.3",
      datetime: "2024-05-01T00:00:00.000Z/2024-05-31T23:59:59.999Z", limit: "2",
    })
    expect(init.redirect).toBe("manual")
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(result.metadataOnly).toBe(true)
    expect(result.hasMore).toBe(false)
    expect(result.items[0]).toMatchObject({
      id: "OPERA_TEST", collectionId: "OPERA_L2_RTC-S1_V1_1",
      acquiredAt: "2024-05-31T06:40:46.572Z", relativeOrbit: null,
      absoluteOrbit: null, orbitDirection: null, platform: null,
      polarizations: [], sourceMaturity: "validated", processingFamily: "OPERA-RTC-S1",
    })
    expect(result.items[0].assets.map((asset) => asset.key)).toEqual(["0_HH", "0_HV", "0_mask", "browse"])
    expect(result.items[0].assets[0].sizeBytes).toBeNull()
    expect(result.items[0].assets[0].access).toBe("earthdata-login")
    expect(result.items[0].sourceUrl).toBe("https://cmr.earthdata.nasa.gov/stac/ASF/collections/OPERA_L2_RTC-S1_V1_1/items/OPERA_TEST")
  })

  it("normalizes Microsoft timestamps and removes signing credentials without requesting tokens", async () => {
    const upstream = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(async () => page([{
      ...item, id: "S1_TEST", collection: "sentinel-1-rtc",
      properties: {
        datetime: "2024-05-31T06:40:46.572736Z",
        start_datetime: "2024-05-31 06:40:28.922424+00:00",
        end_datetime: "2024-05-31 06:41:04.223047+00:00",
        platform: "SENTINEL-1A", "sat:relative_orbit": 139,
        "sat:absolute_orbit": 54111, "sat:orbit_state": "ascending",
        "sar:polarizations": ["VV", "VH"],
      },
      assets: {
        vv: {
          href: "https://sentinel1euwestrtc.blob.core.windows.net/sentinel1-grd-rtc/vv.tiff?sv=version&sig=test-signature&se=expiry",
          roles: ["data"], type: "image/tiff; application=geotiff; profile=cloud-optimized",
          "file:size": 1861758367,
        },
        unsafe: { href: "https://name:password@untrusted.test/file.tif", roles: ["data"] },
      },
    }]))
    vi.stubGlobal("fetch", upstream)
    const result = await searchCatalogue({ ...query, product: "sentinel-1-rtc" })
    expect(result.items[0]).toMatchObject({
      acquiredAt: "2024-05-31T06:40:46.572Z", startAt: "2024-05-31T06:40:28.922Z",
      endAt: "2024-05-31T06:41:04.223Z", relativeOrbit: 139, absoluteOrbit: 54111,
      orbitDirection: "ascending", polarizations: ["VV", "VH"], sourceMaturity: "not-specified",
    })
    expect(result.items[0].assets).toHaveLength(1)
    expect(result.items[0].assets[0]).toMatchObject({
      href: "https://sentinel1euwestrtc.blob.core.windows.net/sentinel1-grd-rtc/vv.tiff",
      sizeBytes: 1861758367, access: "planetary-computer-account",
    })
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(String(upstream.mock.calls[0][0])).toContain("/api/stac/v1/search?")
  })

  it("supports NISAR asset keys that are not conventional band names", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => page([{
      ...item, id: "NISAR_TEST", collection: "NISAR_L2_GCOV_V1_1",
      assets: { "gov/NISAR/GCOV/product": { href: "https://nisar.asf.earthdatacloud.nasa.gov/NISAR/test.h5", roles: ["data"] } },
    }])))
    const result = await searchCatalogue({ ...query, product: "nisar-gcov" })
    expect(result.items[0].assets[0].key).toBe("gov/NISAR/GCOV/product")
    expect(result.items[0].processingFamily).toBe("NISAR-GCOV")
  })

  it("removes legacy signed-URL credentials before publishing asset references", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => page([{
      ...item,
      assets: { data: {
        href: "https://datapool.asf.alaska.edu/RTC/test.tif?AWSAccessKeyId=test-key&Signature=test-signature&Expires=12345",
        roles: ["data"],
      } },
    }])))
    const result = await searchCatalogue(query)
    expect(result.items[0].assets[0].href).toBe("https://datapool.asf.alaska.edu/RTC/test.tif")
  })

  it("represents an empty successful search without inventing coverage or measurements", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => page([])))
    const result = await searchCatalogue(query)
    expect(result.items).toEqual([])
    expect(result.next).toEqual([])
    expect(result.hasMore).toBe(false)
    expect(result).not.toHaveProperty("measurements")
  })

  it("returns a continuation bound to the search and uses only its provider token", async () => {
    const upstream = vi.fn(async (url: URL) => page([item], [nextLink(url)]))
    vi.stubGlobal("fetch", upstream)
    const first = await searchCatalogue(query)
    expect(first.hasMore).toBe(true)
    expect(first.next[0].bbox).toEqual([-51.2, 68.9, -50.7, 69.3])
    upstream.mockImplementation(async () => page([]))
    await searchCatalogue({ ...query, ...first.next[0] })
    expect(upstream.mock.calls[1][0].searchParams.get("cursor")).toBe("provider-cursor")
    await expect(searchCatalogue({ ...query, ...first.next[0], end: "2024-05-30" }))
      .rejects.toMatchObject({ status: 400, code: "invalid_cursor" })
    expect(upstream).toHaveBeenCalledTimes(2)
  })

  it("handles Microsoft's different pagination token parameter", async () => {
    const upstream = vi.fn(async (url: URL) => {
      const next = new URL(url)
      next.searchParams.set("token", "next:sentinel-1-rtc:S1_TEST")
      return page([], [{ rel: "next", href: next.href }])
    })
    vi.stubGlobal("fetch", upstream)
    const pcQuery = { ...query, product: "sentinel-1-rtc" as const }
    const first = await searchCatalogue(pcQuery)
    upstream.mockImplementation(async () => page([]))
    await searchCatalogue({ ...pcQuery, ...first.next[0] })
    expect(upstream.mock.calls[1][0].searchParams.get("token")).toBe("next:sentinel-1-rtc:S1_TEST")
  })

  it.each([
    "https://untrusted.test/api/search?cursor=x",
    "https://cmr.earthdata.nasa.gov/search/concepts/data.xml?cursor=x",
  ])("rejects an unsafe continuation %s without following it", async (href) => {
    const upstream = vi.fn(async () => page([item], [{ rel: "next", href }]))
    vi.stubGlobal("fetch", upstream)
    await expect(searchCatalogue(query)).rejects.toMatchObject({ status: 502, code: "invalid_provider_response" })
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it("rejects a continuation that changes the requested collection", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => {
      const link = nextLink(url)
      const changed = new URL(link.href)
      changed.searchParams.set("collections", "NISAR_L2_GCOV_V1_1")
      return page([item], [{ ...link, href: changed.href }])
    }))
    await expect(searchCatalogue(query)).rejects.toMatchObject({ code: "invalid_provider_response" })
  })

  it("splits the dateline, deduplicates the combined page, and exposes both continuations", async () => {
    const upstream = vi.fn(async (url: URL) => page([item], [nextLink(url, url.searchParams.get("bbox")!)]))
    vi.stubGlobal("fetch", upstream)
    const result = await searchCatalogue({ ...query, bbox: [179, -20, -179, -16] })
    expect(upstream.mock.calls.map(([url]) => url.searchParams.get("bbox"))).toEqual([
      "179,-20,180,-16", "-180,-20,-179,-16",
    ])
    expect(result.items).toHaveLength(1)
    expect(result.next.map((next) => next.bbox)).toEqual([[179, -20, 180, -16], [-180, -20, -179, -16]])
    expect(result.hasMore).toBe(true)
  })

  it("does not query an empty longitude partition at 180 degrees", async () => {
    const upstream = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(async () => page([]))
    vi.stubGlobal("fetch", upstream)
    await searchCatalogue({ ...query, bbox: [180, -20, -179, -16] })
    expect(upstream).toHaveBeenCalledTimes(1)
    expect((upstream.mock.calls[0][0] as URL).searchParams.get("bbox")).toBe("-180,-20,-179,-16")
  })

  it("fails a dateline search rather than presenting a successful half as complete", async () => {
    vi.stubGlobal("fetch", vi.fn(async (url: URL) => url.searchParams.get("bbox")?.startsWith("-180")
      ? new Response("Unavailable", { status: 503 }) : page()))
    await expect(searchCatalogue({ ...query, bbox: [179, -20, -179, -16] }))
      .rejects.toMatchObject({ status: 503, code: "provider_unavailable" })
  })

  it.each([
    { ...item, collection: "unexpected" },
    { ...item, properties: { datetime: "2024-02-30T12:00:00Z" } },
    { ...item, properties: { datetime: "2024-05-31T06:00:00" } },
    { ...item, properties: { datetime: "not-a-date" } },
    { ...item, properties: { ...item.properties, start_datetime: "" } },
    { ...item, properties: { ...item.properties, end_datetime: "" } },
    { ...item, geometry: { type: "Polygon", coordinates: [[[0, 0], [1, 1]]] } },
    { ...item, properties: { ...item.properties, "sat:relative_orbit": -1 } },
  ])("rejects invalid provider records instead of inventing metadata", async (invalid) => {
    vi.stubGlobal("fetch", vi.fn(async () => page([invalid])))
    await expect(searchCatalogue(query)).rejects.toMatchObject({ status: 502, code: "invalid_provider_response" })
  })

  it("rejects more provider results than requested", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => page([item, item, item])))
    await expect(searchCatalogue(query)).rejects.toMatchObject({ code: "invalid_provider_response" })
  })

  it("does not expose an upstream error body or retry beyond the request budget", async () => {
    const upstream = vi.fn(async () => new Response("private upstream details", { status: 500 }))
    vi.stubGlobal("fetch", upstream)
    await expect(searchCatalogue(query)).rejects.toMatchObject({ code: "provider_unavailable", status: 503 })
    expect(upstream).toHaveBeenCalledTimes(1)
  })

  it("does not follow upstream redirects to another resource", async () => {
    const upstream = vi.fn<(url: URL, init: RequestInit) => Promise<Response>>(async () => new Response(null, {
      status: 302, headers: { Location: "https://untrusted.test/large-file.tif" },
    }))
    vi.stubGlobal("fetch", upstream)
    await expect(searchCatalogue(query)).rejects.toMatchObject({ code: "provider_unavailable", status: 503 })
    expect(upstream).toHaveBeenCalledTimes(1)
    expect(upstream.mock.calls[0][1].redirect).toBe("manual")
  })

  it("preserves an upstream rate limit with a bounded retry interval", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "Retry-After": "30" } })))
    await expect(searchCatalogue(query)).rejects.toMatchObject({ status: 429, code: "provider_rate_limited", retryAfter: "30" })
  })

  it("rejects HTML responses instead of treating an authentication page as data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<html>Sign in</html>", { headers: { "Content-Type": "text/html" } })))
    await expect(searchCatalogue(query)).rejects.toMatchObject({ code: "invalid_provider_response" })
  })

  it("cancels oversized metadata even when Content-Length is misleading", async () => {
    const cancelled = vi.fn()
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
      start(controller) { controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1)) },
      cancel: cancelled,
    }), { headers: { "Content-Type": "application/json", "Content-Length": "10" } })))
    await expect(searchCatalogue(query)).rejects.toMatchObject({ code: "metadata_too_large", status: 502 })
    expect(cancelled).toHaveBeenCalledTimes(1)
  })

  it("applies the deadline while the response body is stalled", async () => {
    vi.useFakeTimers()
    const cancelled = vi.fn()
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({ cancel: cancelled }), {
      headers: { "Content-Type": "application/json" },
    })))
    const failure = expect(searchCatalogue(query)).rejects.toMatchObject({ status: 504, code: "provider_timeout" })
    await vi.advanceTimersByTimeAsync(15_001)
    await failure
    expect(cancelled).toHaveBeenCalledTimes(1)
  })

  it.each(["declared", "streamed"])("does not hang on cleanup of %s oversized metadata", async (mode) => {
    vi.useFakeTimers()
    vi.stubGlobal("fetch", vi.fn(async () => new Response(new ReadableStream({
      start(controller) {
        if (mode === "streamed") controller.enqueue(new Uint8Array(2 * 1024 * 1024 + 1))
      },
      cancel: () => new Promise<void>(() => {}),
    }), { headers: {
      "Content-Type": "application/json",
      ...(mode === "declared" ? { "Content-Length": String(2 * 1024 * 1024 + 1) } : {}),
    } })))
    const result = searchCatalogue(query).catch((error: unknown) => error)
    await vi.advanceTimersByTimeAsync(15_001)
    expect(await Promise.race([result, Promise.resolve("still pending")])).toMatchObject({
      code: "metadata_too_large", status: 502,
    })
  })

  it("does not make upstream requests after cancellation", async () => {
    const upstream = vi.fn()
    vi.stubGlobal("fetch", upstream)
    await expect(searchCatalogue(query, AbortSignal.abort())).rejects.toMatchObject({ status: 499, code: "request_cancelled" })
    expect(upstream).not.toHaveBeenCalled()
  })
})
