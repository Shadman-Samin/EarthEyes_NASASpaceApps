import { expect, test } from "vitest"
import { catalogueMapGeometry } from "./catalogueGeometry"

test("a dateline bounding box stays narrow in a world view", () => {
  expect(catalogueMapGeometry({ bbox: [179, -20, -179, -16], geometry: null }, 0)).toEqual({
    type: "Polygon", coordinates: [[[179, -20], [181, -20], [181, -16], [179, -16], [179, -20]]],
  })
})

test("a full-world bounding box keeps its declared extent", () => {
  expect(catalogueMapGeometry({ bbox: [-180, -90, 180, 90], geometry: null }, 0)).toEqual({
    type: "Polygon", coordinates: [[[-180, -90], [180, -90], [180, 90], [-180, 90], [-180, -90]]],
  })
})

test("a dateline polygon and its hole occupy the same continuous world copy", () => {
  const geometry = catalogueMapGeometry({ bbox: [179, -20, -179, -16], geometry: {
    type: "Polygon", coordinates: [
      [[179, -20], [-179, -20], [-179, -16], [179, -16], [179, -20]],
      [[-179.5, -19], [179.5, -19], [179.5, -17], [-179.5, -17], [-179.5, -19]],
    ],
  } }, 0)
  expect(geometry).toEqual({ type: "Polygon", coordinates: [
    [[179, -20], [181, -20], [181, -16], [179, -16], [179, -20]],
    [[180.5, -19], [179.5, -19], [179.5, -17], [180.5, -17], [180.5, -19]],
  ] })
})
