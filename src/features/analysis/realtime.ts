import type { CatalogueItem } from "../../domain/catalogue"
import type { Observation, Place } from "../../domain/models"
import { acquisitionGroup } from "../../data/live-explorer"

export type AcquisitionSeriesPoint = {
  id: string
  date: string
  acquiredAt: string
  platform: string
  processing: string
  polarization: string
  orbit: string
  sourceUrl?: string
}

export type RealtimeContext = {
  placeName: string
  areaLabel: string
  bounds: [number, number, number, number]
  productLabel: string
  dateWindow: { start: string; end: string } | null
  acquisitionCount: number
  groupCount: number
  groupLabel: string
  orbits: string[]
  polarizations: string[]
  sourceMaturity: string
  sourceUrl?: string
  comparedPair: { from: string; to: string; leftId: string; rightId: string; fromAt: string; toAt: string } | null
}

export function bestGroup(items: CatalogueItem[]): string {
  const groups = [...new Set(items.map(acquisitionGroup))]
  if (!groups.length) return ""
  const scored = groups.map((g) => {
    const gi = items.filter((i) => acquisitionGroup(i) === g)
    const dates = new Set(gi.map((i) => i.acquiredAt)).size
    return { g, dates, count: gi.length }
  })
  scored.sort((a, b) => b.dates - a.dates || b.count - a.count)
  return scored[0].g
}

export function pickBestPair(observations: Observation[]): { left: Observation; right: Observation } | null {
  const withImg = observations.filter((o) => o.imageUrl)
  const pool = withImg.length >= 2 ? withImg : observations
  if (pool.length < 2) return null
  const sorted = [...pool].sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt))
  return { left: sorted[0], right: sorted[sorted.length - 1] }
}

export function buildSeries(observations: Observation[]): AcquisitionSeriesPoint[] {
  return [...observations]
    .sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt))
    .map((o) => ({
      id: o.id,
      date: o.acquiredAt.slice(0, 10),
      acquiredAt: o.acquiredAt,
      platform: o.platform,
      processing: o.processingLevel,
      polarization: o.polarization,
      orbit: o.orbitDirection ?? "unknown",
      sourceUrl: o.sourceUrl,
    }))
}

export function buildRealtimeContext(args: {
  place: Place
  items: CatalogueItem[]
  observations: Observation[]
  group: string
  query: { start: string; end: string; product: string } | null
  compared: { left: Observation; right: Observation } | null
}): RealtimeContext {
  const { place, items, observations, group, query, compared } = args
  const orbits = [...new Set(items.map((i) => i.orbitDirection).filter(Boolean))] as string[]
  const pols = [...new Set(items.flatMap((i) => i.polarizations))].filter(Boolean)
  const maturity = items[0]?.sourceMaturity ?? "unknown"
  const b = place.bounds
  const coord = (value: number, positive: string, negative: string) => `${Math.abs(value).toFixed(2)}°${value >= 0 ? positive : negative}`
  const areaLabel = `${coord(b[1], "N", "S")}–${coord(b[3], "N", "S")}, ${coord(b[0], "E", "W")}–${coord(b[2], "E", "W")}`
  return {
    placeName: place.name,
    areaLabel,
    bounds: place.bounds,
    productLabel: query?.product ?? "SAR archive",
    dateWindow: query ? { start: query.start, end: query.end } : null,
    acquisitionCount: items.length,
    groupCount: new Set(items.map(acquisitionGroup)).size,
    groupLabel: group || "all footprints",
    orbits,
    polarizations: pols,
    sourceMaturity: maturity,
    sourceUrl: compared?.right.sourceUrl ?? observations.at(-1)?.sourceUrl,
    comparedPair: compared
      ? { from: compared.left.acquiredAt.slice(0, 10), to: compared.right.acquiredAt.slice(0, 10), leftId: compared.left.id, rightId: compared.right.id, fromAt: compared.left.acquiredAt, toAt: compared.right.acquiredAt }
      : null,
  }
}
