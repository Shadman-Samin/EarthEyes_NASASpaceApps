import { z } from "zod"

export const moduleIdSchema = z.enum(["coastal", "flood", "ice", "glof"])
export const dataClassSchema = z.enum([
  "observed",
  "derived",
  "modeled",
  "context",
  "interpretation",
  "authority-alert",
])
export const qualitySchema = z.enum([
  "validated",
  "provisional",
  "review-required",
  "limited",
])
export const comparisonModeSchema = z.enum([
  "swipe",
  "side-by-side",
  "single",
  "difference",
  "fade",
])

const isoDateSchema = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Expected an ISO calendar date")
const isoDateTimeSchema = z.string().datetime({ offset: true })

const boundsSchema = z.tuple([
  z.number(),
  z.number(),
  z.number(),
  z.number(),
])

const coverageSchema = z.object({
  moduleId: moduleIdSchema,
  start: isoDateSchema,
  end: isoDateSchema,
  sceneCount: z.number().int().nonnegative(),
  state: z.enum(["available", "limited", "context-only"]),
})

export const placeSchema = z.object({
  id: z.string(),
  name: z.string(),
  country: z.string(),
  kind: z.enum(["coast", "district", "glacier", "lake", "area"]),
  center: z.tuple([z.number(), z.number()]),
  bounds: boundsSchema,
  description: z.string(),
  moduleIds: z.array(moduleIdSchema).min(1),
  coverage: z.array(coverageSchema),
  storySlug: z.string().optional(),
})

export const observationSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  moduleId: moduleIdSchema,
  acquiredAt: isoDateTimeSchema,
  platform: z.string(),
  instrument: z.string(),
  orbitDirection: z.enum(["ascending", "descending"]).nullable(),
  relativeOrbit: z.number().int().positive().nullable(),
  polarization: z.string(),
  processingLevel: z.string(),
  resolutionM: z.number().positive().nullable(),
  coverageOverlap: z.number().min(0).max(100).nullable(),
  alignmentQuality: z.enum(["high", "moderate", "limited"]).nullable(),
  sourceId: z.string(),
  classification: dataClassSchema,
  quality: qualitySchema,
  imageUrl: z.string().nullable(),
  sourceUrl: z.string().url().optional(),
  knownLimitations: z.array(z.string()),
})

export const layerSchema = z.object({
  id: z.string(),
  moduleId: moduleIdSchema,
  label: z.string(),
  description: z.string(),
  classification: dataClassSchema,
  quality: qualitySchema,
  sourceId: z.string(),
  unit: z.string().nullable(),
  color: z.string(),
  defaultEnabled: z.boolean(),
})

export const measurementSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  moduleId: moduleIdSchema,
  label: z.string(),
  value: z.union([z.number(), z.string()]),
  unit: z.string(),
  classification: dataClassSchema,
  quality: qualitySchema,
  uncertainty: z.string(),
  spatialArea: z.string(),
  effectiveDateRange: z.string(),
  sourceIds: z.array(z.string()).min(1),
  sourceProducts: z.array(z.string()),
  processingVersion: z.string(),
  citation: z.string(),
  updatedAt: isoDateTimeSchema,
})

export const eventSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  title: z.string(),
  date: isoDateSchema,
  description: z.string(),
  classification: dataClassSchema,
  source: z.string(),
})

export const alertSchema = z.object({
  id: z.string(),
  placeId: z.string(),
  title: z.string(),
  status: z.enum(["candidate", "analyst-review", "authority-issued", "expired"]),
  severity: z.enum(["minor", "moderate", "severe", "extreme"]),
  certainty: z.enum(["possible", "likely", "observed"]),
  urgency: z.enum(["future", "expected", "immediate"]),
  issuedAt: isoDateTimeSchema,
  expiresAt: isoDateTimeSchema,
  authority: z.string(),
  area: z.string(),
  instruction: z.string(),
  smsPreview: z.string(),
  voicePreview: z.string(),
})

export const dataSourceSchema = z.object({
  id: z.string(),
  name: z.string(),
  provider: z.string(),
  technology: z.string(),
  role: z.string(),
  coverage: z.string(),
  updateCadence: z.string(),
  accessUrl: z.string().url(),
  citation: z.string(),
  limitations: z.array(z.string()),
})

export const placesSchema = z.array(placeSchema)
export const observationsSchema = z.array(observationSchema)
export const layersSchema = z.array(layerSchema)
export const measurementsSchema = z.array(measurementSchema)
export const eventsSchema = z.array(eventSchema)
export const alertsSchema = z.array(alertSchema)
export const dataSourcesSchema = z.array(dataSourceSchema)

export type ModuleId = z.infer<typeof moduleIdSchema>
export type DataClass = z.infer<typeof dataClassSchema>
export type Quality = z.infer<typeof qualitySchema>
export type ComparisonMode = z.infer<typeof comparisonModeSchema>
export type Place = z.infer<typeof placeSchema>
export type Observation = z.infer<typeof observationSchema>
export type LayerDefinition = z.infer<typeof layerSchema>
export type Measurement = z.infer<typeof measurementSchema>
export type EventContext = z.infer<typeof eventSchema>
export type Alert = z.infer<typeof alertSchema>
export type DataSource = z.infer<typeof dataSourceSchema>
