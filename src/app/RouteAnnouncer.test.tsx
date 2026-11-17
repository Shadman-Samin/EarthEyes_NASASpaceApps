import { render } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { RouteAnnouncer } from "./RouteAnnouncer"

beforeEach(() => vi.spyOn(window, "scrollTo").mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

function renderAt(path: string) {
  return render(<MemoryRouter initialEntries={[path]}><div id="route-content" tabIndex={-1} /><RouteAnnouncer /></MemoryRouter>)
}

describe("RouteAnnouncer", () => {
  it("gives the home route a descriptive title without repeating the brand", async () => {
    renderAt("/")
    await vi.waitFor(() => expect(document.title).toBe("EarthEyes | A field atlas for a changing planet"))
  })

  it("includes the place or story in the document title", async () => {
    renderAt("/explore/kuakata-bangladesh")
    await vi.waitFor(() => expect(document.title).toBe("EarthEyes explorer: kuakata bangladesh | EarthEyes"))
  })

  it("does not crash on a malformed percent-encoded path", async () => {
    renderAt("/stories/100%")
    await vi.waitFor(() => expect(document.title).toContain("EarthEyes"))
  })

  it("describes the route for metadata and assistive technology", async () => {
    const { container } = renderAt("/methodology")
    await vi.waitFor(() => expect(document.title).toBe("EarthEyes methodology | EarthEyes"))
    expect(container.querySelector('[aria-live="polite"]')).toHaveTextContent("EarthEyes methodology")
  })
})
