import { afterEach, describe, expect, it, vi } from "vitest"
import manifest from "../../public/analysis/kuakata-bangladesh/manifest.json"
import { fetchAnalysis } from "./analysis"
import type { AnalysisQuery } from "../domain/analysis"

const query: AnalysisQuery = { product: "nisar-gcov-provisional", bbox: [90.0575, 21.7524, 90.2025, 21.8876], start: "2026-06-01", end: "2026-10-31", polarization: "HV" }
afterEach(() => vi.unstubAllGlobals())

describe("published analysis transport", () => {
  it("accepts a complete bundle for exactly the requested scope", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "analysis_available", manifest })))
    const result = await fetchAnalysis(query, new AbortController().signal)
    expect(result.status).toBe("analysis_available")
  })

  it("rejects a cached response for a different polarization", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => Response.json({ status: "analysis_available", manifest })))
    await expect(fetchAnalysis({ ...query, polarization: "HH" }, new AbortController().signal)).rejects.toThrow(/scope|match/)
  })

  it("does not treat the SPA fallback as analysis data", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("<!doctype html><html></html>")))
    await expect(fetchAnalysis(query, new AbortController().signal)).rejects.toThrow(/valid|analysis/i)
  })
})
