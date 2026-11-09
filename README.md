# EarthEyes

EarthEyes is a map-first environmental field atlas for the NASA Space Apps “Dancing with the SARs” challenge. It supports place search, dated observation comparison, coastal and ice evidence modules, GLOF review context, GroundLine warning governance, and the contextual Argus guide.

The current application uses typed fixtures behind the same HTTP boundary intended for future services. Fixture imagery and values are visibly labeled and must not be used for navigation, evacuation, or safety decisions.

## Run locally

Requires Node.js 22 or a compatible current release.

```sh
npm ci
npm run dev
```

MSW serves fixture endpoints such as `/api/places/search`, `/api/observations`, `/api/layers`, `/api/metrics`, and `/api/alerts`. Set `VITE_API_BASE_URL` to replace the fixture API. Set `VITE_DATA_ORIGIN=live` only when that service returns authoritative connected records; otherwise the UI conservatively retains fixture labeling.

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
- `src/routes`: landing, explorer, stories, methodology, data sources, GroundLine, and about.
- `src/features`: map, search, comparison, timeline, evidence, explorer controls, and Argus.
- `src/domain`: Zod contracts and the coastal/ice/GLOF module registry.
- `src/data`: fixture and HTTP repository adapters plus query hooks.
- `src/mocks`: validated fixtures and MSW endpoint handlers.
- `src/shared`: UI primitives, formatting, and responsive utilities.
- `src/styles`: design tokens and route, explorer, shell, and Argus styles.

## GitHub Pages

The deployment workflow sets `VITE_BASE_PATH=/EarthEyes_NASASpaceApps/`. The build emits `404.html` as an SPA fallback so shared explorer URLs survive direct reloads on GitHub Pages.

## Integration Boundary

Real integration still requires confirmed STAC or tile endpoints, geospatial processing products, authentication and usage policies, authoritative alert ownership, and backend services. NISAR SAR observations must never be presented as direct sea-level measurements, and automated GLOF candidates must never become public warnings without analyst review and authority approval.
