import assert from "node:assert/strict"
import process from "node:process"

const { fetch, URL, URLSearchParams, AbortSignal, console } = globalThis
const base = new URL(process.argv[2] ?? "http://127.0.0.1:8787")

async function getJson(path) {
  const response = await fetch(new URL(path, base), { signal: AbortSignal.timeout(35_000) })
  const text = await response.text()
  assert.equal(response.status, 200, `${path}: HTTP ${response.status}: ${text}`)
  return JSON.parse(text)
}

const health = await getJson("/api/health")
assert.equal(health.capabilities.catalogue, true)
assert.equal(health.capabilities.processing, false)

const cases = [
  { name: "Bangladesh", product: "opera-rtc-s1", bbox: "90.1,21.8,90.3,21.95", start: "2024-05-01", end: "2024-05-31" },
  { name: "Greenland", product: "opera-rtc-s1", bbox: "-51.2,68.9,-50.7,69.3", start: "2024-05-01", end: "2024-05-31" },
  { name: "Amazon", product: "opera-rtc-s1", bbox: "-60.1,-3.2,-59.8,-2.9", start: "2024-05-01", end: "2024-05-31" },
  { name: "Antimeridian", product: "opera-rtc-s1", bbox: "179,-20,-179,-16", start: "2024-05-01", end: "2024-05-31" },
  { name: "NISAR validated", product: "nisar-gcov", bbox: "90.1,21.8,90.3,21.95", start: "2026-10-21", end: "2026-11-10" },
  { name: "Microsoft historical", product: "sentinel-1-rtc", bbox: "90.1,21.8,90.3,21.95", start: "2015-01-01", end: "2015-12-31" },
]

for (const { name, ...query } of cases) {
  const params = new URLSearchParams({ ...query, limit: "1" })
  const result = await getJson(`/api/catalog/search?${params}`)
  assert.equal(result.metadataOnly, true, name)
  assert.equal(result.query.product, query.product, name)
  assert.ok(result.items.length > 0 && result.items.length <= 2, `${name}: expected known archive coverage`)
  assert.equal(result.hasMore, result.next.length > 0, name)
  assert.ok(result.items.every((item) => item.sourceUrl.startsWith("https://") && item.acquiredAt.endsWith("Z")), name)
  for (const item of result.items) {
    for (const asset of item.assets) {
      const url = new URL(asset.href)
      assert.equal(url.protocol, "https:", name)
      assert.equal(url.username + url.password, "", name)
      assert.ok(![...url.searchParams.keys()].some((key) => /^(sig|signature|awsaccesskeyid|access_token|x-amz-.+)$/i.test(key)), name)
    }
  }
  console.log(`${name}: ${result.items.length} item(s), ${result.next.length} continuation(s), metadata only`)

  if (name === "Antimeridian") {
    for (const next of result.next) {
      const page = await getJson(`/api/catalog/search?${new URLSearchParams({
        ...query, bbox: next.bbox.join(","), limit: "1", cursor: next.cursor,
      })}`)
      assert.equal(page.metadataOnly, true)
      assert.deepEqual(page.query.bbox, next.bbox)
      console.log(`  Continuation ${next.bbox.join(",")}: ${page.items.length} item(s)`)
    }
  }
}

console.log("Live catalogue smoke checks passed. No asset or authentication endpoints were requested by this script.")
