# EarthEyes

EarthEyes is a map-first environmental field atlas for the NASA Space Apps “Dancing with the SARs” challenge. It supports place search, dated observation comparison, coastal and ice evidence modules, GLOF review context, GroundLine warning governance, and the contextual Argus guide.

The existing `/explore` workspace now loads real NASA OPERA Sentinel-1 RTC acquisitions and official SAR browse images. Its map, footprint selector, timeline, swipe, side-by-side, single and fade views use those records. Calibrated change measurements are explicitly unavailable, not replaced with fixtures. GroundLine remains a clearly labelled demonstration and must not be used for safety decisions.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the Vite URL and select **Open the explorer**. `npm run dev` serves the frontend and metadata API together; a second server or Earthdata login is not needed for public metadata and browse images. Kuakata starts with a known May 2024 archive window. Use **Area and date filters** in Controls to change the window, choose a **Scene footprint**, then compare its real acquisition dates. Grouping by OPERA burst prevents comparing adjacent ground footprints as if they were before/after observations.

The name search offers reference places, not a global geocoder. Any valid worldwide area remains eligible: pan/zoom the map and select **Search this map area**, or enter WGS84 bounds in Controls. Source coverage varies. Only selected public browse images are fetched, never whole protected satellite rasters. These previews are not calibrated change maps or georeferenced image overlays; the map displays actual acquisition footprints. Missing images and provider failures stay explicit.

Share links capture the selected bounds, dates, footprint and acquisition IDs. If a shared record is outside the loaded pages, the explorer asks you to load more or explicitly choose available records instead of silently showing a different scene.

The app starts without waiting for a mock service worker. Reference pages and GroundLine still use the existing repository; MSW is used for tests. `VITE_API_BASE_URL` configures that separate full-repository boundary, not the live imagery catalogue. Do not set `VITE_DATA_ORIGIN=live` merely to relabel fixture records.

For a static hosted build, set `VITE_CATALOGUE_API_BASE_URL=https://YOUR-WORKER.workers.dev/api/catalog` at build time and allow the exact frontend origin in the Worker. Vite's local API is not deployed with static assets. No cloud deployment has been performed; an unconfigured hosted catalogue reports an error rather than returning fixtures.

## Verification

```sh
npm run lint
npm run typecheck
npm test
npm run build
npm run build-storybook
npm run test:e2e
npm run lighthouse
```

Playwright covers Chromium, Firefox, a 360px mobile viewport, WCAG checks, responsive overflow, core explorer journeys, Argus, GroundLine, and visual snapshots.

## Architecture

- `src/app`: providers, routed shell, route announcements, and error handling.
- `src/routes`: landing, the integrated explorer, stories, methodology, data sources, GroundLine, and about. There is no separate catalogue page.
- `src/features`: map, search, comparison, timeline, evidence, explorer controls, and Argus.
- `src/domain`: Zod contracts and the coastal/ice/GLOF module registry.
- `src/data`: fixture and HTTP repository adapters plus query hooks.
- `src/mocks`: validated fixtures and MSW endpoint handlers.
- `src/shared`: UI primitives, formatting, and responsive utilities.
- `src/styles`: design tokens and route, explorer, shell, and Argus styles.

## GitHub Pages

The deployment workflow sets `VITE_BASE_PATH=/EarthEyes_NASASpaceApps/`. The build emits `404.html` as an SPA fallback so shared explorer URLs survive direct reloads on GitHub Pages.

## Integration Boundary

Real acquisition discovery and public SAR preview comparison are connected inside the explorer. Calibrated georeferenced imagery, quantitative difference, shoreline/ice metrics and hazard analysis still require metered raster access, processing, QA and published products. Those controls/results are not fabricated. NISAR SAR observations must never be presented as direct sea-level measurements, and GLOF candidates must never become public warnings without analyst review and authority approval.

## Worldwide Catalogue Backend

The first backend module is implemented in `backend/api`: a Cloudflare Worker that
searches real NASA/ASF and Microsoft STAC metadata for arbitrary worldwide bounding
boxes, including polar regions and the antimeridian. It validates queries and source
records, bounds upstream requests, supports pagination and caching, and does not
download imagery or manufacture measurements.

```sh
npm run dev:api
npm run test:backend
npm run smoke:api
npm run check:api
```

Run the smoke check while the local API is listening on `http://127.0.0.1:8787`.
See [`backend/api/README.md`](backend/api/README.md) for requests, limits, and cloud
deployment prerequisites, and [`docs/backend/worldwide-design.md`](docs/backend/worldwide-design.md)
for the modular architecture.

The explorer consumes this API through its typed client, retaining pagination,
deduplication, dateline continuations and honest empty/error states. The first
imagery workflow uses OPERA Sentinel-1 public browse assets. Other product families
remain available through the metadata API but are not silently mixed into image
comparisons. Queued raster processing and scientific measurements remain later
modules. Do not point `VITE_API_BASE_URL` at the catalogue-only API.
