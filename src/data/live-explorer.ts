import type { CatalogueItem } from "../domain/catalogue"
import { catalogueProducts } from "../domain/catalogue"
import { observationSchema, type DataSource, type ModuleId } from "../domain/models"

export const operaSource: DataSource = {
  id: "OPERA_L2_RTC-S1_V1_1", name: "OPERA Sentinel-1 RTC", provider: "NASA OPERA / ASF DAAC",
  technology: "C-band SAR", role: "Real acquisition records and official SAR browse images.",
  coverage: "Source archive coverage; loaded pages are not a complete scene count.",
  updateCadence: "Acquisition and publication schedules vary.",
  accessUrl: catalogueProducts["opera-rtc-s1"].documentationUrl,
  citation: "NASA OPERA Level-2 Radiometric Terrain Corrected Sentinel-1, ASF DAAC.",
  limitations: ["Browse images are not calibrated analytical rasters.", "No overlap, alignment, or change measurement has been computed."],
}

export function acquisitionGroup(item: CatalogueItem) {
  return item.id.match(/^OPERA_L2_RTC-S1_(T\d+-\d+-IW[123])_/)?.[1] ?? item.id
}

export function catalogueObservation(item: CatalogueItem, placeId: string, moduleId: ModuleId) {
  const previews = item.assets.filter((asset) => asset.access === "public" && asset.roles.some((role) => ["browse", "thumbnail"].includes(role)))
  const preview = previews.find((asset) => /_BROWSE_low-res\.png(?:\?|$)/i.test(asset.href))
    ?? previews.find((asset) => /_BROWSE_thumbnail\.png(?:\?|$)/i.test(asset.href))
  return observationSchema.parse({
    id: item.id, placeId, moduleId, acquiredAt: item.acquiredAt,
    platform: item.platform ?? "Not reported", instrument: "Sentinel-1 SAR",
    orbitDirection: item.orbitDirection, relativeOrbit: item.relativeOrbit,
    polarization: item.polarizations.join(" / ") || "Not reported",
    processingLevel: item.processingFamily, resolutionM: null, coverageOverlap: null, alignmentQuality: null,
    sourceId: item.collectionId, classification: "observed",
    quality: item.sourceMaturity === "validated" ? "validated" : "review-required",
    imageUrl: preview?.href ?? null, sourceUrl: item.sourceUrl,
    knownLimitations: [
      "Official SAR browse image, not a calibrated raster or a validated change measurement.",
      "Preview alignment, overlap and pixel resolution have not been computed.",
      `Provider source maturity: ${item.sourceMaturity}. Missing metadata remains unreported.`,
    ],
  })
}
