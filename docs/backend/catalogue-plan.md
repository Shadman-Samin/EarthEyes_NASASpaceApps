# Worldwide Catalogue Implementation Plan

> **For agentic workers:** Use `executing-plans` to implement this module task by
> task. The user requested inline implementation and approved live discovery with
> queued analysis. Do not substitute a curated-place implementation.

**Goal:** Deliver a tested, deployable worldwide metadata API without downloading
satellite files or claiming that scientific processing is already implemented.

**Architecture:** A Cloudflare Worker queries fixed NASA and Microsoft STAC
endpoints. Shared Zod contracts validate input and normalized output. Cache
successful bounded pages; leave persistent indexing and processing to the next
module rather than adding empty infrastructure.

**Tech Stack:** TypeScript, existing Zod/Vitest, Web Fetch APIs, Wrangler 4.160.0,
Node.js 22.12 or newer for Wrangler.

**Spec:** `docs/backend/worldwide-design.md`

## Global Constraints

- Any valid worldwide WGS84 bounding box; no place whitelist.
- At most 366 calendar days, 20 results per longitude partition, two partitions.
- At most 2 MiB of decoded metadata per provider response and a 15-second deadline.
- No raster downloads, access-token requests, imaginary measurements, or fake jobs.
- Preserve unrelated work and the newer landing design; work on `development`.
- Cloud account creation, credentials, and public deployment require authorization.

## Review Focus

- Dateline searches must not omit a hemisphere or hide a failed partition (Task 3).
- Missing NASA orbit/polarization data must stay unknown, not imply compatibility (Task 3).
- Microsoft offset timestamps and invalid calendar dates must be handled correctly (Tasks 2-3).
- Hostile cursors/URLs and oversized or stalled bodies must not bypass limits (Tasks 3-4).
- A cache hit must not leak another origin's CORS headers or acquire a new timestamp (Task 4).

## Task 1: Repair The Reproduced Baseline Failure

**Files:** `src/routes/landing/LandingPage.tsx`,
`src/routes/landing/LandingPage.test.tsx`.

- [x] Strengthen the existing landing test to require one main heading and one
  primary explorer action. Run `npx vitest run src/routes/landing/LandingPage.test.tsx`;
  confirm the known JSX parse failure.
- [x] Self-close the `br` and remove the duplicated older hero fragment, leaving
  the newer header/hero intact.
- [x] Run the focused test, `npm test`, `npm run typecheck`, and `npm run lint`.

Regression assertion:

```tsx
expect(screen.getAllByRole("heading", { level: 1 })).toHaveLength(1)
expect(screen.getByRole("link", { name: /open the explorer/i })).toBeInTheDocument()
```

## Task 2: Define The Catalogue Contract

**Files:** `src/domain/catalogue.ts`, `backend/api/src/query.ts`,
`backend/api/src/query.test.ts`, `vitest.config.ts`, `tsconfig.json`.

**Consumes:** URL query parameters.

**Produces:** `catalogueProducts`, `CatalogueQuery`, `CatalogueItem`,
`CatalogueSearchResult`, `catalogueSearchResultSchema`, and
`parseCatalogueQuery(params: URLSearchParams): CatalogueQuery`.

- [x] Add a Node-environment backend project to Vitest without changing the
  frontend test environment or MSW setup.
- [x] Write failing tests for valid worldwide boxes, wrapped boxes, poles,
  impossible dates, excessive date spans, excessive limits, repeated/unknown
  parameters, and invalid coordinates.
- [x] Implement the shared contract and parser; normalize equivalent numeric
  coordinates and default the page size to 10.
- [x] Run `npx vitest run --project backend` and TypeScript checks.

Representative contract test:

```ts
const query = parseCatalogueQuery(new URLSearchParams({
  product: "opera-rtc-s1", bbox: "179,-20,-179,-16",
  start: "2024-05-01", end: "2024-05-31",
}))
expect(query.bbox).toEqual([179, -20, -179, -16])
expect(query.limit).toBe(10)
```

## Task 3: Implement Bounded Provider Search

**Files:** `backend/api/src/catalogue.ts`, `backend/api/src/catalogue.test.ts`.

**Consumes:** `CatalogueQuery`, standard `fetch`, optional cancellation signal.

**Produces:** `searchCatalogue(query: CatalogueQuery, signal?: AbortSignal):
Promise<CatalogueSearchResult>` and typed `CatalogueError` failures.

- [x] Write tests using provider-shaped STAC responses for NASA NISAR, OPERA
  HH/HV products, and Microsoft RTC. Intercept only the external HTTP boundary.
- [x] Verify failures before adding production code.
- [x] Fetch only fixed STAC search endpoints with redirects disabled. Apply the
  deadline to headers and body and enforce the metadata byte limit while reading.
- [x] Normalize real timestamps, geometry, optional SAR metadata, HTTPS asset
  references, and source links. Remove transient signing credentials from URLs.
- [x] Split wrapped bounding boxes, deduplicate the combined response, and return
  independently resumable continuation entries bound to their normalized query.
- [x] Test malicious next links, changed filters with old cursors, empty pages,
  duplicate items, invalid records, provider 429/5xx, oversized streams, stalled
  bodies, cancellation, and a failure of one dateline partition.

Independent timestamp expectation:

```ts
expect(result.items[0].acquiredAt).toBe("2024-05-31T06:40:46.572Z")
expect(result.metadataOnly).toBe(true)
```

## Task 4: Serve And Package The Worker

**Files:** `backend/api/src/index.ts`, `backend/api/src/index.test.ts`,
`backend/api/wrangler.jsonc`, `package.json`, `.gitignore`.

**Consumes:** standard HTTP `Request`, allowed-origin environment configuration,
and platform cache/execution context.

**Produces:** Worker default export with `fetch`, the health/collections/search
routes, explicit JSON errors, and local/deployment scripts.

- [x] Write failing route tests for invalid requests, supported methods, CORS,
  provider failures, and cache isolation/freshness.
- [x] Implement only the three specified read routes. Handle OPTIONS explicitly;
  never reflect an unapproved origin or cache errors.
- [x] Add pinned Wrangler tooling and ignore its generated state plus local
  environment/credential files. Do not commit existing session exports.
- [x] Add `dev:api`, `check:api`, and `deploy:api` scripts. The deploy script is
  available to the owner but must not be invoked without account authorization.
- [x] Run all tests, lint, TypeScript, and a Wrangler dry-run build.

Basic route test:

```ts
const response = await worker.fetch(new Request("https://api.test/api/health"), {})
expect(response.status).toBe(200)
expect((await response.json()).capabilities.processing).toBe(false)
```

## Task 5: Live Checks And Handoff

**Files:** `backend/api/smoke.mjs`, `backend/api/README.md`, `README.md`.

- [x] Add a metadata-only HTTP smoke script using Node's built-in fetch/assert.
- [x] Start the actual local Worker and query Bangladesh, Greenland, the Amazon,
  the dateline, validated NISAR, and Microsoft historical metadata.
- [x] Run `npm test`, `npm run typecheck`, `npm run lint`, `npm run build`, and
  `npm run check:api`. Inspect the final diff for unintended changes.
- [x] Document example queries, continuation semantics, source access constraints,
  cache behavior, production abuse-control prerequisites, and the fact that the
  current frontend and queued processing are not connected by this module.
- [x] Request an independent focused review, fix findings, and rerun affected checks.
- [x] Update these checkboxes only after verification; report actual results and
  any remaining blockers. Leave account credentials out of chat and repository.

## Execution Record

- Task 1: JSX failure reproduced before repair. The preserved hero also needed a
  space around its line break for a correct accessible name; the existing heading
  assertion caught this. All 11 original tests, lint, and TypeScript then passed.
- Ruling: use this plan's checked steps as the durable progress record instead of
  Unix-only task scripts in the Windows harness. No per-task commits or changes to
  unrelated uncommitted files are needed for the module's verification.
- Ruling: output schemas are implemented with Task 3's provider tests, their first
  consumer, rather than creating unused output definitions during Task 2.
- Tasks 2-4: input, provider, and route tests were run failing before their
  implementations. The first implementation passed 93 tests plus lint, TypeScript,
  and a Worker dry-run build.
- Final review: a fresh reviewer identified legacy signed-URL leakage, potentially
  unbounded cancellation cleanup, and empty optional timestamps. Six new regression
  cases failed before fixes, including browser access to Retry-After. All passed
  after redaction, nonblocking cleanup, strict timestamps, and exposed retry hints.
- Ruling: expose Retry-After as an important browser API behavior rather than defer
  it as polish; otherwise a cross-origin client cannot honor provider backoff.
- Live runtime check: Cloudflare rejected Fetch's `redirect: error` mode, although
  Node tests accepted it. Changed to `manual` with non-2xx rejection; added a redirect
  regression and removed temporary diagnostics. No redirect is followed.
- Live smoke: Bangladesh, Greenland, Amazon, both antimeridian partitions and their
  continuations, validated NISAR, and Microsoft 2015 metadata passed through the
  actual local Worker. No raster assets or access tokens were fetched.
- Final suite after the runtime fix: 100 tests passed across seven files.
- Added development/PR CI for the same offline checks. CI execution on GitHub and
  deployment to a Cloudflare account remain unperformed external actions.
- Final verification on November 11, 2026: all 100 tests, lint, TypeScript, frontend
  production build, Worker dry-run build, and the complete live HTTP smoke script
  passed. The frontend build retains its existing large-chunk warning. Git diff
  checks found no whitespace errors; Windows line-ending warnings remain.
- Module 1 is implemented and verified locally. The Worker is running on
  `http://127.0.0.1:8787`. Work is uncommitted on `development`; no push, cloud
  deployment, Earthdata credential configuration, or processing job was performed.
- Next module: persistent worldwide analysis requests, admission limits and real
  queue orchestration, followed by metered raster subset processing and UI wiring.
