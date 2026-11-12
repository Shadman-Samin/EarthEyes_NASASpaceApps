# EarthEyes

EarthEyes is a map-first environmental field atlas for the NASA Space Apps “Dancing with the SARs” challenge. It supports place search, dated observation comparison, coastal and ice evidence modules, GLOF review context, GroundLine warning governance, and the contextual Argus guide.

The `/explore` workspace loads real NASA NISAR GCOV acquisitions and official per-polarization L-band browse images by default, with an OPERA Sentinel-1 RTC switch for the historical C-band archive. Its map, footprint selector, timeline, polarization switch, swipe, side-by-side, single and fade views use those records. For any pulled location, the explorer auto-selects the best footprint and earliest/latest usable pair, computes a client-side difference from the pulled preview images, and builds a real-time Summary, Chart and Context from the pulled metadata. A short Groq vision-grounded interpretation is generated when configured, with a deterministic computed fallback; all of it stays labelled exploratory and uncalibrated. The two flagship calibrated NISAR GCOV bundles (Kuakata, Bangladesh and Jakobshavn Isbrae, Greenland) remain reproducible under `public/analysis/` but are no longer wired into the explorer UI. GroundLine remains a clearly labelled demonstration and must not be used for safety decisions.

## Run locally

Requires Node.js 22.12 or newer.

```sh
npm ci
npm run dev
```

Open the Vite URL and select **Open the explorer**. `npm run dev` serves the frontend and metadata API together; a second server or Earthdata login is not needed for public metadata and browse images. The explorer defaults to NISAR GCOV (provisional) from January 2026 to today; Kuakata has a known mid-2026 NISAR coverage window. The best footprint, date pair and comparison view are selected automatically from the pulled data. Use **Advanced options (optional)** in Controls to change the window, switch to the OPERA Sentinel-1 2024 archive, choose a **Footprint**, or change **Polarization** (HV recommended). Grouping by acquisition frame prevents comparing adjacent ground footprints as if they were before/after observations.

The name search offers reference places, not a global geocoder. Any valid worldwide area remains eligible: pan/zoom the map and select **Search this map area**, or enter WGS84 bounds in Controls. Source coverage varies. Only selected public browse images are fetched, never whole protected satellite rasters. These previews are not calibrated change maps or georeferenced image overlays; the map displays actual acquisition footprints. The realtime Summary, Chart and Context are generated from the pulled records and preview images, and missing images or provider failures stay explicit. Groq configuration is optional: set `VITE_GROQ_API_KEY` and `VITE_GROQ_MODEL` in a gitignored `.env`; Argus uses the text model, while Summary uses its deterministic computed narrative unless `VITE_GROQ_VISION_MODEL` is configured. Reserving text-model quota for user questions keeps Argus reliable on the free tier. **`VITE_` values are embedded in the client bundle and are public**, so use a Worker proxy for any public production deployment.

Share links capture the selected bounds, dates, footprint and acquisition IDs. If a shared record is outside the loaded pages, the explorer asks you to load more or explicitly choose available records instead of silently showing a different scene.

Argus appears only in Explore as a compact, fixed chat window. It receives the same loaded acquisitions, selected footprint, dates and computed preview statistics as the evidence drawer. Questions use the existing optional Groq configuration, with clearly labelled data-based answers if AI is unavailable. Context changes cancel pending answers and clear the old thread; closing and reopening preserves the current conversation. Argus does not inspect images or issue warnings.

Home includes a muted, looping eight-second orbital background clip (`public/orbit-hero.mp4`, 1280x720 at 24 fps, about 167 KiB), trimmed from the supplied `nasa_svs_5615_orbit_1080p60.mp4`. Reduced-motion and low-bandwidth preferences use `orbit-hero.jpg` instead. The separate YouTube project walkthrough remains available below the hero.

The app starts without waiting for a mock service worker. Reference pages and GroundLine still use the existing repository; MSW is used for tests. `VITE_API_BASE_URL` configures that separate full-repository boundary, not the live imagery catalogue. Do not set `VITE_DATA_ORIGIN=live` merely to relabel fixture records.

Vercel serves the catalogue on the same origin through `api/index.ts`. For other static hosts, set `VITE_CATALOGUE_API_BASE_URL=https://YOUR-WORKER.workers.dev/api/catalog` at build time and allow the exact frontend origin in the Worker. An unconfigured static host reports an error rather than returning fixtures.

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

Real acquisition discovery, public SAR preview comparison and real-time interpretation are connected inside the explorer for any pulled location. Interpretation and computed change summaries are exploratory and uncalibrated; they are not georeferenced measurements or hazard warnings. The calibrated georeferenced bundles for the two flagship investigations remain reproducible but are not used by the current explorer. Quantitative claims stay tied to granule IDs and stated limitations. NISAR SAR observations must never be presented as direct sea-level measurements, and GLOF candidates must never become public warnings without analyst review and authority approval.

## Computed change analysis (legacy bundles)

The explorer no longer reads these bundles; it interprets pulled data in real time. The calibrated
bundles remain under `public/analysis/<place>/` for reproducibility and are generated offline
by `tools/analysis` from real NISAR GCOV granules (Earthdata bearer token required,
never committed). The pipeline reads only the needed HDF5 windows, computes calibrated
dB change, water-area time series, clusters and a plain-language story for every date
pair, then writes Int16 rasters plus a JSON manifest. Each pair names its own delta
raster and its own story, so the prose always matches the selected comparison. Re-run:

```sh
cd tools/analysis
python extract.py --site kuakata-bangladesh
python extract.py --site jakobshavn-glacier
python analyze.py --site kuakata-bangladesh
python analyze.py --site jakobshavn-glacier
```

See `tools/analysis/README.md` for authentication, ROI and reproducibility details.

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
