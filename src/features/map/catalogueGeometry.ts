import type { CatalogueItem } from "../../domain/catalogue"

export function catalogueMapGeometry(item: Pick<CatalogueItem, "bbox" | "geometry">, center: number): NonNullable<CatalogueItem["geometry"]> {
  const [west, south, east, north] = item.bbox
  const end = east < west ? east + 360 : east
  if (!item.geometry) {
    const shift = 360 * Math.round((center - (west + end) / 2) / 360)
    return { type: "Polygon", coordinates: [[[west + shift, south], [end + shift, south], [end + shift, north], [west + shift, north], [west + shift, south]]] }
  }
  const unwrap = (polygon: number[][][]) => {
    let anchor = center
    return polygon.map((ring, index) => {
      let previous = ring[0][0]
      const continuous = ring.map(([longitude, latitude]): [number, number] => {
        previous = longitude + 360 * Math.round((previous - longitude) / 360)
        return [previous, latitude]
      })
      const longitudes = continuous.map(([longitude]) => longitude)
      const middle = (Math.min(...longitudes) + Math.max(...longitudes)) / 2
      const shift = 360 * Math.round((anchor - middle) / 360)
      // Holes must stay in the same world copy as their enclosing ring.
      if (index === 0) anchor = middle + shift
      return continuous.map(([longitude, latitude]): [number, number] => [longitude + shift, latitude])
    })
  }
  return item.geometry.type === "Polygon"
    ? { type: "Polygon", coordinates: unwrap(item.geometry.coordinates) }
    : { type: "MultiPolygon", coordinates: item.geometry.coordinates.map(unwrap) }
}
