import { fireEvent, render, screen, waitFor } from "@testing-library/react"
import { afterEach, beforeEach, describe, expect, it } from "vitest"
import type { ComparisonMode, Observation } from "../../domain/models"
import { observations } from "../../mocks/fixtures"
import { ComparisonViewer } from "./ComparisonViewer"
import { getCompatibility } from "./compatibility"
import "../../styles/explorer.css"

const left: Observation = {
  id: "asf-earlier",
  placeId: "kuakata-bangladesh",
  moduleId: "coastal",
  acquiredAt: "2026-09-01T00:00:00Z",
  platform: "Sentinel-1",
  instrument: "C-SAR",
  orbitDirection: null,
  relativeOrbit: null,
  polarization: "VV",
  processingLevel: "SLC",
  resolutionM: null,
  coverageOverlap: null,
  alignmentQuality: null,
  sourceId: "ASF",
  classification: "observed",
  quality: "review-required",
  imageUrl: "https://datapool.asf.alaska.edu/BROWSE/earlier.png",
  sourceUrl: "https://search.asf.alaska.edu/#/?granule=earlier",
  knownLimitations: ["Browse preview only; calibration and alignment are not validated."],
}
const right: Observation = {
  ...left,
  id: "asf-later",
  acquiredAt: "2026-09-13T00:00:00Z",
  imageUrl: "https://datapool.asf.alaska.edu/BROWSE/later.png",
  sourceUrl: "https://search.asf.alaska.edu/#/?granule=later",
}
const previewModes: ComparisonMode[] = ["swipe", "side-by-side", "single", "fade"]
const fixturePair = observations.filter((observation) => observation.placeId === "jakobshavn-glacier" && observation.platform === "NISAR")
const defaultMatchMedia = window.matchMedia
let mediaPreference = ""

beforeEach(() => {
  mediaPreference = ""
  window.matchMedia = (query) => ({
    matches: query === mediaPreference,
    media: query,
    onchange: null,
    addListener() {},
    removeListener() {},
    addEventListener() {},
    removeEventListener() {},
    dispatchEvent: () => false,
  })
})
afterEach(() => { window.matchMedia = defaultMatchMedia })

describe("live comparison previews", () => {
  it.each(previewModes)("uses the supplied browse URLs and labels their limits in %s", (mode) => {
    const { container } = render(<ComparisonViewer mode={mode} left={left} right={right} dataOrigin="live" />)
    const sources = Array.from(container.querySelectorAll("img"), (image) => image.getAttribute("src"))

    expect(sources.sort()).toEqual((mode === "single" ? [right.imageUrl] : [left.imageUrl, right.imageUrl]).sort())
    expect(screen.getByRole("region")).toHaveAttribute("data-origin", "live")
    expect(screen.getByText(/Official SAR browse preview; not a calibrated raster or validated change measurement/)).toBeVisible()
    expect(screen.getAllByRole("link").map((link) => link.getAttribute("href"))).toEqual(mode === "single" ? [right.sourceUrl] : [left.sourceUrl, right.sourceUrl])
  })

  it.each(previewModes)("fits full browse images without fixture filters or tints in %s", (mode) => {
    const { container } = render(<ComparisonViewer mode={mode} left={left} right={right} dataOrigin="live" />)
    container.querySelectorAll("img").forEach((image) => {
      expect(getComputedStyle(image)).toMatchObject({ objectFit: "contain", filter: "none", mixBlendMode: "normal" })
    })
    container.querySelectorAll(".comparison-tint").forEach((tint) => expect(tint).not.toBeVisible())
  })

  it("preserves mobile stacking and lets the live stage grow with its images", () => {
    const mobileRule = Array.from(document.styleSheets).flatMap((sheet) => Array.from(sheet.cssRules))
      .find((rule): rule is CSSMediaRule => rule instanceof CSSMediaRule && rule.conditionText === "(max-width: 760px)")
    if (!mobileRule) throw new Error("Explorer mobile styles are missing")
    const media = mobileRule.media.mediaText
    // jsdom does not evaluate viewport sizes; activate the real mobile rules.
    mobileRule.media.mediaText = "all"
    try {
      const { container } = render(<ComparisonViewer mode="side-by-side" left={left} right={right} dataOrigin="live" />)
      expect(container.querySelector(".comparison-viewer__stage")).toHaveStyle({ height: "auto" })
      expect(container.querySelector(".side-by-side")).toHaveStyle({ gridTemplateColumns: "1fr" })
    } finally {
      mobileRule.media.mediaText = media
    }
  })

  it.each(previewModes)("reports missing imagery without a fallback in %s", (mode) => {
    const { container } = render(<ComparisonViewer mode={mode} left={left} right={{ ...right, imageUrl: null }} dataOrigin="live" />)

    expect(screen.getByText(/Image unavailable/)).toBeVisible()
    expect(container.querySelectorAll("img")).toHaveLength(mode === "single" ? 0 : 1)
    expect(container.querySelector(".low-data-texture")).not.toBeInTheDocument()
  })

  it.each(previewModes)("reports failed images outside the clipped or faded stage in %s", (mode) => {
    const { container } = render(<ComparisonViewer mode={mode} left={left} right={right} dataOrigin="live" />)
    if (mode === "fade") fireEvent.change(screen.getByRole("slider"), { target: { value: "0" } })
    const images = Array.from(container.querySelectorAll("img"))
    images.forEach((image) => fireEvent.error(image))

    const errors = screen.getAllByText(/Image failed to load/)
    expect(errors).toHaveLength(mode === "single" ? 1 : 2)
    errors.forEach((error) => {
      expect(error).toBeVisible()
      expect(error.closest(".comparison-viewer__stage")).toBeNull()
    })
    expect(container.querySelectorAll("img")).toHaveLength(0)
    expect(container.querySelector(".low-data-texture")).not.toBeInTheDocument()
  })

  it("loads a newly selected image after the previous image failed", () => {
    const { container, rerender } = render(<ComparisonViewer mode="single" right={right} dataOrigin="live" />)
    fireEvent.error(screen.getByRole("img"))
    expect(screen.getByText(/Image failed to load/)).toBeVisible()

    rerender(<ComparisonViewer mode="single" right={left} dataOrigin="live" />)
    expect(container.querySelector("img")).toHaveAttribute("src", left.imageUrl)
    expect(screen.queryByText(/Image failed to load/)).not.toBeInTheDocument()
  })

  it("labels unknown metadata without inferred numbers and allows visual review", () => {
    const { container } = render(<ComparisonViewer mode="side-by-side" left={left} right={right} dataOrigin="live" />)

    expect(screen.getByText("review")).toBeVisible()
    expect(screen.getAllByText("Not reported").length).toBeGreaterThan(0)
    expect(screen.getAllByText("Not computed")).toHaveLength(4)
    expect(container).not.toHaveTextContent(/null|undefined|NaN/)
    expect(container.querySelectorAll("img")).toHaveLength(2)
  })

  it("blocks live Difference even when all compatibility metadata is supplied", () => {
    const { container } = render(<ComparisonViewer mode="difference" left={fixturePair[0]} right={fixturePair[1]} dataOrigin="live" />)

    expect(screen.getByText(/Calibrated difference unavailable/)).toBeVisible()
    expect(screen.getByText(/not a calibrated raster or validated change measurement/)).toBeVisible()
    expect(container.querySelectorAll("img")).toHaveLength(0)
    expect(screen.queryByText(/Pixel-difference|Derived difference view/)).not.toBeInTheDocument()
  })

  it.each(previewModes)("pauses real imagery without synthetic textures in low-bandwidth %s", (mode) => {
    mediaPreference = "(prefers-reduced-data: reduce)"
    const { container } = render(<ComparisonViewer mode={mode} left={left} right={right} dataOrigin="live" />)

    expect(screen.getByText(/Real imagery paused/)).toBeVisible()
    expect(container.querySelectorAll("img, .low-data-texture")).toHaveLength(0)
  })

  it("keeps the swipe keyboard interaction", async () => {
    mediaPreference = "(prefers-reduced-motion: reduce)"
    render(<ComparisonViewer mode="swipe" left={left} right={right} dataOrigin="live" />)
    const divider = screen.getByRole("slider", { name: "Observation comparison divider" })
    expect(divider).toHaveAttribute("aria-valuenow", "55")
    fireEvent.keyDown(divider, { key: "End" })
    await waitFor(() => expect(divider).toHaveAttribute("aria-valuenow", "100"), { timeout: 2000 })
  })

  it("preserves the default fixture Difference behavior", () => {
    const { container } = render(<ComparisonViewer mode="difference" left={fixturePair[0]} right={fixturePair[1]} />)

    expect(screen.getByText("Derived difference view")).toBeVisible()
    expect(screen.getByText(/Imagery is a visual fixture/)).toBeVisible()
    expect(container.querySelectorAll("img")).toHaveLength(2)
  })
})

describe("unknown comparison compatibility", () => {
  it.each(["orbitDirection", "relativeOrbit", "resolutionM", "coverageOverlap", "alignmentQuality", "imageUrl"])("never infers compatibility when both %s values are null", (field) => {
    const compatibility = getCompatibility({ ...fixturePair[0], [field]: null }, { ...fixturePair[1], [field]: null })
    expect(compatibility.level).toBe("review")
    expect(compatibility.message).toMatch(/not reported|not computed|unavailable/i)
  })

  it("retains identity, place, module, and chronology checks with missing metadata", () => {
    expect(getCompatibility(left, left).level).toBe("incompatible")
    expect(getCompatibility(left, { ...right, placeId: "another-place" }).level).toBe("incompatible")
    expect(getCompatibility(left, { ...right, moduleId: "ice" }).level).toBe("incompatible")
    expect(getCompatibility(right, left).level).toBe("incompatible")
    expect(getCompatibility(left, { ...right, acquiredAt: left.acquiredAt }).level).toBe("incompatible")
  })
})
