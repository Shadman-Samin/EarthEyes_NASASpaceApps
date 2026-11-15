import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { answerArgus, type ArgusContext } from "./answers"

const context: ArgusContext = {
  view: { placeName: "Kuakata", areaLabel: "selected coast", bounds: [90, 21, 91, 22], productLabel: "nisar-gcov-provisional", dateWindow: { start: "2026-06-01", end: "2026-07-01" }, acquisitionCount: 4, footprintAcquisitionCount: 2, groupCount: 2, groupLabel: "frame-a", orbits: [], polarizations: [], sourceMaturity: "provisional", sourceUrl: "https://nisar.jpl.nasa.gov/", comparedPair: { from: "2026-06-18", to: "2026-06-30", fromAt: "2026-06-18T00:00:00Z", toAt: "2026-06-30T00:00:00Z", leftId: "a", rightId: "b" } },
  acquisitions: [{ id: "a", date: "2026-06-18", acquiredAt: "2026-06-18T00:00:00Z", platform: "NISAR", processing: "GCOV", polarization: "HV", orbit: "unknown" }, { id: "b", date: "2026-06-30", acquiredAt: "2026-06-30T00:00:00Z", platform: "NISAR", processing: "GCOV", polarization: "HV", orbit: "unknown" }],
  comparison: { status: "ready", summary: { changedPct: 12, brighterPct: 7, darkerPct: 5, headline: "Visual difference", detail: "Display pixels only" } },
  catalogueStatus: "ready", hasMore: true, missingSelection: false,
  display: { moduleId: "coastal", moduleTitle: "Coastal change", comparisonMode: "swipe", view: "compare", polarization: "HVHV", activeLayers: ["acquisition-footprint"], previewsWithImages: 2, previewsMissing: 0 },
  page: { path: "/explore/kuakata-bangladesh", title: "Kuakata / Coastal change" },
}
beforeEach(() => {
  window.localStorage.clear()
  vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ error: { code: "ai_unavailable" } }, { status: 503 }))
})
afterEach(() => { vi.unstubAllEnvs(); vi.restoreAllMocks() })
const ask = (question: string, facts = context) => answerArgus(question, facts, [], new AbortController().signal)

describe("Argus current-view answers", () => {
  it("answers using actual computed shares without claiming physical change", async () => {
    const answer = await ask("What changed?")
    expect(answer.text).toContain("12%")
    expect(answer.text).toContain("7% brighter")
    expect(answer.text).toContain("5% darker")
    expect(answer.text).toMatch(/not.*ground|not.*physical/i)
    expect(answer.source).toBe("degraded")
  })
  it("distinguishes all loaded records from the selected footprint and incomplete coverage", async () => {
    expect((await ask("Summarize")).text).toMatch(/4.*loaded.*2.*selected footprint/)
    expect((await ask("Summarize")).text).toMatch(/more.*available/i)
    expect((await ask("Which dates and polarization?")).text).toContain("2026-06-30")
    expect((await ask("Which dates and polarization?")).text).toContain("HV")
  })
  it.each(["loading", "error"] as const)("does not present %s as zero change", async (catalogueStatus) => {
    const answer = await ask("What changed?", { ...context, catalogueStatus })
    expect(answer.text).not.toContain("12%")
    expect(answer.text).toMatch(/loading|failed/i)
  })
  it("does not substitute a loaded pair for a missing linked selection", async () => {
    expect((await ask("What changed?", { ...context, missingSelection: true })).text).toMatch(/selection.*not loaded/i)
    expect((await ask("What changed?", { ...context, comparison: { status: "error", summary: null } })).text).not.toContain("0%")
  })
  it("sends the question and bounded real facts through the same-origin proxy, with a labelled fallback on failure", async () => {
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({ text: "The current preview has 12% changed display pixels, not changed land area." }))
    const answer = await ask("What changed?")
    expect(answer.source).toBe("groq")
    expect(answer.text).toContain("changed display pixels")
    const [url, init] = fetcher.mock.calls[0]
    expect(String(url)).toMatch(/\/api\/argus$/)
    expect(init?.credentials).toBe("omit")
    const payload = JSON.parse(String(init?.body))
    expect(payload.mode).toBe("chat")
    expect(payload.question).toBe("What changed?")
    expect(payload.facts.view.acquisitionCount).toBe(4)
    expect(payload.facts.comparison.summary.changedPct).toBe(12)
    expect(payload.facts.display.moduleTitle).toBe("Coastal change")
    expect(payload.facts.display.comparisonMode).toBe("swipe")
    expect(payload.facts.page.path).toBe("/explore/kuakata-bangladesh")

    fetcher.mockResolvedValue(Response.json({ error: { code: "ai_unavailable" } }, { status: 503 }))
    const fallback = await ask("Which satellite product is this?")
    expect(fallback.source).toBe("degraded")
    expect(fallback.text).toContain("nisar-gcov-provisional")
  })
  it("does not send aborted questions or invent hazard measurements", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(answerArgus("Summarize", context, [], controller.signal)).rejects.toThrow()
    expect((await ask("What is the flood depth in metres?")).text).toMatch(/cannot|not establish/i)
  })
})
