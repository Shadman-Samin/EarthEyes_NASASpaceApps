import { z } from "zod"
import { catalogueBoundsSchema, catalogueProductIdSchema } from "./catalogue.js"

const finite = z.number().finite()
const fraction = finite.min(0).max(1)
const dates = z.array(z.iso.date()).min(1).max(100)
const position = z.tuple([finite.min(-180).max(180), finite.min(-90).max(90)])
const corners = z.tuple([position, position, position, position])
const httpsUrl = z.string().url().refine((value) => {
  const url = new URL(value)
  return url.protocol === "https:" && !url.username && !url.password
})
const assetUrl = z.string().regex(/^\/analysis\/[a-z0-9-]+\/rasters\/[a-z0-9-]+\.webp$/)

export const analysisQuerySchema = z.strictObject({
  product: catalogueProductIdSchema,
  bbox: catalogueBoundsSchema,
  start: z.iso.date(),
  end: z.iso.date(),
  polarization: z.enum(["HH", "HV", "VV", "VH", "LH", "LV", "RH", "RV"]).optional(),
}).refine((value) => value.start <= value.end, "End date must not precede start date")

const water = z.object({ area_km2: finite.nonnegative(), low_km2: finite.nonnegative(), high_km2: finite.nonnegative(), threshold_db: finite })
const reference = z.object({
  source: z.string(), status: z.enum(["compared", "unavailable"]), attempted_dates: z.number().int().nonnegative(),
  compared_dates: z.number().int().nonnegative(), unique_scenes: z.number().int().nonnegative(), mean_iou: fraction.nullable(),
  method: z.string(), limits: z.array(z.string()),
  dates: z.array(z.object({
    date: z.iso.date(), status: z.string(), reason: z.string().optional(), scene_date: z.iso.date().optional(),
    scene_id: z.string().optional(), offset_days: z.number().int().optional(), source_url: httpsUrl.optional(),
    coverage: fraction.optional(), iou: fraction.nullable().optional(), precision: fraction.nullable().optional(), recall: fraction.nullable().optional(),
  })).max(100),
})

export const analysisManifestSchema = z.object({
  schema_version: z.literal("3.0.0"), id: z.string().regex(/^[a-z0-9-]+$/), status: z.literal("exploratory_derived"),
  site: z.string(), label: z.string(), module: z.string(), phenomenon: z.string(), generated_at: z.iso.datetime({ offset: true }),
  bbox: catalogueBoundsSchema, product: catalogueProductIdSchema, polarization: z.string(),
  source_maturity: z.enum(["validated", "provisional", "beta"]), window: z.object({ start: z.iso.date(), end: z.iso.date() }),
  grid: z.object({
    width: z.number().int().positive(), height: z.number().int().positive(), spacing_m: finite.positive(), epsg: z.number().int().positive(),
    transform: z.tuple([finite, finite, finite, finite, finite, finite]), corners, signature: z.string(), area_basis: z.string(),
  }),
  dates: z.array(z.object({
    date: z.iso.date(), acquired_at: z.iso.datetime({ offset: true }), granule: z.string(), source_url: httpsUrl,
    valid_fraction: fraction, mean_looks: finite.positive(), native_quality_fraction: fraction,
  })).min(2).max(100),
  epochs: z.object({ first: z.object({ dates, water: water.nullable() }), last: z.object({ dates, water: water.nullable() }) }),
  time_series: z.array(z.object({
    date: z.iso.date(), mean_db: finite, valid_area_km2: finite.positive(),
    water_km2: finite.nonnegative().optional(), water_low_km2: finite.nonnegative().optional(), water_high_km2: finite.nonnegative().optional(),
  })).min(2).max(100),
  claims: z.array(z.object({
    id: z.enum(["water_extent_change", "retained_brightness_change_area", "median_backscatter_change"]),
    label: z.string(), value: finite, unit: z.enum(["km2", "dB"]), method: z.string(),
    sensitivity: z.object({ low: finite, high: finite, basis: z.string() }).optional(),
  })).min(2).max(3),
  change: z.object({
    k: finite.positive(), median_conditional_threshold_db: finite.positive(), median_conditional_sigma_db: finite.positive(),
    retained_component_count: z.number().int().nonnegative(),
    retained_components: z.array(z.object({ id: z.number().int(), pixels: z.number().int().positive(), area_km2: finite.positive(),
      centroid_px: z.tuple([finite, finite]), bbox_px: z.tuple([finite, finite, finite, finite]), kind: z.enum(["brighter", "darker"]) })).max(12),
    sweep_area_km2: z.record(z.string(), finite.nonnegative()), common_valid_area_km2: finite.positive(), common_valid_fraction: fraction, screen_model: z.string(),
  }),
  validation: z.object({
    status: z.enum(["unchecked", "attempted"]), checked_at: z.iso.datetime({ offset: true }).nullable(), references: z.array(reference),
    maturity: z.object({ status: z.literal("availability_checked"), limitation: z.string(), collections: z.array(z.object({
      product: catalogueProductIdSchema, collection: z.string(), status: z.enum(["metadata_only", "no_matching_dates", "unavailable"]),
      matching_dates: z.number().int().nonnegative(), compared_dates: z.number().int().nonnegative(),
    })) }).nullable(),
  }),
  provenance: z.object({
    algorithm_version: z.literal("3.0.0"), config_hash: z.string(), collection: z.string(),
    series: z.object({ relative_orbit: z.string(), direction: z.string(), frame: z.string(), mode: z.string(), polarization_token: z.string(), baseline: z.string() }),
    parameters: z.object({ k_sigma: finite, k_sweep: z.array(finite), min_cluster_m2: finite, water_threshold_offsets_db: z.array(finite),
      epoch_size: z.number().int(), independent_look_gain_assumed: z.literal(false), area_basis: z.string() }),
    source_processing: z.record(z.string(), z.string()), measurement_quantization_db: finite.positive(), geometry_checked_dates: z.number().int().positive(), citations: z.array(httpsUrl),
  }),
  limitations: z.array(z.string()).min(1),
  raster: z.object({ format: z.literal("webp-rgba"), coordinates: corners, delta_url: assetUrl, water_change_url: assetUrl.nullable(), placement: z.string() }).nullable(),
}).superRefine((value, ctx) => {
  const days = value.dates.map((row) => row.date)
  if (new Set(days).size !== days.length || days.some((day, index) => day < value.window.start || day > value.window.end || (index > 0 && day <= days[index - 1]))) {
    ctx.addIssue({ code: "custom", message: "Analysis dates must be distinct, ordered, and inside the published window" })
  }
  if (value.provenance.geometry_checked_dates !== days.length || value.time_series.some((point, index) => point.date !== days[index]) || value.time_series.length !== days.length) {
    ctx.addIssue({ code: "custom", message: "Incomplete geometry evidence or time series" })
  }
  if ([...value.epochs.first.dates, ...value.epochs.last.dates].some((day) => !days.includes(day)) || value.epochs.first.dates.some((day) => value.epochs.last.dates.includes(day))) {
    ctx.addIssue({ code: "custom", message: "Epochs must use disjoint published dates" })
  }
  for (const claim of value.claims) {
    if (claim.sensitivity && !(claim.sensitivity.low <= claim.value && claim.value <= claim.sensitivity.high)) {
      ctx.addIssue({ code: "custom", message: "Sensitivity must include the central estimate" })
    }
  }
})

export const analysisIndexSchema = z.object({ schema_version: z.literal("3.0.0"), entries: z.array(analysisManifestSchema) })
export const analysisResultSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("analysis_available"), manifest: analysisManifestSchema }),
  z.object({ status: z.literal("analysis_unavailable"), reason: z.string() }),
])
export type AnalysisQuery = z.infer<typeof analysisQuerySchema>
export type AnalysisManifest = z.infer<typeof analysisManifestSchema>
export type AnalysisResult = z.infer<typeof analysisResultSchema>

export function matchesAnalysis(bundle: AnalysisManifest, query: AnalysisQuery): boolean {
  return bundle.product === query.product && bundle.window.start === query.start && bundle.window.end === query.end
    && (!query.polarization || bundle.polarization === query.polarization)
    && bundle.bbox.every((value, index) => value === query.bbox[index])
}
