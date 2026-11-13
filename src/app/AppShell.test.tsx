import { render, screen, within } from "@testing-library/react"
import userEvent from "@testing-library/user-event"
import { MemoryRouter, Route, Routes } from "react-router-dom"
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest"
import { AppShell } from "./AppShell"

beforeEach(() => vi.spyOn(window, "scrollTo").mockImplementation(() => {}))
afterEach(() => vi.restoreAllMocks())

function renderShell() {
  render(<MemoryRouter><Routes><Route element={<AppShell />}><Route index element={<main><h1>Home</h1></main>} /></Route></Routes></MemoryRouter>)
}

describe("AppShell navigation", () => {
  it("uses the main logo in the shared site identity", () => {
    renderShell()
    const headerLogo = document.querySelector(".site-brand__logo")
    const footerLogo = document.querySelector(".site-footer__logo")
    expect(headerLogo).toHaveAttribute("src", "/eartheyes-logo.png")
    expect(headerLogo).toHaveAttribute("alt", "")
    expect(footerLogo).toHaveAttribute("src", "/eartheyes-logo.png")
    expect(footerLogo).toHaveAttribute("alt", "")
  })

  it("closes the mobile disclosure with Escape and restores focus to its button", async () => {
    const user = userEvent.setup()
    renderShell()
    await user.click(screen.getByRole("button", { name: "Open navigation" }))
    const menu = screen.getByRole("navigation", { name: "Mobile navigation" })
    const home = within(menu).getByRole("link", { name: "Home" })
    expect(home).toHaveAttribute("aria-current", "page")
    home.focus()
    await user.keyboard("{Escape}")
    expect(screen.queryByRole("navigation", { name: "Mobile navigation" })).not.toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Open navigation" })).toHaveFocus()
  })

  it("provides a short footer return path and an actual repository link", () => {
    renderShell()
    const footer = within(screen.getByRole("contentinfo"))
    expect(footer.getByRole("link", { name: "Home" })).toHaveAttribute("href", "/")
    expect(footer.getByRole("link", { name: "Explore" })).toHaveAttribute("href", "/explore")
    expect(footer.getByRole("link", { name: /source code/i })).toHaveAttribute("href", "https://github.com/Shadman-Samin/EarthEyes_NASASpaceApps")
  })
})
