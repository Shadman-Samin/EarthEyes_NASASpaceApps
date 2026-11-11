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
    expect(screen.getByRole("heading", { level: 1, name: /ground has a story/i })).toBeInTheDocument()
    expect(screen.getByRole("link", { name: /open the explorer/i })).toHaveAttribute("href", expect.stringContaining("/explore/kuakata-bangladesh"))
    expect(await screen.findByText("Jakobshavn Glacier")).toBeInTheDocument()
  })
})
