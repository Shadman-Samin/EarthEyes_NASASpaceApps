# Worldwide EarthEyes Backend

## Agreed Outcome

EarthEyes must accept locations worldwide, not a list of featured places. The user
approved live archive discovery, immediately reusable cached results, and queued
analysis with visible progress and resource limits. Satellite availability, quality,
and acquisition latency remain properties of the source missions.

Use free cloud services initially. Do not silently enable paid usage, download whole
large granules, manufacture results, or turn change candidates into public warnings.
An Earthdata Login is available; its credentials must only be configured as secrets.

## Architecture

- A TypeScript Cloudflare Worker serves bounded metadata and published results.
- NASA CMR/ASF remains the archive index; EarthEyes does not mirror the global archive.
- Cloudflare's cache can reuse metadata for five minutes, with the original fetch
  timestamp visible. This is not a durable processing database.
- A later persistent job ledger and bounded Python workers handle approved analyses.
- Browsers receive public browse imagery or published tiles, never private credentials.
- A provider's validated source product does not validate an EarthEyes derived result.

Featured places remain useful examples but must not control backend eligibility.
Processing limits constrain the size of a request, not its geographical location.

## Module Sequence

1. Worldwide catalogue API, strict contracts, safe pagination, and deployment tooling.
2. Persistent requests, admission limits, authentication, and an actual processing queue.
3. Metered remote subset reads, raster masks/alignment, scientific QA, and publication.
4. Arbitrary-area frontend selection, job progress, real analytical tiles and metrics.
5. Independently validated coastal and ice methods, followed by GLOF review context.
6. Governed GroundLine publication, grounded Argus explanations, and release hardening.

Each module must have runnable tests and an honest capability boundary. No API may
return a fabricated queued, processed, or ready result for an unimplemented service.

The first imagery portion of Module 4 is integrated into the existing `/explore`
workspace, as requested by the user: worldwide bounds, date filters, real OPERA
acquisitions grouped by burst, public SAR previews, footprints and manual
continuations. There is no separate catalogue page. Existing timeline and
comparison controls are retained; measurements and calibrated difference are
explicitly unavailable. Local Vite runs the metadata API alongside the UI.
Modules 2-3, calibrated map tiles and scientific measurements are not implemented;
static deployments still require an authorized catalogue Worker endpoint.

## Module 1 Scope

Deliver an independently runnable HTTP catalogue API. It accepts any valid WGS84
bounding box, including polar locations and boxes crossing the antimeridian. There
is no place ID requirement or geographic whitelist. It does not geocode names,
download imagery, launch processing, or replace the current fixture explorer yet.

### Routes

- `GET /api/health`: service name and implemented capabilities.
- `GET /api/catalog/collections`: supported product families and their access rules.
- `GET /api/catalog/search`: validated, paginated, metadata-only archive search.

Search parameters are `product`, `bbox`, `start`, `end`, optional `limit`, and optional
`cursor`. Dates are real ISO calendar dates; end dates are inclusive. Require a
nonzero bounding box, longitude in [-180, 180], latitude in [-90, 90], ordered
latitudes, and a range of at most 366 calendar days. Reject unknown or repeated
parameters instead of accepting misspelled filters.

`limit` is at most 20 items per longitude partition, default 10. Crossing the
antimeridian requires at most two independent provider requests because CMR rejects
wrapped bounding boxes. Deduplicate the combined page by collection and item ID.
Return separate continuation entries for partitions that have additional results;
each entry contains its bounding box and an opaque cursor bound to the search.
Clients merge subsequent pages by the same stable item identity. A wrapped search
can return at most 40 items. Partition pages are not a globally time-sorted stream.

Do not report a global scene count from one page. Expose `hasMore` and distinguish
an empty successful search from a provider failure. Any failed partition fails the
whole response; do not imply that the other half is complete.

### Supported Sources

- `nisar-gcov`: ASF STAC `NISAR_L2_GCOV_V1_1`, validated source collection.
- `nisar-gcov-provisional`: ASF STAC `NISAR_L2_GCOV_PROVISIONAL_V1_1`.
- `nisar-gcov-beta`: ASF STAC `NISAR_L2_GCOV_BETA_V1_1`.
- `opera-rtc-s1`: ASF STAC `OPERA_L2_RTC-S1_V1_1`.
- `sentinel-1-rtc`: Planetary Computer STAC `sentinel-1-rtc`.

NASA data assets require Earthdata access. Microsoft RTC data assets require
Planetary Computer access and runtime SAS signing. Public catalogue queries do not
require either credential. Never downgrade source maturity implicitly to find data.

### Response Contract

Return the normalized query, provider/product information, UTC `fetchedAt`,
`metadataOnly: true`, items, continuation entries, and `hasMore`. Each item preserves
provider collection/item identity, geometry/bounds, actual acquisition timestamps,
source metadata URL, declared maturity, and available HTTPS asset references.

Optional SAR properties remain null or empty when absent. NASA STAC currently lacks
many orbit/polarization fields; do not infer scientific compatibility from invented
values. Some Microsoft timestamps use a space instead of `T`; normalize documented
offset-bearing timestamps to UTC. Reject malformed timestamps and source records.
Do not equate RTC source processing metadata with a validated analytical comparison.

Only retain unsigned HTTPS references without URL credentials. Preserve provider
asset keys, roles, media types, and sizes where actually declared. Browse images
are not georeferenced analytical layers. Unknown sizes remain unknown, not zero.

### Resource And Security Limits

- At most two upstream metadata requests per search, never an automatic archive crawl.
- At most 2 MiB of decoded metadata per provider response, enforced while streaming.
- A 15-second upstream deadline covers response headers and body reading.
- Only fixed provider search origins and paths can be fetched; reject redirects.
- Continuations cannot override the collection, area, dates, limit, or provider URL.
- Use input validation, bounded cursor size, explicit errors, and no internal errors
  or credentials in public responses.
- Cache only successful results. Keep the original acquisition and fetch timestamps.
- Apply CORS from an explicit environment allowlist, never reflect arbitrary origins.
- Reject unsupported HTTP methods and expose rate-limit/provider failures distinctly.
- Do not implement a fake queue or expose a general-purpose data download proxy.

Deploy behind the platform's free-plan request limits and configured rate limiting.
CORS is not authentication or abuse prevention. Public production rollout requires
checking account quotas and abuse controls; the code alone cannot guarantee free
unlimited access or availability.

## Scientific Processing Boundaries

Later workers must measure actual transferred bytes, not just cropped output size.
Start with a 512 MiB run budget, one active worker, bounded memory/scratch, and a
deadline. GDAL cache configuration is not a network byte limit. A reader without
enforceable accounting must not be exposed for general public processing.

Only numerically compare compatible product families, geometry, polarization, grid,
and processing baselines. NISAR L-band and Sentinel-1 C-band are not interchangeable.
Microsoft RTC and OPERA RTC also have different processors and elevation inputs.
Actual acquisition groups must not be confused with neighboring bursts on one pass.

GIBS/Worldview mosaics are browse-only. Rolling 12-day mosaics do not assign one
acquisition date or one native resolution to every displayed pixel.

## Current Baseline

Before backend changes, dependencies were absent and were installed with `npm ci`.
Fresh lint, TypeScript, and Vitest runs then reproduced malformed JSX in
`src/routes/landing/LandingPage.tsx`: an unclosed `br` and a duplicated hero fragment
with an unmatched closing section. Preserve the newer header/hero and repair only
these blockers. Ten tests passed; the landing-page suite could not be imported.

Work is on `development` in the existing workspace so the uncommitted frontend is
preserved. Do not include session exports, editor locks, credentials, or generated
data in an incidental commit. No cloud resources should be created without the
necessary account authorization.

## Acceptance

- Tests exercise worldwide and antimeridian input, real provider-shaped records,
  metadata budgets, timeout/failure paths, safe continuation, CORS, and cache behavior.
- Live metadata probes include multiple continents and an antimeridian query.
- No raster URL or authentication endpoint is fetched during catalogue tests/probes.
- Lint, TypeScript, existing tests, and production build are run again.
- The Worker is dry-run deployable and locally smoke-tested before cloud deployment.
- Deployment/account configuration and the still-unimplemented modules are documented.
