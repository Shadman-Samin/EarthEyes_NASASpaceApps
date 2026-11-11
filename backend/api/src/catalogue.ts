import { z } from "zod"
import {
  catalogueBoundsSchema,
  catalogueGeometrySchema,
  catalogueProducts,
  catalogueQuerySchema,
  catalogueSearchResultSchema,
  type CatalogueBounds,
  type CatalogueItem,
  type CatalogueQuery,
  type CatalogueSearchResult,
} from "../../../src/domain/catalogue.ts"

const endpoints = {
  asf: "https://cmr.earthdata.nasa.gov/stac/ASF/search",
  "planetary-computer": "https://planetarycomputer.microsoft.com/api/stac/v1/search",
}
const maxMetadataBytes = 2 * 1024 * 1024
const timestampSchema = z.iso.datetime({ offset: true })
const linkSchema = z.object({ rel: z.string(), href: z.string().max(16384), method: z.string().optional() })
const providerItemSchema = z.object({
  type: z.literal("Feature"),
  id: z.string().min(1).max(512),
  collection: z.string(),
  bbox: catalogueBoundsSchema,
  geometry: catalogueGeometrySchema.nullable(),
  properties: z.object({
    datetime: z.string().nullable(),
    start_datetime: z.string().nullable().optional(),
    end_datetime: z.string().nullable().optional(),
    platform: z.string().nullable().optional(),
    "sat:relative_orbit": z.number().int().positive().nullable().optional(),
    "sat:absolute_orbit": z.number().int().positive().nullable().optional(),
    "sat:orbit_state": z.enum(["ascending", "descending"]).nullable().optional(),
    "sar:polarizations": z.array(z.string().max(16)).max(16).optional(),
  }),
  assets: z.record(z.string().max(2048), z.object({
    href: z.string().max(16384),
    type: z.string().optional(),
    roles: z.array(z.string()).max(16).default([]),
    "file:size": z.number().int().nonnegative().nullable().optional(),
  })),
})
const providerPageSchema = z.object({
  type: z.literal("FeatureCollection"),
  features: z.array(providerItemSchema).max(20),
  links: z.array(linkSchema).max(128).default([]),
})
const cursorSchema = z.strictObject({
  key: z.string().max(1024),
  token: z.string().min(1).max(2048),
})

export class CatalogueError extends Error {
  constructor(
    readonly code: string,
    readonly status: number,
    message: string,
    readonly retryAfter?: string,
  ) {
    super(message)
    this.name = "CatalogueError"
  }
}

function invalidResponse() {
  return new CatalogueError("invalid_provider_response", 502, "The provider returned unsupported or invalid catalogue metadata")
}

function searchKey(query: CatalogueQuery) {
  return JSON.stringify([query.product, query.bbox, query.start, query.end, query.limit])
}

function searchUrl(query: CatalogueQuery) {
  const product = catalogueProducts[query.product]
  const url = new URL(endpoints[product.provider])
  url.search = new URLSearchParams({
    collections: product.collectionId,
    bbox: query.bbox.join(","),
    datetime: `${query.start}T00:00:00.000Z/${query.end}T23:59:59.999Z`,
    limit: String(query.limit),
  }).toString()

  if (query.cursor) {
    try {
      const bytes = Uint8Array.from(atob(query.cursor.replace(/-/g, "+").replace(/_/g, "/")), (char) => char.charCodeAt(0))
      const cursor = cursorSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
      if (cursor.key !== searchKey(query)) throw new Error("Mismatched search")
      url.searchParams.set(product.provider === "asf" ? "cursor" : "token", cursor.token)
    } catch {
      throw new CatalogueError("invalid_cursor", 400, "This continuation is invalid or belongs to a different search")
    }
  }
  return url
}

function continuation(query: CatalogueQuery, url: URL, links: z.infer<typeof linkSchema>[]) {
  const nextLinks = links.filter((link) => link.rel === "next")
  if (nextLinks.length === 0) return []
  if (nextLinks.length > 1) throw invalidResponse()
  const link = nextLinks[0]
  const next = new URL(link.href)
  if (next.origin !== url.origin || next.pathname !== url.pathname || next.username || next.password || (link.method && link.method !== "GET")) {
    throw invalidResponse()
  }
  for (const key of ["collections", "bbox", "datetime", "limit"]) {
    if (next.searchParams.get(key) !== url.searchParams.get(key)) throw invalidResponse()
  }
  const tokenKey = catalogueProducts[query.product].provider === "asf" ? "cursor" : "token"
  const token = next.searchParams.get(tokenKey)
  if (!token || token === url.searchParams.get(tokenKey)) throw invalidResponse()
  const payload = cursorSchema.parse({ key: searchKey(query), token })
  const encoded = btoa(String.fromCharCode(...new TextEncoder().encode(JSON.stringify(payload))))
    .replace(/\+/g, "-").replace(/\//g, "_").replace(/=+$/, "")
  if (encoded.length > 4096) throw invalidResponse()
  return [{ bbox: query.bbox, cursor: encoded }]
}

function utc(value: string) {
  const normalized = value.replace(/^(\d{4}-\d{2}-\d{2}) /, "$1T")
  timestampSchema.parse(normalized)
  return new Date(normalized).toISOString()
}

function unsignedHttps(value: string) {
  try {
    const url = new URL(value)
    if (url.protocol !== "https:" || url.username || url.password) return null
    // Public manifests must not retain temporary SAS, AWS, or bearer credentials.
    for (const key of [...url.searchParams.keys()]) {
      if (/^(sig|signature|awsaccesskeyid|googleaccessid|expires|se|sp|sv|st|spr|sr|srt|ss|skoid|sktid|skt|ske|sks|skv|ses|token|access_token|api_key|authorization|x-amz-.+|x-goog-.+)$/i.test(key)) {
        url.searchParams.delete(key)
      }
    }
    url.hash = ""
    return url.href
  } catch {
    return null
  }
}

function normalizeItem(item: z.infer<typeof providerItemSchema>, query: CatalogueQuery): CatalogueItem {
  const product = catalogueProducts[query.product]
  if (item.collection !== product.collectionId) throw invalidResponse()
  const props = item.properties
  const acquiredAt = props.datetime ?? props.start_datetime
  if (!acquiredAt) throw invalidResponse()
  const startAt = props.start_datetime == null ? null : utc(props.start_datetime)
  const endAt = props.end_datetime == null ? null : utc(props.end_datetime)
  if (startAt && endAt && startAt > endAt) throw invalidResponse()
  const assets: CatalogueItem["assets"] = []
  for (const [key, asset] of Object.entries(item.assets)) {
    const href = unsignedHttps(asset.href)
    if (!href) continue
    assets.push({
      key, href, roles: asset.roles, mediaType: asset.type ?? null,
      sizeBytes: asset["file:size"] ?? null,
      access: asset.roles.includes("data") ? product.dataAccess : "public",
    })
  }

  return {
    id: item.id,
    collectionId: item.collection,
    provider: product.provider,
    sourceMaturity: product.sourceMaturity,
    processingFamily: product.processingFamily,
    acquiredAt: utc(acquiredAt), startAt, endAt,
    bbox: item.bbox, geometry: item.geometry,
    platform: props.platform ?? null,
    relativeOrbit: props["sat:relative_orbit"] ?? null,
    absoluteOrbit: props["sat:absolute_orbit"] ?? null,
    orbitDirection: props["sat:orbit_state"] ?? null,
    polarizations: props["sar:polarizations"] ?? [],
    sourceUrl: `${endpoints[product.provider].replace(/\/search$/, "")}/collections/${encodeURIComponent(item.collection)}/items/${encodeURIComponent(item.id)}`,
    assets,
  }
}

async function providerPage(url: URL, requestSignal?: AbortSignal) {
  const deadline = new AbortController()
  const signal = requestSignal ? AbortSignal.any([requestSignal, deadline.signal]) : deadline.signal
  const timer = setTimeout(() => deadline.abort(), 15_000)
  let response: Response | undefined
  let reader: ReadableStreamDefaultReader<Uint8Array> | undefined
  const cancel = () => { void reader?.cancel().catch(() => undefined) }

  try {
    signal.throwIfAborted()
    response = await fetch(url, { headers: { Accept: "application/geo+json, application/json" }, redirect: "manual", signal })
    if (response.status === 429) {
      const retry = response.headers.get("Retry-After") ?? "30"
      const retryAfter = /^\d+$/.test(retry) ? String(Math.min(3600, Math.max(1, Number(retry)))) : "30"
      throw new CatalogueError("provider_rate_limited", 429, "The catalogue provider is rate limiting requests", retryAfter)
    }
    if (!response.ok) throw new CatalogueError("provider_unavailable", 503, "The catalogue provider is temporarily unavailable")
    const mediaType = response.headers.get("Content-Type")?.split(";")[0].trim().toLowerCase()
    if (mediaType !== "application/json" && mediaType !== "application/geo+json") throw invalidResponse()
    if (Number(response.headers.get("Content-Length")) > maxMetadataBytes) {
      throw new CatalogueError("metadata_too_large", 502, "The provider metadata exceeds the response budget; narrow the query")
    }
    if (!response.body) throw invalidResponse()
    reader = response.body.getReader()
    signal.addEventListener("abort", cancel, { once: true })
    const chunks: Uint8Array[] = []
    let size = 0
    while (true) {
      signal.throwIfAborted()
      const { done, value } = await reader.read()
      signal.throwIfAborted()
      if (done) break
      size += value.byteLength
      if (size > maxMetadataBytes) throw new CatalogueError("metadata_too_large", 502, "The provider metadata exceeds the response budget; narrow the query")
      chunks.push(value)
    }
    const bytes = new Uint8Array(size)
    let offset = 0
    for (const chunk of chunks) {
      bytes.set(chunk, offset)
      offset += chunk.byteLength
    }
    try {
      return providerPageSchema.parse(JSON.parse(new TextDecoder("utf-8", { fatal: true }).decode(bytes)))
    } catch {
      throw invalidResponse()
    }
  } catch (error) {
    if (requestSignal?.aborted) throw new CatalogueError("request_cancelled", 499, "The catalogue request was cancelled")
    if (deadline.signal.aborted) throw new CatalogueError("provider_timeout", 504, "The catalogue provider did not respond within the deadline")
    if (error instanceof CatalogueError) throw error
    throw new CatalogueError("provider_unavailable", 503, "The catalogue provider could not be reached")
  } finally {
    clearTimeout(timer)
    signal.removeEventListener("abort", cancel)
    deadline.abort()
    // Cleanup must not extend the deadline if a stream's cancellation never settles.
    if (reader) {
      void reader.cancel().catch(() => undefined)
      reader.releaseLock()
    } else {
      void response?.body?.cancel().catch(() => undefined)
    }
  }
}

export async function searchCatalogue(input: CatalogueQuery, signal?: AbortSignal): Promise<CatalogueSearchResult> {
  const query = catalogueQuerySchema.parse(input)
  if (signal?.aborted) throw new CatalogueError("request_cancelled", 499, "The catalogue request was cancelled")
  const [west, south, east, north] = query.bbox
  // CMR rejects wrapped boxes, so each hemisphere has its own bounded continuation.
  const partitions: CatalogueBounds[] = west > east
    ? ([[west, south, 180, north], [-180, south, east, north]] as CatalogueBounds[]).filter((bbox) => bbox[0] < bbox[2])
    : [query.bbox]
  const pages = await Promise.all(partitions.map(async (bbox) => {
    const part = { ...query, bbox }
    const url = searchUrl(part)
    const page = await providerPage(url, signal)
    try {
      if (page.features.length > query.limit) throw invalidResponse()
      return {
        items: page.features.map((item) => normalizeItem(item, part)),
        next: continuation(part, url, page.links),
      }
    } catch (error) {
      if (error instanceof CatalogueError) throw error
      throw invalidResponse()
    }
  }))
  const unique = new Map<string, CatalogueItem>()
  for (const page of pages) {
    for (const item of page.items) unique.set(`${item.provider}:${item.collectionId}:${item.id}`, item)
  }
  const next = pages.flatMap((page) => page.next)
  try {
    return catalogueSearchResultSchema.parse({
      query,
      provider: catalogueProducts[query.product].provider,
      fetchedAt: new Date().toISOString(),
      metadataOnly: true,
      items: [...unique.values()],
      next,
      hasMore: next.length > 0,
    })
  } catch {
    throw invalidResponse()
  }
}
