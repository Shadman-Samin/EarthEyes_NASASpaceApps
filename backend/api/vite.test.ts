import { afterAll, beforeAll, expect, test } from "vitest"
import { createServer, type ViteDevServer } from "vite"

let server: ViteDevServer
let baseUrl: string

beforeAll(async () => {
  server = await createServer({ server: { host: "127.0.0.1", port: 0 }, optimizeDeps: { noDiscovery: true, include: [] }, logLevel: "silent" })
  await server.listen()
  baseUrl = server.resolvedUrls!.local[0]
}, 30_000)

afterAll(async () => { await server?.close() })

test("npm run dev serves the real catalogue API without a second server", async () => {
  const health = await fetch(`${baseUrl}api/health`)
  expect(health.headers.get("content-type")).toContain("application/json")
  expect(await health.json()).toEqual({ service: "eartheyes-catalogue", capabilities: { catalogue: true, processing: false } })
  const invalid = await fetch(`${baseUrl}api/catalog/search?product=made-up`)
  expect(invalid.status).toBe(400)
  expect(await invalid.json()).toMatchObject({ error: { code: "invalid_query" } })
  const frontend = await fetch(baseUrl)
  expect(frontend.headers.get("content-type")).toContain("text/html")
})
