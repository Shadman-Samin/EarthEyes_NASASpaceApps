import { render, screen } from "@testing-library/react"
import { describe, expect, it, vi } from "vitest"
import { AnalysisPanel } from "./AnalysisPanel"
import type { AnalysisManifest } from "./analysisBundle"

const manifest = {
  site: "kuakata-bangladesh",
  placeId: "kuakata-bangladesh",
  label: "Kuakata, Bangladesh",
  module: "coastal",
  phenomenon: "coastal-water-change",
  generated_at: "2026-11-01T00:00:00Z",
  algorithm_version: "1.0.0",
  grid: { width: 4, height: 3, spacing_m: 20, epsg: 32646, corners: [[90, 21], [91, 21], [91, 22], [90, 22]] },
  raster: { format: "int16_le", unit: "dB", scale: 0.01, invalid: -32768, urls: { "2026-06-18": "rasters/2026-06-18.db.i16", "2026-06-30": "rasters/2026-06-30.db.i16" } },
  dates: [
    { date: "2026-06-18", acquired_at: "2026-06-18T12:00:00Z", granule: "G1", source_url: "https://example.test/g1", polarization: "HV", valid_fraction: 1, mean_db: -12, p2_db: -20, p98_db: -5 },
    { date: "2026-06-30", acquired_at: "2026-06-30T12:00:00Z", granule: "G2", source_url: "https://example.test/g2", polarization: "HV", valid_fraction: 0.98, mean_db: -12.5, p2_db: -20, p98_db: -5 },
  ],
  time_series: [{ date: "2026-06-18", mean_db: -12, water_fraction: 0.74 }, { date: "2026-06-30", mean_db: -12.5, water_fraction: 0.73 }],
  water: {
    "2026-06-18": { fraction: 0.74, area_km2: 173.4, threshold_db: -18 },
    "2026-06-30": { fraction: 0.73, area_km2: 170.2, threshold_db: -18 },
  },
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
      story: { headline: "Coastal water changed between 2026-06-18 and 2026-06-30.", summary: "Water shifted by -3.2 km2." },
      clusters: [{ id: 1, kind: "gain", pixels: 20, area_km2: 0.08, centroid_px: [1, 1], bbox_px: [0, 0, 2, 2] }],
    },
  },
  persistent_clusters: [],
  story: { headline: "Season story.", summary: "Season summary.", detail: "Brightness change alone cannot tell water depth." },
  provenance: { mission: "NISAR", collection: "NISAR_L2_GCOV_PROVISIONAL_V1", product: "L2 GCOV", polarization: "HV", dates: ["2026-06-18"], citations: ["ASF"] },
  limitations: ["Provisional calibration."],
} as unknown as AnalysisManifest

function renderPanel(overrides: Partial<Parameters<typeof AnalysisPanel>[0]> = {}) {
  const props = {
    manifest,
    date: "2026-06-30",
    onDateChange: vi.fn(),
    pair: "2026-06-18--2026-06-30",
    onPairChange: vi.fn(),
    showChange: false,
    onShowChange: vi.fn(),
    ...overrides,
  }
  render(<AnalysisPanel {...props} />)
  return props
}

describe("AnalysisPanel", () => {
  it("uses the selected pair's own story instead of the season summary", () => {
    renderPanel()
    expect(screen.getByRole("heading", { name: "Coastal water changed between 2026-06-18 and 2026-06-30." })).toBeInTheDocument()
    expect(screen.getByText("Water shifted by -3.2 km2.")).toBeInTheDocument()
    expect(screen.queryByText("Season summary.")).not.toBeInTheDocument()
  })

  it("reports the water area of the pair rather than the last date in the series", () => {
    renderPanel()
    expect(screen.getByText("Water on 2026-06-30")).toBeInTheDocument()
    const metrics = screen.getAllByRole("article")
    expect(metrics[0]).toHaveTextContent("170.2 km²")
    expect(metrics[1]).toHaveTextContent("-3.2 km²")
  })

  it("keeps the interpretation limits visible next to the numbers", () => {
    renderPanel()
    expect(screen.getByText("Brightness change alone cannot tell water depth.")).toBeInTheDocument()
    expect(screen.getByText("Provisional calibration.")).toBeInTheDocument()
  })

  it("exposes the change overlay as a toggle", () => {
    const props = renderPanel()
    const toggle = screen.getByRole("button", { name: /show change/i })
    expect(toggle).toHaveAttribute("aria-pressed", "false")
    toggle.click()
    expect(props.onShowChange).toHaveBeenCalledWith(true)
  })
})
