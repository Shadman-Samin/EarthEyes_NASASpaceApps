import { describe, expect, it } from "vitest"
import { parseCatalogueQuery } from "./query"

const parameters = {
  product: "opera-rtc-s1",
  bbox: "90.1,21.8,90.3,21.95",
  start: "2024-05-01",
  end: "2024-05-31",
}

describe("catalogue query boundary", () => {
  it.each([
    ["-180,-90,180,90", [-180, -90, 180, 90]],
    ["179,-20,-179,-16", [179, -20, -179, -16]],
    ["-51.2,68.9,-50.7,69.3", [-51.2, 68.9, -50.7, 69.3]],
    [" 10.0 , 89.8 , 10.5 , 90 ", [10, 89.8, 10.5, 90]],
  ])("accepts worldwide bounds %s without a place ID", (bbox, expected) => {
    const result = parseCatalogueQuery(new URLSearchParams({ ...parameters, bbox }))
    expect(result).toEqual({ ...parameters, bbox: expected, limit: 10 })
  })

  it("accepts an inclusive leap year and a bounded explicit page size", () => {
    const result = parseCatalogueQuery(new URLSearchParams({
      ...parameters, start: "2024-01-01", end: "2024-12-31", limit: "20",
    }))
    expect(result.limit).toBe(20)
    expect(result.end).toBe("2024-12-31")
  })

  it("accepts multi-year windows so a place can be compared across seasons", () => {
    const result = parseCatalogueQuery(new URLSearchParams({
      ...parameters, start: "2023-01-01", end: "2026-11-12",
    }))
    expect(result.start).toBe("2023-01-01")
    expect(result.end).toBe("2026-11-12")
  })

  it.each<Record<string, string>>([
    { bbox: "181,20,182,22" },
    { bbox: "-181,20,10,22" },
    { bbox: "10,-91,20,22" },
    { bbox: "10,20,20,91" },
    { bbox: "10,22,20,20" },
    { bbox: "10,20,10,22" },
    { bbox: "180,-20,-180,-16" },
    { bbox: "10,20,20,20" },
    { bbox: "10,20,30" },
    { bbox: "10,20,,30" },
    { bbox: "10,20,30,40,50" },
    { bbox: "NaN,20,30,40" },
    { bbox: "Infinity,20,30,40" },
    { bbox: "0x10,20,30,40" },
    { product: "arbitrary-collection" },
    { start: "2023-02-29" },
    { end: "2024-13-01" },
    { start: "2024-06-01" },
    { start: "2025-01-01", end: "2024-01-01" },
    { start: "2024-05-01T00:00:00Z" },
    { limit: "0" },
    { limit: "21" },
    { limit: "1.5" },
    { limit: "2e1" },
    { limit: "" },
    { cursor: "" },
    { cursor: "a".repeat(4097) },
    { cursor: "https://untrusted.test/data" },
    { bbox: "179,-20,-179,-16", cursor: "opaque" },
  ])("rejects invalid query %j", (invalid) => {
    expect(() => parseCatalogueQuery(new URLSearchParams({ ...parameters, ...invalid }))).toThrow()
  })

  it("rejects missing required parameters", () => {
    expect(() => parseCatalogueQuery(new URLSearchParams())).toThrow()
  })

  it("rejects unknown filters instead of silently ignoring a typo", () => {
    expect(() => parseCatalogueQuery(new URLSearchParams({ ...parameters, plaecId: "unknown" }))).toThrow()
  })

  it("rejects repeated filters rather than letting cache and provider disagree", () => {
    const params = new URLSearchParams(parameters)
    params.append("product", "sentinel-1-rtc")
    expect(() => parseCatalogueQuery(params)).toThrow()
  })
})
