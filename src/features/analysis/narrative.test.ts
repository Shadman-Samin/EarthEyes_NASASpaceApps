import { afterEach, expect, it, vi } from "vitest"
import { generateNarrative } from "./narrative"

afterEach(() => {
  vi.unstubAllEnvs()
  vi.restoreAllMocks()
})

it("reserves text-only Groq requests for user-triggered Argus chat", async () => {
  vi.stubEnv("VITE_GROQ_API_KEY", "test-key")
  vi.stubEnv("VITE_GROQ_VISION_MODEL", "")
  const fetcher = vi.spyOn(globalThis, "fetch").mockResolvedValue(Response.json({
    choices: [{ message: { content: JSON.stringify({ headline: "AI headline", summary: "AI summary", limits: [] }) } }],
  }))

  const narrative = await generateNarrative({
    ctx: {
      placeName: "Kuakata",
      areaLabel: "selected coast",
      bounds: [90, 21, 91, 22],
      productLabel: "NISAR GCOV",
      dateWindow: { start: "2026-06-01", end: "2026-07-01" },
      acquisitionCount: 4,
      footprintAcquisitionCount: 2,
      groupCount: 2,
      groupLabel: "frame-a",
      orbits: [],
      polarizations: ["HV"],
      sourceMaturity: "provisional",
      comparedPair: { from: "2026-06-18", to: "2026-06-30", fromAt: "2026-06-18T00:00:00Z", toAt: "2026-06-30T00:00:00Z", leftId: "a", rightId: "b" },
    },
    diff: { changedPct: 12, brighterPct: 7, darkerPct: 5, headline: "Visual difference", detail: "Display pixels only" },
  })

  expect(narrative.source).toBe("template")
  expect(fetcher).not.toHaveBeenCalled()
})
