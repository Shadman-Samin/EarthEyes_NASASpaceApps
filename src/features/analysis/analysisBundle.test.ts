import { describe, expect, it } from "vitest"
import { analysisManifestSchema, analysisPairKey } from "./analysisBundle"

const manifest = {
  site: "kuakata-bangladesh",
  placeId: "kuakata-bangladesh",
  label: "Kuakata, Bangladesh",
  module: "coastal",
  phenomenon: "coastal-water-change",
  generated_at: "2026-11-01T00:00:00Z",
  algorithm_version: "1.0.0",
  grid: { width: 4, height: 3, spacing_m: 20, epsg: 32646, corners: [[90, 21], [91, 21], [91, 22], [90, 22]] },
  raster: { format: "int16_le", unit: "dB", scale: 0.01, invalid: -32768, urls: { "2026-06-18": "rasters/2026-06-18.db.i16" } },
  dates: [{ date: "2026-06-18", acquired_at: "2026-06-18T12:00:00Z", granule: "G1", source_url: "https://example.test/g1", polarization: "HV", valid_fraction: 1, mean_db: -12, p2_db: -20, p98_db: -5 }],
  time_series: [{ date: "2026-06-18", mean_db: -12, water_fraction: 0.74 }],
  water: { "2026-06-18": { fraction: 0.74, area_km2: 173.4, threshold_db: -18 } },
  pairs: {
    "2026-06-18--2026-06-30": {
      from: "2026-06-18",
      to: "2026-06-30",
      threshold_db: 1.5,
      changed_fraction: 0.33,
      changed_area_km2: 77,
      gain_area_km2: 0.4,
      loss_area_km2: 0.5,
      delta_url: "rasters/2026-06-18--2026-06-30.delta.i16",
      story: { headline: "Coastal water changed between 2026-06-18 and 2026-06-30.", summary: "Water area shifted by 0.2 km2." },
      clusters: [{ id: 1, kind: "gain", pixels: 20, area_km2: 0.08, centroid_px: [1, 1], bbox_px: [0, 0, 2, 2], centroid_lonlat: [90.1, 21.1] }],
    },
  },
  persistent_clusters: [],
  story: { headline: "Season story.", summary: "Season summary.", detail: "Caveat." },
  provenance: { mission: "NISAR", collection: "NISAR_L2_GCOV_PROVISIONAL_V1", product: "L2 GCOV", polarization: "HV", dates: ["2026-06-18"], citations: ["ASF"] },
  limitations: ["Provisional calibration."],
}

describe("analysis bundle schema", () => {
  it("accepts a well-formed manifest", () => {
    expect(analysisManifestSchema.parse(manifest).site).toBe("kuakata-bangladesh")
  })

  it("requires each pair to declare its delta raster and its own story", () => {
    const withoutDelta = { ...manifest, pairs: { "2026-06-18--2026-06-30": { ...manifest.pairs["2026-06-18--2026-06-30"], delta_url: undefined } } }
    expect(analysisManifestSchema.safeParse(withoutDelta).success).toBe(false)
    const withoutStory = { ...manifest, pairs: { "2026-06-18--2026-06-30": { ...manifest.pairs["2026-06-18--2026-06-30"], story: undefined } } }
    expect(analysisManifestSchema.safeParse(withoutStory).success).toBe(false)
  })

  it("rejects a cluster whose centroid is not a pair of numbers", () => {
    const bad = { ...manifest, pairs: { "2026-06-18--2026-06-30": { ...manifest.pairs["2026-06-18--2026-06-30"], clusters: [{ ...manifest.pairs["2026-06-18--2026-06-30"].clusters[0], centroid_px: [1] }] } } }
    expect(analysisManifestSchema.safeParse(bad).success).toBe(false)
  })

  it("builds the pair key used to address bundle rasters", () => {
    expect(analysisPairKey("2026-06-18", "2026-06-30")).toBe("2026-06-18--2026-06-30")
  })
})
