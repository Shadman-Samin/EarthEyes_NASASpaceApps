import { describe, expect, it } from "vitest"
import { alertsSchema, layersSchema, measurementsSchema, observationsSchema, placesSchema } from "./models"
import { alerts, dataSources, layers, measurements, observations, places } from "../mocks/fixtures"

describe("EarthEyes domain fixtures", () => {
  it("preserves unknown live acquisition metadata instead of inventing measurements", () => {
    const live = { ...observations[0], orbitDirection: null, relativeOrbit: null, resolutionM: null, coverageOverlap: null, alignmentQuality: null, imageUrl: null }
    expect(observationsSchema.parse([live])[0]).toMatchObject({ relativeOrbit: null, resolutionM: null, coverageOverlap: null, imageUrl: null })
  })

  it("conforms to the backend-ready schemas", () => {
    expect(placesSchema.parse(places)).toHaveLength(4)
    expect(observationsSchema.parse(observations).length).toBeGreaterThan(8)
    expect(layersSchema.parse(layers).length).toBeGreaterThan(15)
    expect(measurementsSchema.parse(measurements).length).toBeGreaterThan(5)
    expect(alertsSchema.parse(alerts)).toHaveLength(2)
  })

  it("exposes only covered modules for each place", () => {
    for (const place of places) {
      expect(new Set(place.coverage.map((coverage) => coverage.moduleId))).toEqual(new Set(place.moduleIds))
    }
  })

  it("attaches scientific state and limitations to every observation", () => {
    for (const observation of observations) {
      expect(observation.classification).toBe("observed")
      expect(observation.knownLimitations.length).toBeGreaterThan(0)
      expect(observation.coverageOverlap).toBeGreaterThan(0)
    }
  })

  it("resolves every observation and layer source to the catalogue", () => {
    const sourceIds = new Set(dataSources.map((source) => source.id))
    for (const observation of observations) expect(sourceIds.has(observation.sourceId)).toBe(true)
    for (const layer of layers) expect(sourceIds.has(layer.sourceId)).toBe(true)
    for (const measurement of measurements) {
      for (const sourceId of measurement.sourceIds) expect(sourceIds.has(sourceId)).toBe(true)
    }
  })
})
