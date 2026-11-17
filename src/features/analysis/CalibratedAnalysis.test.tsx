import { describe, expect, it, vi } from "vitest"
import { render, screen } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter } from "react-router-dom"
import raw from "../../../public/analysis/kuakata-bangladesh/manifest.json"
import { analysisManifestSchema } from "../../domain/analysis"
import { CalibratedAnalysis } from "./CalibratedAnalysis"

const manifest = analysisManifestSchema.parse(raw)

describe("calibrated-source evidence", () => {
  it("separates source calibration, sensitivity, and unproven direction", () => {
    render(<MemoryRouter><CalibratedAnalysis result={{ status: "analysis_available", manifest }} loading={false} overlay="water" onOverlayChange={vi.fn()} /></MemoryRouter>)
    expect(screen.getByRole("heading", { name: "Calibrated source analysis" })).toBeInTheDocument()
    expect(screen.getByText(/direction is not established/i)).toBeInTheDocument()
    expect(screen.getByText(/not proof of no change/i)).toBeInTheDocument()
    expect(screen.getByRole("table", { name: "Calibrated time series" })).toBeInTheDocument()
    expect(screen.getByText(/independent references/i)).toBeInTheDocument()
    expect(screen.getByRole("link", { name: "2026-06-18" })).not.toHaveAttribute("href", expect.stringMatching(/\.h5$/))
  })

  it("does not present a failed release search as zero matching coverage", async () => {
    const failed = { ...manifest, validation: { ...manifest.validation, maturity: { status: "availability_checked" as const, limitation: "Not a radiometric comparison", collections: [{ product: "nisar-gcov" as const, collection: "standard", status: "unavailable" as const, matching_dates: 0, compared_dates: 0 }] } } }
    render(<MemoryRouter><CalibratedAnalysis result={{ status: "analysis_available", manifest: failed }} loading={false} overlay="water" onOverlayChange={vi.fn()} /></MemoryRouter>)
    await userEvent.click(screen.getByText("Other NISAR releases"))
    expect(screen.getByText(/release search unavailable/i)).toBeVisible()
    expect(screen.queryByText(/0 matching dates/)).not.toBeInTheDocument()
  })

  it("plots a sub-one-dB range against its actual axis extent", () => {
    const series = manifest.time_series.map((point, index) => ({ date: point.date, valid_area_km2: point.valid_area_km2, mean_db: -20 + index / (manifest.time_series.length - 1) * 0.5 }))
    render(<MemoryRouter><CalibratedAnalysis result={{ status: "analysis_available", manifest: { ...manifest, time_series: series } }} loading={false} overlay="off" onOverlayChange={vi.fn()} /></MemoryRouter>)
    const dots = screen.getByRole("img", { name: "Calibrated backscatter time series" }).querySelectorAll("circle")
    expect(dots[0]).toHaveAttribute("cy", "119")
    expect(dots[dots.length - 1]).toHaveAttribute("cy", "36")
  })

  it("never renders physical numbers for an unavailable selection", () => {
    render(<MemoryRouter><CalibratedAnalysis result={{ status: "analysis_unavailable", reason: "No exact match" }} loading={false} overlay="off" onOverlayChange={vi.fn()} /></MemoryRouter>)
    expect(screen.getByText("No exact match")).toBeInTheDocument()
    expect(screen.queryByRole("table")).not.toBeInTheDocument()
    expect(screen.getByRole("link", { name: /open kuakata pilot/i })).toHaveAttribute("href", expect.stringContaining("bbox="))
  })

  it("lets the user switch or disable the analytical overlay", async () => {
    const change = vi.fn()
    render(<MemoryRouter><CalibratedAnalysis result={{ status: "analysis_available", manifest }} loading={false} overlay="water" onOverlayChange={change} /></MemoryRouter>)
    await userEvent.click(screen.getByRole("button", { name: "Brightness screen" }))
    expect(change).toHaveBeenCalledWith("delta")
    await userEvent.click(screen.getByRole("button", { name: "Hide overlay" }))
    expect(change).toHaveBeenCalledWith("off")
  })
})
