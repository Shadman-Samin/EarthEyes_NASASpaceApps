import { z } from "zod"
import { catalogueSearchResultSchema, type CatalogueItem, type CatalogueQuery } from "../domain/catalogue"

const errorSchema = z.object({ error: z.object({ message: z.string().max(1000) }) })

export const catalogueItemKey = (item: CatalogueItem) => JSON.stringify([item.provider, item.collectionId, item.id])

export async function fetchCatalogue(query: CatalogueQuery, signal: AbortSignal) {
  const base = (import.meta.env.VITE_CATALOGUE_API_BASE_URL as string | undefined)
    ?? `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/catalog`
  const params = new URLSearchParams({
    product: query.product, bbox: query.bbox.join(","), start: query.start,
    end: query.end, limit: String(query.limit), ...(query.cursor ? { cursor: query.cursor } : {}),
  })
  let response: Response
  try {
    response = await fetch(`${base.replace(/\/$/, "")}/search?${params}`, {
      signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]),
      credentials: "omit",
      headers: { Accept: "application/json" },
    })
  } catch (error) {
    if (signal.aborted) throw error
    throw new Error("The live catalogue could not be reached. Check your connection and try again. No demo data has been substituted.")
  }
  const value: unknown = await response.json().catch(() => null)
  if (!response.ok) {
    const failure = errorSchema.safeParse(value)
    const retryAfter = response.headers.get("Retry-After")
    throw new Error(`${failure.success ? failure.data.error.message : `Catalogue request failed (${response.status}).`}${retryAfter ? ` Retry after ${/^\d+$/.test(retryAfter) ? `${retryAfter} seconds` : retryAfter}.` : ""}`)
  }
  const result = catalogueSearchResultSchema.safeParse(value)
  if (!result.success) throw new Error("The catalogue service did not return valid metadata. A hosted site needs a configured catalogue API; no demo data has been substituted.")
  return result.data
}
