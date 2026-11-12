import { QueryClient, QueryClientProvider } from "@tanstack/react-query"
import { render, screen } from "@testing-library/react"
import { MemoryRouter } from "react-router-dom"
import { describe, expect, it } from "vitest"
import { LandingPage } from "./LandingPage"

describe("LandingPage", () => {
  it("presents the short mission path and primary explorer action", async () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><LandingPage /></MemoryRouter></QueryClientProvider>)
    expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
    expect(screen.getByRole("link", { name: "Open the explorer" })).toHaveAttribute("href", "/explore")
    expect(await screen.findByText("Jakobshavn Glacier")).toBeInTheDocument()
  })

  it("embeds the supplied walkthrough without autoplay and provides a direct fallback", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    render(<QueryClientProvider client={client}><MemoryRouter><LandingPage /></MemoryRouter></QueryClientProvider>)
    const player = screen.getByTitle("EarthEyes project walkthrough")
    expect(player).toHaveAttribute("src", "https://www.youtube.com/embed/Z79QX64rM4w?si=TPwG5YWCkilhLh4e")
    expect(player).toHaveAttribute("loading", "lazy")
    expect(player).toHaveAttribute("referrerpolicy", "strict-origin-when-cross-origin")
    expect(player).toHaveAttribute("allowfullscreen")
    expect(screen.getByRole("link", { name: /watch on youtube/i })).toHaveAttribute("href", "https://www.youtube.com/watch?v=Z79QX64rM4w")
  })

  it("provides a muted local background clip with a poster", () => {
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } })
    const { container } = render(<QueryClientProvider client={client}><MemoryRouter><LandingPage /></MemoryRouter></QueryClientProvider>)
    const video = container.querySelector("video")!
    expect(video).toHaveAttribute("src", "/orbit-hero.mp4")
    expect(video).toHaveAttribute("poster", "/orbit-hero.jpg")
    expect(video).toHaveAttribute("loop")
    expect(video.muted).toBe(true)
    expect(screen.queryByRole("button", { name: /background video/i })).not.toBeInTheDocument()
  })
})
