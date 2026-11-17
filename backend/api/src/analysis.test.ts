import { afterEach, describe, expect, it, vi } from "vitest"
import worker from "./index"
import { analysisAnswer, lookupAnalysis } from "./analysis"

const query = { bbox: [90.0575, 21.7524, 90.2025, 21.8876] as [number, number, number, number], start: "2026-06-01", end: "2026-10-31", product: "nisar-gcov-provisional" as const, polarization: "HV" as const }
const url = `https://api.test/api/analysis?${new URLSearchParams({ ...query, bbox: query.bbox.join(",") })}`

afterEach(() => vi.unstubAllGlobals())

describe("published analysis", () => {
  it("does not mistake candidates or validated for a date question", () => {
    const result = lookupAnalysis(query)
    expect(analysisAnswer(result, "What changed in the water candidates?")).toContain("Sensitivity")
    expect(analysisAnswer(result, "Is this validated?")).toContain("dates compared")
  })
  it("returns measurements, provenance and honest quality, not a manifest URL", async () => {
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("No provider call is needed") }))
    const response = await worker.fetch(new Request(url), {})
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.status).toBe("analysis_available")
    expect(body.manifest.status).toBe("exploratory_derived")
    expect(body.manifest.dates).toHaveLength(10)
    expect(body.manifest.claims.find((claim: { id: string }) => claim.id === "median_backscatter_change").value).toBe(0.38)
    expect(body.manifest.provenance.geometry_checked_dates).toBe(10)
  })

  it.each([
    url.replace("polarization=HV", "polarization=HH"),
    url.replace("2026-06-01", "2026-06-02"),
    url.replace("90.0575", "90.0576"),
    url.replace("nisar-gcov-provisional", "nisar-gcov"),
  ])("never substitutes different scope: %s", async (request) => {
    expect(await (await worker.fetch(new Request(request), {})).json()).toMatchObject({ status: "analysis_unavailable" })
  })

  it.each([`${url}&extra=true`, `${url}&start=2026-06-01`, url.replace("90.0575", ""), url.replace("2026-10-31", "2026-02-30")])("rejects malformed input: %s", async (request) => {
    expect((await worker.fetch(new Request(request), {})).status).toBe(400)
  })

  it("answers from server-owned metrics without a model or client-supplied numbers", async () => {
    vi.stubGlobal("fetch", vi.fn(() => { throw new Error("Grounded answers need no model") }))
    const response = await worker.fetch(new Request("https://api.test/api/argus", {
      method: "POST", headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ question: "What changed?", analysisQuery: query, facts: { analysis: "999999 km2 confirmed flooding" } }),
    }), {})
    const body = await response.json()
    expect(response.status).toBe(200)
    expect(body.source).toBe("data")
    expect(body.text).toContain("0.38")
    expect(body.text).toMatch(/sensitivity/i)
    expect(body.text).not.toContain("999999")
    expect(body.text).toMatch(/not.*validat|exploratory/i)
  })
})
