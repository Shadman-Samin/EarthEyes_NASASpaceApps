import type { ReactNode } from "react"
import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, describe, expect, it, vi } from "vitest"
import { MethodologyPage } from "./methodology/MethodologyPage"
import { DataSourcesPage } from "./data-sources/DataSourcesPage"
import { DataSourceDetailPage } from "./data-sources/DataSourceDetailPage"
import { GroundLinePage } from "./groundline/GroundLinePage"
import { AboutPage } from "./about/AboutPage"
import { StoryPage } from "./stories/StoryPage"

afterEach(() => vi.restoreAllMocks())

function renderRoute(element: ReactNode, path = "/", pattern = "*") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
  return render(<QueryClientProvider client={client}><MemoryRouter initialEntries={[path]}><Routes><Route path={pattern} element={element} /></Routes></MemoryRouter></QueryClientProvider>)
}

describe("editorial evidence boundaries", () => {
  it("distinguishes live preview statistics from the disconnected calibrated workflow", () => {
    renderRoute(<MethodologyPage />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    const live = screen.getByRole("region", { name: "Current live pipeline" })
    expect(live).toHaveTextContent(/1600/)
    expect(live).toHaveTextContent(/26/)
    expect(screen.getByRole("region", { name: "What the percentages mean" })).toHaveTextContent(/not georeferenced measurements/i)
    expect(screen.getByRole("region", { name: "Calibrated offline workflow" })).toHaveTextContent(/not connected to the explorer/i)
  })

  it("groups source records by role without presenting the directory as live acquisitions", async () => {
    renderRoute(<DataSourcesPage />)
    await screen.findByText("NISAR")
    const observations = screen.queryByRole("region", { name: "Observation archives" })
    expect(observations).not.toBeNull()
    expect(within(observations!).getByRole("link", { name: "NISAR" })).toHaveAttribute("href", "/data-sources/nisar")
    expect(screen.queryByRole("region", { name: "Independent context" })).toHaveTextContent("WorldPop")
    expect(screen.queryByRole("region", { name: "Derived processing" })).toHaveTextContent(/not.*live.*product/i)
    expect(screen.queryByRole("region", { name: "Responsible authority records" })).toHaveTextContent(/demonstration/i)
    expect(screen.queryByRole("note", { name: "Directory scope" })).toHaveTextContent(/reference.*fixture/i)
  })

  it("keeps a source record's provenance and limitations beside its authoritative link", async () => {
    renderRoute(<DataSourceDetailPage />, "/data-sources/nisar", "/data-sources/:sourceId")
    await screen.findByRole("heading", { level: 1, name: "NISAR" })
    expect(screen.queryByRole("note", { name: "Source record scope" })).toHaveTextContent(/not.*acquisition/i)
    expect(screen.getByText("NASA / ISRO", { selector: "dd" })).toBeInTheDocument()
    expect(screen.getByText("NASA-ISRO SAR Mission (NISAR)")).toBeInTheDocument()
    expect(screen.getByText("SAR backscatter is not a direct sea-level measurement.")).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /open authoritative source/i })).toHaveAttribute("href", "https://nisar.jpl.nasa.gov/")
    expect(screen.getByRole("link", { name: /all data sources/i })).toHaveAttribute("href", "/data-sources")
  })

  it("provides a heading and return path when a source does not exist", async () => {
    renderRoute(<DataSourceDetailPage />, "/data-sources/unknown", "/data-sources/:sourceId")
    await screen.findByText("Source not found")
    expect(screen.queryByRole("heading", { level: 1, name: "Source not found" })).not.toBeNull()
    expect(screen.queryByRole("link", { name: /all data sources/i })).toHaveAttribute("href", "/data-sources")
  })

  it("labels GroundLine as a demonstration before notices and keeps candidates out of the public tab", async () => {
    vi.spyOn(Date, "now").mockReturnValue(Date.parse("2026-11-12T12:00:00Z"))
    const user = userEvent.setup()
    renderRoute(<GroundLinePage />)
    const publicTab = await screen.findByRole("tab", { name: "Public notices" })
    const boundary = screen.queryByRole("note", { name: "GroundLine demonstration" })
    expect(boundary).toHaveTextContent(/no messages are sent/i)
    expect(boundary!.compareDocumentPosition(publicTab) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy()
    expect(screen.queryByText("Lake-change review candidate")).not.toBeInTheDocument()
    await user.click(screen.getByRole("tab", { name: "Review candidates" }))
    expect(screen.getByText("Lake-change review candidate")).toBeInTheDocument()
    expect(screen.queryByText("Demonstration river-water notice")).not.toBeInTheDocument()
    expect(screen.getByText(/must not appear in a public alert feed/i)).toBeInTheDocument()
  })

  it("validates E.164 and simulates consent, OTP and unsubscribe without sending or storing data", async () => {
    const user = userEvent.setup()
    renderRoute(<GroundLinePage />)
    await user.click(await screen.findByRole("tab", { name: "Subscription demo" }))
    const fetchSpy = vi.spyOn(globalThis, "fetch")
    const storageSpy = vi.spyOn(Storage.prototype, "setItem")
    const phone = screen.getByRole("textbox", { name: /Phone number/ })
    await user.type(phone, "123")
    await user.click(screen.getByRole("checkbox"))
    await user.click(screen.getByRole("button", { name: "Try verification" }))
    expect(screen.queryByRole("alert")).toHaveTextContent(/E.164/)
    expect(phone).toHaveAttribute("aria-invalid", "true")
    await user.clear(phone)
    await user.type(phone, "+15555550123")
    await user.click(screen.getByRole("button", { name: "Try verification" }))
    await user.type(screen.getByRole("textbox", { name: "Demo verification code" }), "123456")
    await user.click(screen.getByRole("button", { name: "Confirm demo code" }))
    expect(screen.getByText("Demo preferences confirmed")).toBeInTheDocument()
    await user.click(screen.getByRole("button", { name: "Unsubscribe demo" }))
    expect(screen.getByRole("button", { name: "Try verification" })).toBeInTheDocument()
    expect(fetchSpy).not.toHaveBeenCalled()
    expect(storageSpy).not.toHaveBeenCalled()
  })

  it("describes the shipped prototype rather than an all-fixture or operational service", () => {
    renderRoute(<AboutPage />)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    const scope = screen.queryByRole("region", { name: "Current prototype state" })
    expect(scope).toHaveTextContent(/live archive metadata/i)
    expect(scope).toHaveTextContent(/current explorer/i)
    expect(scope).toHaveTextContent(/GroundLine.*demonstration/i)
    expect(screen.getByRole("link", { name: /view code on github/i })).toHaveAttribute("href", "https://github.com/Shadman-Samin/EarthEyes_NASASpaceApps")
  })

  it.each([
    ["kuakata-changing-coast", "kuakata-bangladesh", /tide/],
    ["barishal-water-land", "barishal-bangladesh", /river gauge/],
    ["jakobshavn-ice-in-motion", "jakobshavn-glacier", /velocity/],
    ["imja-lake-review", "imja-tsho-nepal", /dam/],
  ])("gives %s a specific evidence question and the matching workspace", async (slug, placeId, evidence) => {
    renderRoute(<StoryPage />, `/stories/${slug}`, "/stories/:storySlug")
    await screen.findByRole("link", { name: "Open workspace" })
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.queryByRole("region", { name: "Evidence still needed" })).toHaveTextContent(evidence)
    expect(screen.queryByRole("region", { name: "What cannot be concluded" })).toHaveTextContent(/preview/)
    expect(screen.getByRole("link", { name: "Open workspace" })).toHaveAttribute("href", expect.stringContaining(`/explore/${placeId}?`))
  })
})
