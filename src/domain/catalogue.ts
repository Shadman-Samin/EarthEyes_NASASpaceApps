import { z } from "zod"

export const catalogueProductIdSchema = z.enum([
  "nisar-gcov",
  "nisar-gcov-provisional",
  "nisar-gcov-beta",
  "opera-rtc-s1",
  "sentinel-1-rtc",
])

export const catalogueProducts = {
  "nisar-gcov": {
    name: "NISAR GCOV (validated)",
    provider: "asf",
    collectionId: "NISAR_L2_GCOV_V1_1",
    sourceMaturity: "validated",
    processingFamily: "NISAR-GCOV",
    dataAccess: "earthdata-login",
    documentationUrl: "https://nisar-docs.asf.alaska.edu/gcov",
  },
  "nisar-gcov-provisional": {
    name: "NISAR GCOV (provisional)",
    provider: "asf",
    collectionId: "NISAR_L2_GCOV_PROVISIONAL_V1_1",
    sourceMaturity: "provisional",
    processingFamily: "NISAR-GCOV",
    dataAccess: "earthdata-login",
    documentationUrl: "https://nisar-docs.asf.alaska.edu/gcov",
  },
  "nisar-gcov-beta": {
    name: "NISAR GCOV (beta)",
    provider: "asf",
    collectionId: "NISAR_L2_GCOV_BETA_V1_1",
    sourceMaturity: "beta",
    processingFamily: "NISAR-GCOV",
    dataAccess: "earthdata-login",
    documentationUrl: "https://nisar-docs.asf.alaska.edu/gcov",
  },
  "opera-rtc-s1": {
    name: "OPERA Sentinel-1 RTC",
    provider: "asf",
    collectionId: "OPERA_L2_RTC-S1_V1_1",
    sourceMaturity: "validated",
    processingFamily: "OPERA-RTC-S1",
    dataAccess: "earthdata-login",
    documentationUrl: "https://hyp3-docs.asf.alaska.edu/guides/opera_rtc_product_guide/",
  },
  "sentinel-1-rtc": {
    name: "Microsoft Sentinel-1 RTC",
    provider: "planetary-computer",
    collectionId: "sentinel-1-rtc",
    sourceMaturity: "not-specified",
    processingFamily: "CATALYST-RTC-S1",
    dataAccess: "planetary-computer-account",
    documentationUrl: "https://planetarycomputer.microsoft.com/dataset/sentinel-1-rtc",
  },
} as const

const longitude = z.number().min(-180).max(180)
const latitude = z.number().min(-90).max(90)

export const catalogueBoundsSchema = z.tuple([longitude, latitude, longitude, latitude])
  .refine(([west, south, east, north]) => (
    south < north && west !== east && !(west === 180 && east === -180)
  ), "Expected a nonzero west,south,east,north bounding box")

export const catalogueQuerySchema = z.strictObject({
  product: catalogueProductIdSchema,
  bbox: catalogueBoundsSchema,
  start: z.iso.date(),
  end: z.iso.date(),
  limit: z.number().int().min(1).max(20).default(10),
  cursor: z.string().min(1).max(4096).regex(/^[A-Za-z0-9_-]+$/).optional(),
}).superRefine((query, ctx) => {
  const days = (Date.parse(query.end) - Date.parse(query.start)) / 86_400_000 + 1
  if (days < 1) {
    ctx.addIssue({ code: "custom", path: ["end"], message: "The end date must not precede the start date" })
  }
  if (query.cursor && query.bbox[0] > query.bbox[2]) {
    ctx.addIssue({ code: "custom", path: ["cursor"], message: "A continuation must use its returned longitude partition" })
  }
})

export type CatalogueProductId = z.infer<typeof catalogueProductIdSchema>
export type CatalogueBounds = z.infer<typeof catalogueBoundsSchema>
export type CatalogueQuery = z.infer<typeof catalogueQuerySchema>

const positionSchema = z.tuple([longitude, latitude]).rest(z.number())
const ringSchema = z.array(positionSchema).min(4).max(1024).refine((ring) => {
  const first = ring[0]
  const last = ring[ring.length - 1]
  return first.length === last.length && first.every((value, index) => value === last[index])
}, "A polygon ring must be closed")
const polygonSchema = z.array(ringSchema).min(1).max(64)

export const catalogueGeometrySchema = z.discriminatedUnion("type", [
  z.object({ type: z.literal("Polygon"), coordinates: polygonSchema }),
  z.object({ type: z.literal("MultiPolygon"), coordinates: z.array(polygonSchema).min(1).max(64) }),
])

const httpsUrlSchema = z.string().url().refine((value) => {
  const url = new URL(value)
  return url.protocol === "https:" && !url.username && !url.password
}, "Expected an HTTPS URL without credentials")
const utcSchema = z.iso.datetime()
const maturitySchema = z.enum(["validated", "provisional", "beta", "not-specified"])

export const catalogueItemSchema = z.object({
  id: z.string().min(1).max(512),
  collectionId: z.string(),
  provider: z.enum(["asf", "planetary-computer"]),
  sourceMaturity: maturitySchema,
  processingFamily: z.string(),
  acquiredAt: utcSchema,
  startAt: utcSchema.nullable(),
  endAt: utcSchema.nullable(),
  bbox: catalogueBoundsSchema,
  geometry: catalogueGeometrySchema.nullable(),
  platform: z.string().nullable(),
  relativeOrbit: z.number().int().positive().nullable(),
  absoluteOrbit: z.number().int().positive().nullable(),
  orbitDirection: z.enum(["ascending", "descending"]).nullable(),
  polarizations: z.array(z.string()),
  sourceUrl: httpsUrlSchema,
  assets: z.array(z.object({
    key: z.string(),
    href: httpsUrlSchema,
    roles: z.array(z.string()),
    mediaType: z.string().nullable(),
    sizeBytes: z.number().int().nonnegative().nullable(),
    access: z.enum(["public", "earthdata-login", "planetary-computer-account"]),
  })).max(128),
})

export const catalogueSearchResultSchema = z.object({
  query: catalogueQuerySchema,
  provider: z.enum(["asf", "planetary-computer"]),
  fetchedAt: utcSchema,
  metadataOnly: z.literal(true),
  items: z.array(catalogueItemSchema).max(40),
  next: z.array(z.object({
    bbox: catalogueBoundsSchema,
    cursor: z.string().min(1).max(4096),
  })).max(2),
  hasMore: z.boolean(),
})

export type CatalogueItem = z.infer<typeof catalogueItemSchema>
export type CatalogueSearchResult = z.infer<typeof catalogueSearchResultSchema>
