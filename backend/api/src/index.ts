import { catalogueProducts } from "../../../src/domain/catalogue.js"
import { CatalogueError, searchCatalogue } from "./catalogue.js"
import { parseCatalogueQuery } from "./query.js"

type Environment = { ALLOWED_ORIGINS?: string }
type Context = { waitUntil(promise: Promise<unknown>): void }

function errorResponse(status: number, code: string, message: string, headers?: HeadersInit) {
  return Response.json({ error: { code, message } }, {
    status, headers: { "Cache-Control": "no-store", ...Object.fromEntries(new Headers(headers)) },
  })
}

function withCors(response: Response, origin: string | null) {
  const headers = new Headers(response.headers)
  headers.set("Vary", "Origin")
  headers.set("X-Content-Type-Options", "nosniff")
  headers.set("Access-Control-Expose-Headers", "Retry-After, X-EarthEyes-Cache")
  headers.delete("Access-Control-Allow-Credentials")
  if (origin) headers.set("Access-Control-Allow-Origin", origin)
  else headers.delete("Access-Control-Allow-Origin")
  return new Response(response.body, { status: response.status, headers })
}

export default {
  async fetch(request: Request, env: Environment = {}, ctx?: Context): Promise<Response> {
    const url = new URL(request.url)
    const origin = request.headers.get("Origin")
    const origins = (env.ALLOWED_ORIGINS ?? "").split(",").map((value) => value.trim()).filter(Boolean)
    if (origin && origin !== url.origin && !origins.includes(origin)) {
      return withCors(errorResponse(403, "origin_not_allowed", "This browser origin is not allowed"), null)
    }
    const send = (response: Response) => withCors(response, origin)
    if (request.url.length > 8192) return send(errorResponse(414, "query_too_long", "The request URL exceeds the supported length"))

    if (request.method === "OPTIONS") {
      const method = request.headers.get("Access-Control-Request-Method")
      const headers = (request.headers.get("Access-Control-Request-Headers") ?? "")
        .split(",").map((header) => header.trim().toLowerCase()).filter(Boolean)
      if (!origin || method !== "GET" || headers.some((header) => !["accept", "content-type"].includes(header))) {
        return send(errorResponse(405, "method_not_allowed", "Only read-only catalogue requests are supported", { Allow: "GET, OPTIONS" }))
      }
      return send(new Response(null, { status: 204, headers: {
        "Access-Control-Allow-Methods": "GET, OPTIONS",
        "Access-Control-Allow-Headers": "Accept, Content-Type",
        "Access-Control-Max-Age": "600",
        "Cache-Control": "no-store",
      } }))
    }
    if (request.method !== "GET") {
      return send(errorResponse(405, "method_not_allowed", "Only GET is supported", { Allow: "GET, OPTIONS" }))
    }
    if (url.pathname === "/api/health") {
      return send(Response.json({
        service: "eartheyes-catalogue", capabilities: { catalogue: true, processing: false },
      }, { headers: { "Cache-Control": "no-store" } }))
    }
    if (url.pathname === "/api/catalog/collections") {
      return send(Response.json(Object.entries(catalogueProducts).map(([id, product]) => ({ id, ...product })), {
        headers: { "Cache-Control": "public, max-age=300" },
      }))
    }
    if (url.pathname !== "/api/catalog/search") {
      return send(errorResponse(404, "not_found", "This API route does not exist"))
    }

    let query
    try {
      query = parseCatalogueQuery(url.searchParams)
    } catch {
      return send(errorResponse(400, "invalid_query", "Provide a supported product, valid bbox, calendar dates, and a page limit of 1 to 20"))
    }

    const canonical = new URL("/api/catalog/search", url.origin)
    canonical.search = new URLSearchParams({
      product: query.product, bbox: query.bbox.join(","), start: query.start,
      end: query.end, limit: String(query.limit), ...(query.cursor ? { cursor: query.cursor } : {}),
    }).toString()
    const key = new Request(canonical)
    const cache = typeof caches === "undefined" ? undefined : (caches as CacheStorage & { default?: Cache }).default
    try {
      const cached = await cache?.match(key).catch(() => undefined)
      if (cached) {
        const headers = new Headers(cached.headers)
        headers.set("X-EarthEyes-Cache", "hit")
        return send(new Response(cached.body, { status: cached.status, headers }))
      }
      const result = await searchCatalogue(query, request.signal)
      const response = Response.json(result, { headers: {
        "Cache-Control": "public, max-age=300",
        "X-EarthEyes-Cache": cache ? "miss" : "disabled",
      } })
      if (cache) {
        // Cache the origin-independent response; add browser-specific CORS afterward.
        const write = cache.put(key, response.clone()).catch(() => undefined)
        if (ctx) ctx.waitUntil(write)
        else await write
      }
      return send(response)
    } catch (error) {
      if (error instanceof CatalogueError) {
        return send(errorResponse(error.status, error.code, error.message, error.retryAfter ? { "Retry-After": error.retryAfter } : undefined))
      }
      return send(errorResponse(500, "internal_error", "The catalogue request could not be completed"))
    }
  },
}
