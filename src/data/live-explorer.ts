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

export type NisarProductKey = "nisar-gcov" | "nisar-gcov-provisional" | "nisar-gcov-beta"

export function nisarSource(product: NisarProductKey = "nisar-gcov-provisional"): DataSource {
  const config = catalogueProducts[product]
  return {
    id: config.collectionId, name: config.name, provider: "NASA / ISRO / ASF DAAC",
    technology: "L-band and S-band SAR", role: "Real NISAR acquisition records and official per-polarization browse images.",
    coverage: "Source archive coverage; loaded pages are not a complete scene count.",
    updateCadence: "Acquisition and publication schedules vary.",
    accessUrl: config.documentationUrl,
    citation: "NASA-ISRO Synthetic Aperture Radar (NISAR) GCOV, ASF DAAC.",
    limitations: [
      "Browse images are published PNG renders, not calibrated analytical rasters.",
      "GCOV data products are HDF5 and were not loaded; no georeferenced raster overlay exists.",
      "Provisional and beta products carry unflagged quality caveats.",
      "No overlap, alignment, or change measurement has been computed.",
    ],
  }
}

export function isNisarCollection(item: CatalogueItem) {
  return /^NISAR_L2/.test(item.collectionId)
}

export function acquisitionGroup(item: CatalogueItem) {
  // NISAR ids carry the repeat cycle (023, 024, …) before the track; grouping must ignore it
  // so that repeated passes over the same track/frame land in one comparable series.
  return item.id.match(/^OPERA_L2_RTC-S1_(T\d+-\d+-IW[123])_/)?.[1]
    ?? item.id.match(/^NISAR_L2_PR_GCOV_\d+_(\d+_[AD]_\d+)_/)?.[1]
    ?? item.id.match(/^(NISAR_L2_PR_GCOV_.*)_\d{8}T/)?.[1]
    ?? item.id
}

export function acquisitionGroupLabel(group: string) {
  const nisar = group.match(/^(\d+)_([AD])_(\d+)$/)
  if (nisar) return `Track ${nisar[1]} · Frame ${nisar[3]} · ${nisar[2] === "A" ? "Ascending" : "Descending"}`
  const opera = group.match(/^(T\d+)-(\d+)-(IW[123])$/)
  if (opera) return `${opera[1]} · Burst ${opera[2]} · ${opera[3]}`
  return group
}

export type NisarPolarization = "HHHH" | "HVHV"

function nisarPreview(previews: CatalogueItem["assets"], polarization: NisarPolarization) {
  // Browse assets repeat with thumbnail roles; deduplicate by file name.
  const unique = [...new Map(previews.map((asset) => [asset.href.split("/").at(-1)?.replace(/\?.*$/, "") ?? asset.href, asset])).values()]
  const beams = ["B", "A"] as const
  for (const beam of beams) {
    const match = unique.find((asset) => new RegExp(`_NATIVE_${beam}_${polarization}\\.png(?:\\?|$)`, "i").test(asset.href))
    if (match) return { asset: match, beam }
  }
  const composite = unique.find((asset) => /_NATIVE\.png(?:\?|$)/i.test(asset.href))
  if (composite) return { asset: composite, beam: null }
  return null
}

export function catalogueObservation(
  item: CatalogueItem,
  placeId: string,
  moduleId: ModuleId,
  { polarization = "HVHV" as NisarPolarization }: { polarization?: NisarPolarization } = {},
) {
  const previews = item.assets.filter((asset) => asset.access === "public" && asset.roles.some((role) => ["browse", "thumbnail"].includes(role)))
  const nisar = isNisarCollection(item)
  const nisarPreviewAsset = nisar ? nisarPreview(previews, polarization) : null
  // A record without the requested polarization must not break the whole imported series;
  // fall back to any published browse render and leave the image absent if none exists.
  const preview = nisar
    ? nisarPreviewAsset?.asset ?? previews.find((asset) => /_NATIVE\.png(?:\?|$)/i.test(asset.href)) ?? previews[0]
    : previews.find((asset) => /_BROWSE_low-res\.png(?:\?|$)/i.test(asset.href))
      ?? previews.find((asset) => /_BROWSE_thumbnail\.png(?:\?|$)/i.test(asset.href))
  const nisarPolarization = nisarPreviewAsset?.asset.href.match(/_NATIVE_[AB]_([HV]{4})\.png(?:\?|$)/i)?.[1]
  const polarizationLabel = nisar
    ? `${nisarPolarization?.slice(0, 2) ?? "Not reported"}${nisarPreviewAsset?.beam ? ` (beam ${nisarPreviewAsset.beam})` : " (composite)"}`
    : item.polarizations.join(" / ") || "Not reported"
  return observationSchema.parse({
    id: item.id, placeId, moduleId, acquiredAt: item.acquiredAt,
    platform: nisar ? "NISAR" : item.platform ?? "Not reported",
    instrument: nisar ? "NISAR L-band SAR" : "Sentinel-1 SAR",
    orbitDirection: item.orbitDirection, relativeOrbit: item.relativeOrbit,
    polarization: polarizationLabel,
    processingLevel: item.processingFamily, resolutionM: null, coverageOverlap: null, alignmentQuality: null,
    sourceId: item.collectionId, classification: "observed",
    quality: item.sourceMaturity === "validated" ? "validated" : "review-required",
    imageUrl: preview?.href ?? null, sourceUrl: item.sourceUrl,
    knownLimitations: [
      nisar
        ? "Official NISAR L-band browse image, not a calibrated raster or a validated change measurement."
        : "Official SAR browse image, not a calibrated raster or a validated change measurement.",
      "Preview alignment, overlap and pixel resolution have not been computed.",
      nisar
        ? `NISAR products are ${item.sourceMaturity}; quality flags are not final.`
        : `Provider source maturity: ${item.sourceMaturity}. Missing metadata remains unreported.`,
    ],
  })
}
