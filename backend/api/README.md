# Worldwide Catalogue API

Module 1 is a Cloudflare Worker for **live metadata discovery anywhere on Earth**.
It uses the existing NASA/ASF and Microsoft indexes rather than mirroring an archive.
There is no place whitelist. Satellite coverage is not guaranteed for every location,
date, or product.

This runtime does not download rasters, obtain access tokens, queue analysis, or
compute measurements. It can serve precomputed, checked exploratory bundles.
`/api/health` still reports `processing: false`.
The existing `/explore` frontend now consumes this API for live acquisitions and
public OPERA SAR browse images, with footprints and date comparison in its existing
workspace. There is no separate catalogue page. Do not point `VITE_API_BASE_URL` at
this partial API. Calibrated raster processing runs offline, not in this runtime.
See `../../docs/backend/worldwide-design.md`.

## Run And Verify

Requires Node.js 22.12 or newer. Run from the repository root:

`npm run dev` serves the UI and this API together through a local Vite adapter.
`npm run preview` uses the same adapter for local production-build checks.
The standalone Cloudflare runtime can still be tested with:

```sh
npm ci
npm run dev:api
```

The local Worker listens at `http://127.0.0.1:8787`. In another terminal:

```sh
npm run test:backend
npm run smoke:api
npm run check:api
```

`smoke:api` exercises real NASA and Microsoft metadata through the running Worker,
including multiple continents, NISAR, historical Sentinel-1, and antimeridian
continuations. It requires network access; it never requests the returned assets.
Use `npm run smoke:api -- https://your-worker.workers.dev` to check a deployed API.

`npm test` runs frontend and backend tests in separate environments. `check:api`
builds a deployable Worker without publishing or needing Earthdata credentials.
The `backend-checks.yml` workflow repeats these checks for `development` pushes
and pull requests. It does not publish, require cloud credentials, or call live
satellite providers. Live smoke tests are explicit, separate network checks.

## Routes

| Route | Purpose |
| --- | --- |
| `GET /api/health` | Implemented capabilities |
| `GET /api/catalog/collections` | Product IDs, source maturity and data access requirements |
| `GET /api/catalog/search` | One bounded page of live metadata per longitude partition |
| `GET /api/analysis` | Exact-scope precomputed bundle or explicit `analysis_unavailable` |
| `POST /api/argus` | Server-grounded study answers, or optional Groq-backed browse answers |

Example request:

```text
http://127.0.0.1:8787/api/catalog/search?product=opera-rtc-s1&bbox=-51.2,68.9,-50.7,69.3&start=2024-05-01&end=2024-05-31&limit=10
```

| Parameter | Contract |
| --- | --- |
| `product` | `nisar-gcov`, `nisar-gcov-provisional`, `nisar-gcov-beta`, `opera-rtc-s1`, or `sentinel-1-rtc` |
| `bbox` | `west,south,east,north`; longitudes [-180,180], latitudes [-90,90], nonzero area |
| `start`, `end` | Real `YYYY-MM-DD` dates, inclusive, at most 366 days |
| `limit` | Optional integer 1-20 per partition; defaults to 10 |
| `cursor` | An opaque continuation returned by this API; reuse the same filters and page size |

Unknown and repeated parameters are rejected. `west > east` means a dateline
crossing, not a coordinate-order error. Such a request is split into at most two
provider searches and returns at most twice `limit` items. Empty longitude
partitions at exactly 180 degrees are omitted.

## Response And Continuation

The response contains `query`, `provider`, `fetchedAt`, `metadataOnly`, `items`,
`next`, and `hasMore`. Each item includes its actual collection/item identity,
footprint, UTC acquisition timestamps, source maturity, processing family, source
metadata URL, and unsigned HTTPS asset references. SAR properties absent from the
provider remain null or empty; they do not imply compatible acquisitions.

`next` is an array of `{ bbox, cursor }` entries. To continue, replace the request's
`bbox` and `cursor` with that entry and retain `product`, `start`, `end`, and `limit`.
A dateline search can have two independently resumable entries. Merge pages by
`provider + collectionId + id`; a granule can intersect both longitude partitions.
Pages are not a globally sorted time series and do not represent a global count.

An empty successful page is different from an error. If either dateline partition
fails, the whole request fails instead of implying complete coverage.

## Limits And Errors

- A search makes at most two upstream metadata requests, with no automatic retries
  or background archive crawl.
- Each provider response is limited to 2 MiB of decoded metadata and a 15-second
  deadline, including body reading. Cleanup does not extend that deadline.
- Continuations cannot redirect requests to different hosts, paths, or filters.
- Successful results may be cached for five minutes. `fetchedAt` remains the
  original retrieval time; `X-EarthEyes-Cache` reports hit, miss, or disabled.
- Errors are never cached. JSON errors expose `error.code` and `error.message`.
- Statuses include 400 invalid input/cursor, 403 disallowed browser origin, 414 long
  URL, 429 provider rate limit, 499 cancellation, 502 invalid/oversized provider
  metadata, 503 unavailable provider, and 504 provider timeout.
- Allowed browser clients can read `Retry-After` and `X-EarthEyes-Cache`.

## Argus AI Proxy

For a published study, send `analysisQuery: { bbox, start, end, product, polarization? }`
alongside `mode: "chat"`, `question` and `facts: {}`. The server resolves its own
versioned index and returns `{ text, source: "data", cached: false }` from deterministic
templates. No Groq key or model call is needed, and client numerical claims are ignored.
Preview-image summaries cannot be used to replace a published study.

`POST /api/argus` keeps the Groq key server-side. The browser sends a bounded JSON
body: `mode` (`chat` or `summary`), `question` (at most 600 characters), up to eight
`history` turns, `facts` (at most 12 KB), and at most two base64 data-URL `images`
(at most 500 KB each). Unknown fields are rejected.

- `GROQ_API_KEY` is required for the optional model path; without it that path returns 503 `ai_unavailable`.
- `ARGUS_MODEL` defaults to `qwen/qwen3.8-27b`. `ARGUS_VISION_MODEL` is required for
  `mode: "summary"` with images and must accept image input.
- Responses are `{ text, cached }`. Identical requests reuse an in-isolate cache for
  15 minutes, so a repeat question does not spend quota.
- Each client is limited to 20 requests per minute. The upstream call has a 15-second
  deadline; 429, 401, 502, and 504 upstream failures map to explicit JSON errors.
- The model only interprets facts and optional browse previews. It is told not to
  treat display differences as calibrated measurements or hazards.

## Published Analysis

```text
/api/analysis?bbox=90.0575,21.7524,90.2025,21.8876&start=2026-06-01&end=2026-10-31&product=nisar-gcov-provisional&polarization=HV
```

The response is `{ status: "analysis_available", manifest }` or
`{ status: "analysis_unavailable", reason }`. Unknown/repeated fields, blank numeric
coordinates and invalid dates are rejected. Broader/narrower windows or a different
polarization do not silently inherit a study. The manifest is validated with the
shared Zod contract and carries source IDs, algorithm/input identity, fixed epochs,
sensitivity ranges, source processing flags and independent-reference coverage.

Regenerate both indexes with `python tools/analysis/publish.py --site kuakata-bangladesh`.
This only writes local files. It requires complete source dates, geometry checks,
reference-attempt accounting and existing versioned rasters. Reference agreement
does not promote an `exploratory_derived` result to validated. Static assets live
with the frontend; the API imports JSON and does not rely on a runtime filesystem.

## Authentication And Scientific Scope

Metadata search needs no Earthdata or Microsoft credentials. Downloading the
referenced NASA assets does require Earthdata access; Microsoft RTC requires its
own account/access and runtime SAS signing. Those integrations are not implemented
here. Never put passwords, `.netrc`, `.dev.vars`, or signed asset URLs in Git.

NISAR and Sentinel-1 are not interchangeable measurements. Neither are Microsoft
RTC and OPERA RTC automatically compatible. Provider validation applies to the
source product, not to a derived EarthEyes result. Browse assets are not numerical
change maps or guaranteed georeferenced imagery.

## Cloud Deployment

Deployment has not been performed by a dry-run build. The owner must authorize
the target Cloudflare account and confirm free-plan limits and abuse controls.

1. Authenticate Wrangler to the intended account using `npx wrangler login`.
2. Set `ALLOWED_ORIGINS` in `wrangler.jsonc` to the exact frontend origin(s), without
   paths or trailing slashes. Defaults permit local frontend testing only.
3. Configure appropriate account-level rate limiting and monitor request/CPU
   quotas before opening the endpoint publicly. CORS is not authentication or
   protection against non-browser abuse. A free plan has no availability guarantee.
4. Run the tests and `npm run check:api`. Set the Argus key with
   `npx wrangler secret put GROQ_API_KEY` (never a plain `vars` entry), then deploy
   with `npm run deploy:api`.
5. Run the smoke check against the resulting HTTPS endpoint.

Do not enable paid upgrades automatically. Do not deploy this module as a substitute
for the existing `/places`, `/metrics`, `/alerts`, or subscription API contracts.
