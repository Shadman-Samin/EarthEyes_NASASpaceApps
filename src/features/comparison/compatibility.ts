import type { Observation } from "../../domain/models"

export type Compatibility = { level: "compatible" | "review" | "incompatible"; message: string }

export function sameFamily(left?: Observation, right?: Observation): boolean {
  return Boolean(left && right
    && left.platform === right.platform
    && left.instrument === right.instrument
    && left.polarization === right.polarization
    && left.processingLevel === right.processingLevel
    && left.imageUrl && right.imageUrl)
}

export function getCompatibility(left?: Observation, right?: Observation): Compatibility {
  if (!left || !right) return { level: "incompatible", message: "Select two observations to compare." }
  if (left.id === right.id) return { level: "incompatible", message: "The two sides must use distinct observations." }
  if (left.moduleId !== right.moduleId || left.placeId !== right.placeId) {
    return { level: "incompatible", message: "Observations must cover the same place and module." }
  }
  if (left.acquiredAt >= right.acquiredAt) {
    return { level: "incompatible", message: "The left observation must be earlier than the right observation." }
  }
  if (
    left.orbitDirection == null || right.orbitDirection == null ||
    left.relativeOrbit == null || right.relativeOrbit == null ||
    left.resolutionM == null || right.resolutionM == null ||
    left.coverageOverlap == null || right.coverageOverlap == null ||
    left.alignmentQuality == null || right.alignmentQuality == null ||
    !left.imageUrl || !right.imageUrl
  ) {
    return { level: "review", message: "Required comparison metadata or imagery is unavailable. Available images may be reviewed visually; quantitative difference is blocked." }
  }
  if (
    left.orbitDirection !== right.orbitDirection ||
    left.relativeOrbit !== right.relativeOrbit ||
    left.polarization !== right.polarization ||
    left.instrument !== right.instrument ||
    left.processingLevel !== right.processingLevel ||
    left.resolutionM !== right.resolutionM
  ) {
    return { level: "review", message: "Instrument, orbit, polarization, processing, or resolution differs. Visual review is available, but quantitative difference is blocked." }
  }
  if (Math.min(left.coverageOverlap, right.coverageOverlap) < 90 || left.alignmentQuality === "limited" || right.alignmentQuality === "limited") {
    return { level: "review", message: "Coverage or alignment is limited. Interpret only inside the valid overlap." }
  }
  return { level: "compatible", message: "Reported geometry and coverage support visual comparison." }
}
