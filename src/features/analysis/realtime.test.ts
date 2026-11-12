import { describe, expect, it } from "vitest"
import { catalogueItemSchema } from "../../domain/catalogue"
import { observationSchema, placeSchema, type Observation } from "../../domain/models"
import { bestGroup, buildRealtimeContext, pickBestPair } from "./realtime"

const bbox: [number, number, number, number] = [90, 21, 91, 22]

function item(frame: string, date: string) {
  return catalogueItemSchema.parse({
    id: `NISAR_L2_PR_GCOV_${frame}_${date.replace(/[-:]/g, "")}_P05023_N_P_J_001`,
    collectionId: "NISAR_L2_GCOV_PROVISIONAL_V1_1",
    provider: "asf",
    sourceMaturity: "provisional",
    processingFamily: "NISAR-GCOV",
    acquiredAt: date,
    startAt: null,
    endAt: null,
    bbox,
    geometry: null,
    platform: null,
    relativeOrbit: null,
    absoluteOrbit: null,
    orbitDirection: "descending",
    polarizations: ["HV"],
    sourceUrl: "https://example.com/item",
    assets: [],
  })
}

function observation(id: string, acquiredAt: string, imageUrl: string | null): Observation {
  return observationSchema.parse({
    id,
    placeId: "test",
    moduleId: "coastal",
    acquiredAt,
    platform: "NISAR",
    instrument: "NISAR L-band SAR",
    orbitDirection: "descending",
    relativeOrbit: 13,
    polarization: "HV (beam B)",
    processingLevel: "NISAR-GCOV",
    resolutionM: null,
    coverageOverlap: null,
    alignmentQuality: null,
    sourceId: "NISAR_L2_GCOV_PROVISIONAL_V1_1",
    classification: "observed",
    quality: "review-required",
    imageUrl,
    sourceUrl: "https://example.com/item",
    knownLimitations: ["Exploratory preview."],
  })
}

describe("realtime analysis helpers", () => {
  it("chooses the footprint with the most distinct acquisition dates", () => {
    const items = [
      item("FRAME_A", "2026-06-18T23:20:37Z"),
      item("FRAME_A", "2026-06-30T23:20:36Z"),
      item("FRAME_B", "2026-06-18T23:20:37Z"),
      item("FRAME_B", "2026-06-18T23:20:37Z"),
    ]
    expect(bestGroup(items)).toBe("NISAR_L2_PR_GCOV_FRAME_A")
  })

  it("picks the earliest and latest previews, ignoring observations without images when possible", () => {
    const observations = [
      observation("middle", "2026-06-24T23:20:37Z", "https://example.com/middle.png"),
      observation("latest", "2026-06-30T23:20:36Z", "https://example.com/latest.png"),
      observation("earliest", "2026-06-18T23:20:37Z", "https://example.com/earliest.png"),
      observation("no-image", "2026-06-01T23:20:37Z", null),
    ]
    expect(pickBestPair(observations)).toEqual({
      left: observations[2],
      right: observations[1],
    })
  })

  it("builds hemisphere-aware context from pulled records", () => {
    const place = placeSchema.parse({
      id: "test",
      name: "Southern test",
      country: "",
      kind: "area",
      center: [-65, -35],
      bounds: [-70, -40, -60, -30],
      description: "Test area",
      moduleIds: ["coastal"],
      coverage: [],
    })
    const items = [item("FRAME_A", "2026-06-18T23:20:37Z"), item("FRAME_A", "2026-06-30T23:20:36Z")]
    const observations = [
      observation("left", "2026-06-18T23:20:37Z", "https://example.com/left.png"),
      observation("right", "2026-06-30T23:20:36Z", "https://example.com/right.png"),
    ]
    const context = buildRealtimeContext({
      place,
      items,
      observations,
      group: "NISAR_L2_PR_GCOV_FRAME_A",
      query: { start: "2026-01-01", end: "2026-11-12", product: "nisar-gcov-provisional" },
      compared: { left: observations[0], right: observations[1] },
    })
    expect(context.areaLabel).toBe("40.00°S–30.00°S, 70.00°W–60.00°W")
    expect(context.acquisitionCount).toBe(2)
    expect(context.comparedPair?.from).toBe("2026-06-18")
    expect(context.comparedPair?.to).toBe("2026-06-30")
  })
})
