import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { answerArgus, type ArgusContext } from "./answers"

const context: ArgusContext = {
  view: { placeName: "Kuakata", areaLabel: "selected coast", bounds: [90, 21, 91, 22], productLabel: "nisar-gcov-provisional", dateWindow: { start: "2026-06-01", end: "2026-07-01" }, acquisitionCount: 4, footprintAcquisitionCount: 2, groupCount: 2, groupLabel: "frame-a", orbits: [], polarizations: [], sourceMaturity: "provisional", sourceUrl: "https://nisar.jpl.nasa.gov/", comparedPair: { from: "2026-06-18", to: "2026-06-30", fromAt: "2026-06-18T00:00:00Z", toAt: "2026-06-30T00:00:00Z", leftId: "a", rightId: "b" } },
  acquisitions: [{ id: "a", date: "2026-06-18", acquiredAt: "2026-06-18T00:00:00Z", platform: "NISAR", processing: "GCOV", polarization: "HV", orbit: "unknown" }, { id: "b", date: "2026-06-30", acquiredAt: "2026-06-30T00:00:00Z", platform: "NISAR", processing: "GCOV", polarization: "HV", orbit: "unknown" }],
  comparison: { status: "ready", summary: { changedPct: 12, brighterPct: 7, darkerPct: 5, headline: "Visual difference", detail: "Display pixels only" } },
  catalogueStatus: "ready", hasMore: true, missingSelection: false,
}
beforeEach(() => {
  vi.stubEnv("VITE_GROQ_API_KEY", "")
  vi.stubEnv("VITE_GROQ_MODEL", "")
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
    expect(answer.source).toBe("data")
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
  it("sends the question and bounded real facts to the configured AI, with a data fallback on failure", async () => {
    vi.stubEnv("VITE_GROQ_API_KEY", "test-key")
    const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(new Response(JSON.stringify({ choices: [{ message: { content: "The current preview has 12% changed display pixels, not changed land area." } }] })))
    expect((await ask("What changed?")).source).toBe("groq")
    const payload = JSON.parse(String(fetcher.mock.calls[0][1]?.body))
    expect(payload.model).toBe("qwen/qwen3.8-27b")
    expect(payload.messages.at(-1).content).toContain("What changed?")
    expect(payload.messages[0].content).toContain('"changedPct":12')
    expect(payload.messages[0].content).toContain('"acquisitionCount":4')
    fetcher.mockRejectedValue(new Error("offline"))
    expect((await ask("Which satellite product is this?")).source).toBe("data")
  })
  it("does not send aborted questions or invent hazard measurements", async () => {
    const controller = new AbortController()
    controller.abort()
    await expect(answerArgus("Summarize", context, [], controller.signal)).rejects.toThrow()
    expect((await ask("What is the flood depth in metres?")).text).toMatch(/cannot|not establish/i)
  })
})
