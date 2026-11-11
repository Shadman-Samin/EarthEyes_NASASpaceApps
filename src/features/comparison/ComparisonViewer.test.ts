import { describe, expect, it } from "vitest"
import { observations } from "../../mocks/fixtures"
import { getCompatibility } from "./compatibility"

describe("comparison compatibility", () => {
  it("rejects a manufactured same-observation comparison", () => {
    expect(getCompatibility(observations[0], observations[0]).level).toBe("incompatible")
  })

  it("flags geometry differences for review instead of hiding them", () => {
    expect(getCompatibility(observations[0], observations[1]).level).toBe("review")
  })

  it("accepts aligned observations from the same series", () => {
    const pair = observations.filter((observation) => observation.placeId === "jakobshavn-glacier" && observation.platform === "NISAR")
    expect(getCompatibility(pair[0], pair[1]).level).toBe("compatible")
  })

  it("rejects a reversed chronological pair", () => {
    const pair = observations.filter((observation) => observation.placeId === "jakobshavn-glacier" && observation.platform === "NISAR")
    expect(getCompatibility(pair[1], pair[0]).level).toBe("incompatible")
  })
})
