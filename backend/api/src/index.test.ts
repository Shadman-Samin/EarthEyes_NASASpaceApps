import { afterEach, describe, expect, it, vi } from "vitest"
import worker from "./index"

const searchUrl = "https://api.test/api/catalog/search?product=opera-rtc-s1&bbox=-51.2,68.9,-50.7,69.3&start=2024-05-01&end=2024-05-31"
const environment = { ALLOWED_ORIGINS: "https://atlas.test,https://other-atlas.test" }

function upstream() {
  const fetch = vi.fn(async () => Response.json({ type: "FeatureCollection", features: [], links: [] }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

function installCache() {
  const values = new Map<string, Response>()
  const cache = {
    match: vi.fn(async (request: Request) => values.get(request.url)?.clone()),
    put: vi.fn(async (request: Request, response: Response) => { values.set(request.url, response.clone()) }),
  }
  vi.stubGlobal("caches", { default: cache })
  return cache
}

afterEach(() => {
  vi.unstubAllGlobals()
  vi.useRealTimers()
})

describe("catalogue HTTP boundary", () => {
  it("reports implemented capabilities without pretending processing is available", async () => {
    const fetch = upstream()
    const response = await worker.fetch(new Request("https://api.test/api/health"), {})
    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({
      service: "eartheyes-catalogue", capabilities: { catalogue: true, processing: false },
    })
    expect(fetch).not.toHaveBeenCalled()
  })

  it("publishes product identities and authentication requirements without requesting tokens", async () => {
    const fetch = upstream()
    const response = await worker.fetch(new Request("https://api.test/api/catalog/collections"), {})
    const products = await response.json() as Array<{ id: string; dataAccess: string }>
    expect(products.find((product) => product.id === "nisar-gcov")?.dataAccess).toBe("earthdata-login")
    expect(products.find((product) => product.id === "sentinel-1-rtc")?.dataAccess).toBe("planetary-computer-account")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("serves live metadata using the real provider adapter", async () => {
    const fetch = upstream()
    const response = await worker.fetch(new Request(searchUrl), {})
    expect(response.status).toBe(200)
    expect(response.headers.get("Content-Type")).toContain("application/json")
    expect(response.headers.get("X-Content-Type-Options")).toBe("nosniff")
    expect(await response.json()).toMatchObject({ metadataOnly: true, items: [], hasMore: false })
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("rejects invalid inputs before any provider request", async () => {
    const fetch = upstream()
    const response = await worker.fetch(new Request(`${searchUrl}&unexpected=true`), {})
    expect(response.status).toBe(400)
    expect((await response.json()).error.code).toBe("invalid_query")
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("does not accept arbitrarily large URLs", async () => {
    const fetch = upstream()
    const response = await worker.fetch(new Request(`${searchUrl}&cursor=${"a".repeat(9000)}`), {})
    expect(response.status).toBe(414)
    expect(fetch).not.toHaveBeenCalled()
  })

  it.each(["POST", "PUT", "DELETE", "HEAD"])("rejects unsupported method %s", async (method) => {
    const fetch = upstream()
    const response = await worker.fetch(new Request(searchUrl, { method }), {})
    expect(response.status).toBe(405)
    expect(response.headers.get("Allow")).toContain("GET")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("does not route unknown endpoints into an upstream proxy", async () => {
    const fetch = upstream()
    const response = await worker.fetch(new Request("https://api.test/api/processing/jobs"), {})
    expect(response.status).toBe(404)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects an unapproved browser origin before doing work", async () => {
    const fetch = upstream()
    const response = await worker.fetch(new Request(searchUrl, { headers: { Origin: "https://untrusted.test" } }), environment)
    expect(response.status).toBe(403)
    expect(response.headers.has("Access-Control-Allow-Origin")).toBe(false)
    expect(fetch).not.toHaveBeenCalled()
  })

  it("allows an explicitly configured origin without enabling credential sharing", async () => {
    upstream()
    const response = await worker.fetch(new Request(searchUrl, { headers: { Origin: "https://atlas.test" } }), environment)
    expect(response.status).toBe(200)
    expect(response.headers.get("Access-Control-Allow-Origin")).toBe("https://atlas.test")
    expect(response.headers.get("Vary")).toBe("Origin")
    expect(response.headers.has("Access-Control-Allow-Credentials")).toBe(false)
  })

  it("permits the API's own origin without an extra cross-origin rule", async () => {
    upstream()
    const response = await worker.fetch(new Request(searchUrl, { headers: { Origin: "https://api.test" } }), {})
    expect(response.status).toBe(200)
  })

  it("handles a permitted read-only preflight without contacting providers", async () => {
    const fetch = upstream()
    const response = await worker.fetch(new Request(searchUrl, {
      method: "OPTIONS", headers: { Origin: "https://atlas.test", "Access-Control-Request-Method": "GET" },
    }), environment)
    expect(response.status).toBe(204)
    expect(response.headers.get("Access-Control-Allow-Methods")).toBe("GET, OPTIONS")
    expect(fetch).not.toHaveBeenCalled()
  })

  it("rejects preflights requesting unsupported methods or headers", async () => {
    upstream()
    const response = await worker.fetch(new Request(searchUrl, {
      method: "OPTIONS", headers: {
        Origin: "https://atlas.test", "Access-Control-Request-Method": "POST",
        "Access-Control-Request-Headers": "authorization",
      },
    }), environment)
    expect(response.status).toBe(405)
  })

  it("reuses metadata without leaking CORS headers or changing the fetch timestamp", async () => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date("2026-11-10T10:00:00Z"))
    const fetch = upstream()
    const cache = installCache()
    const first = await worker.fetch(new Request(searchUrl, { headers: { Origin: "https://atlas.test" } }), environment)
    const firstBody = await first.json()
    vi.setSystemTime(new Date("2026-11-10T10:01:00Z"))
    const second = await worker.fetch(new Request(searchUrl, { headers: { Origin: "https://other-atlas.test" } }), environment)
    expect(second.headers.get("Access-Control-Allow-Origin")).toBe("https://other-atlas.test")
    expect(second.headers.get("X-EarthEyes-Cache")).toBe("hit")
    expect(second.headers.get("Cache-Control")).toContain("max-age=300")
    expect((await second.json()).fetchedAt).toBe(firstBody.fetchedAt)
    expect(firstBody.fetchedAt).toBe("2026-11-10T10:00:00.000Z")
    expect(cache.put.mock.calls[0][1].headers.has("Access-Control-Allow-Origin")).toBe(false)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("normalizes equivalent numeric queries before looking up the cache", async () => {
    const fetch = upstream()
    installCache()
    await worker.fetch(new Request(searchUrl), {})
    const equivalent = searchUrl.replace("-51.2,68.9,-50.7,69.3", "-51.20,68.90,-50.70,69.30") + "&limit=10"
    const response = await worker.fetch(new Request(equivalent), {})
    expect(response.headers.get("X-EarthEyes-Cache")).toBe("hit")
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("does not cache a provider failure as empty coverage", async () => {
    const cache = installCache()
    vi.stubGlobal("fetch", vi.fn(async () => new Response("upstream internals", { status: 503 })))
    const response = await worker.fetch(new Request(searchUrl), {})
    expect(response.status).toBe(503)
    expect(response.headers.get("Cache-Control")).toBe("no-store")
    const body = await response.text()
    expect(body).toContain("provider_unavailable")
    expect(body).not.toContain("upstream internals")
    expect(cache.put).not.toHaveBeenCalled()
  })

  it("passes on provider rate limits with Retry-After", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "Retry-After": "45" } })))
    const response = await worker.fetch(new Request(searchUrl), {})
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("45")
  })

  it("lets allowed cross-origin clients read the provider's retry interval", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response(null, { status: 429, headers: { "Retry-After": "45" } })))
    const response = await worker.fetch(new Request(searchUrl, { headers: { Origin: "https://atlas.test" } }), environment)
    expect(response.status).toBe(429)
    expect(response.headers.get("Access-Control-Expose-Headers")?.toLowerCase().split(",").map((name) => name.trim()))
      .toContain("retry-after")
  })

  it("serves valid results if the optional cache is unavailable", async () => {
    upstream()
    vi.stubGlobal("caches", { default: {
      match: async () => { throw new Error("cache offline") },
      put: async () => { throw new Error("cache offline") },
    } })
    const response = await worker.fetch(new Request(searchUrl), {})
    expect(response.status).toBe(200)
    expect((await response.json()).metadataOnly).toBe(true)
  })
})
