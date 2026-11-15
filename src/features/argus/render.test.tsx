import { render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"
import { ArgusText } from "./render"
import { parseArgusText } from "./text"

describe("Argus answer rendering", () => {
  it("splits paragraphs, bullets and ordered steps", () => {
    const blocks = parseArgusText("Summary line.\n\n- first\n- second\n\n1. one\n2. two")
    expect(blocks).toEqual([
      { kind: "paragraph", items: ["Summary line."] },
      { kind: "bullets", items: ["first", "second"] },
      { kind: "ordered", items: ["one", "two"] },
    ])
  })
  it("renders emphasis, code and safe links without injecting HTML", () => {
    render(<ArgusText text={"**12%** changed\n\nUse `HV`.\n\nhttps://example.com/a?b=1"} />)
    expect(screen.getByText("12%").tagName).toBe("STRONG")
    expect(screen.getByText("HV").tagName).toBe("CODE")
    const link = screen.getByRole("link")
    expect(link).toHaveAttribute("href", "https://example.com/a?b=1")
    expect(link).toHaveAttribute("rel", "noreferrer")
  })
  it("treats script-like text as plain text", () => {
    render(<ArgusText text={"<script>alert(1)</script>"} />)
    expect(screen.getByText("<script>alert(1)</script>")).toBeInTheDocument()
  })
})
