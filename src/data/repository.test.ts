import { describe, expect, it } from "vitest"
import { HttpEarthEyesRepository } from "./repository"

const repository = new HttpEarthEyesRepository("http://localhost/api")

describe("HTTP repository contract", () => {
  it("searches typed place records through the API boundary", async () => {
    const results = await repository.searchPlaces("Jakobshavn")
    expect(results).toHaveLength(1)
    expect(results[0].id).toBe("jakobshavn-glacier")
  })

  it("returns module-specific observations and measurements", async () => {
    const observations = await repository.getObservations({ placeId: "kuakata-bangladesh", moduleId: "coastal" })
    const measurements = await repository.getMeasurements({ placeId: "kuakata-bangladesh", moduleId: "coastal" })
    expect(observations.length).toBeGreaterThan(1)
    expect(new Set(observations.map((observation) => observation.moduleId))).toEqual(new Set(["coastal"]))
    expect(measurements.every((measurement) => measurement.uncertainty.length > 0)).toBe(true)
  })
})
