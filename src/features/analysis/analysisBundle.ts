import { useQuery } from "@tanstack/react-query"
import { z } from "zod"

export const analysisClusterSchema = z.object({
  id: z.number(),
  kind: z.string(),
  pixels: z.number(),
  area_km2: z.number(),
  centroid_px: z.array(z.number()).length(2),
  bbox_px: z.array(z.number()).length(4),
  centroid_lonlat: z.array(z.number()).length(2).optional(),
})

export const analysisManifestSchema = z.object({
  site: z.string(),
  placeId: z.string(),
  label: z.string(),
  module: z.string(),
  phenomenon: z.string(),
  generated_at: z.string(),
  algorithm_version: z.string(),
  grid: z.object({
    width: z.number(),
    height: z.number(),
    spacing_m: z.number(),
    epsg: z.number(),
    corners: z.array(z.array(z.number()).length(2)),
  }),
  raster: z.object({
    format: z.string(),
    unit: z.string(),
    scale: z.number(),
    invalid: z.number(),
    urls: z.record(z.string(), z.string()),
  }),
  dates: z.array(
    z.object({
      date: z.string(),
      acquired_at: z.string(),
      granule: z.string(),
      source_url: z.string(),
      polarization: z.string(),
      valid_fraction: z.number(),
      mean_db: z.number(),
      p2_db: z.number(),
      p98_db: z.number(),
    }),
  ),
  time_series: z.array(
    z.object({
      date: z.string(),
      mean_db: z.number(),
      water_fraction: z.number().optional(),
    }),
  ),
  water: z.record(z.string(),
    z.object({
      fraction: z.number(),
      area_km2: z.number(),
      threshold_db: z.number(),
    }),
  ),
  pairs: z.record(z.string(),
    z.object({
      from: z.string(),
      to: z.string(),
      threshold_db: z.number(),
      changed_fraction: z.number(),
      changed_area_km2: z.number(),
      gain_area_km2: z.number(),
      loss_area_km2: z.number(),
      delta_url: z.string(),
      story: z.object({
        headline: z.string(),
        summary: z.string(),
      }),
      clusters: z.array(analysisClusterSchema),
    }),
  ),
  persistent_clusters: z.array(analysisClusterSchema),
  story: z.object({
    headline: z.string(),
    summary: z.string(),
    detail: z.string(),
  }),
  provenance: z.object({
    mission: z.string(),
    collection: z.string(),
    product: z.string(),
    polarization: z.string(),
    dates: z.array(z.string()),
    citations: z.array(z.string()),
  }),
  limitations: z.array(z.string()),
})

export type AnalysisManifest = z.infer<typeof analysisManifestSchema>
export type AnalysisCluster = z.infer<typeof analysisClusterSchema>

export async function fetchAnalysisManifest(placeId: string): Promise<AnalysisManifest | null> {
  const response = await fetch(`/analysis/${placeId}/manifest.json`, { cache: "no-cache" })
  if (response.status === 404) return null
  if (!response.ok) throw new Error(`Analysis bundle unavailable (${response.status})`)
  return analysisManifestSchema.parse(await response.json())
}

export function useAnalysisBundle(placeId: string) {
  return useQuery({
    queryKey: ["analysis", placeId],
    queryFn: () => fetchAnalysisManifest(placeId),
    staleTime: 300_000,
    retry: false,
  })
}

export function analysisPairKey(from: string, to: string) {
  return `${from}--${to}`
}
