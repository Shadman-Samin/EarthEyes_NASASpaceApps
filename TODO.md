# EarthEyes — Remaining Work

Hand-off document for the next person picking up the project.
Written **12 November 2026** at the end of the Phase 3 session; updated the same day with the
full-site editorial redesign brief in section 0.6.

- Repository: <https://github.com/Shadman-Samin/EarthEyes_NASASpaceApps>
- Working branch: `development` (tracks `origin/development`; product baseline `4bc93a0`)
- `main` is still `83d39cd` ("Complete EarthEyes project") — the **old monolithic app**.
- The restructured, live-SAR, computed-analysis app exists **only on `development`**.

Read section 0 and section 1 before touching anything. Sections are ordered by priority:
**P0 = blocks the demo**, **P1 = quality/robustness**, **P2 = scope growth**.

---

## 0. Where things stand

### 0.1 What is already built and verified

| Area | State |
| --- | --- |
| Modular React 19 + Vite 8 + TypeScript app (`src/app`, `src/routes`, `src/features`, `src/domain`, `src/data`, `src/mocks`, `src/shared`, `src/styles`) | Done |
| MapLibre adapter, global search, URL state, resizable explorer workspace, timeline, comparison modes | Done |
| Live NASA/ASF + Microsoft STAC catalogue Worker (`backend/api`) | Done, locally verified, **never deployed** |
| NISAR GCOV L2 live loading in the explorer (product + HV/HH polarization switch) | Done |
| Real-time interpretation for any pulled location: auto-selected footprint and earliest/latest pair, client-side browse-image difference, Summary/Chart/Context built from pulled metadata, Groq vision narrative with deterministic fallback | Done (see 0.5) |
| Legacy calibrated offline change bundles for two sites (`public/analysis/kuakata-bangladesh`, `public/analysis/jakobshavn-glacier`) | Retained on disk and reproducible via `tools/analysis`, but **no longer wired into the explorer UI** |
| GitHub Pages deploy workflow + CI workflow | Written; **CI on GitHub has never been observed, Pages has never received the new build** |

### 0.2 Verified baseline (reproduce before changing anything)

| Command | Expected result |
| --- | --- |
| `npm ci` | Clean install, Node 22.12+ required |
| `npm run lint` | Clean |
| `npm run typecheck` | Clean |
| `npm test` | **145 passed / 12 files** (55 frontend in 8 files, 90 backend in 4 files) after the realtime refactor removed two legacy analysis-panel test files and added realtime helper tests |
| `npm run test:backend` | **90 passed / 4 files** |
| `npm run build` | Succeeds, **emits a chunk-size warning** (see 5.1) |
| `npm run build-storybook` | Succeeds |
| `npm run test:e2e` | **37 passed, 26 skipped** — skips are project-scoped by design, not broken (see 11.3) |
| `npm run lighthouse` | Not run yet — no recorded baseline (see 5.3) |

### 0.3 Recent commits on `development`

```
4bc93a0 Interpret pulled SAR data in real time for any location
e7f67f0 Add hand-off TODO with remaining work for teammates
2eac270 Remove unreferenced standalone eartheyes.html prototype
a81b556 Merge remote development branch into local history
080c173 Add calibrated NISAR change analysis for Kuakata and Jakobshavn
0fde90d Enable Difference mode for live same-family pairs in controls
f3d4063 Add exploratory live pixel-difference view for same-family NISAR pairs
a27b59f Wire explorer to live NISAR GCOV with product and polarization switching
f20e698 Restructure app into modular explorer with live SAR catalogue backend and test tooling
87072e0 Add EarthEyes application structure and features
```

### 0.4 Headline numbers you may be asked about

- Kuakata, Bangladesh — NISAR GCOV orbit 069/013, 10 acquisitions, 764×763 px @ 20 m, EPSG:32646.
  Water 173.4 → 154.3 km² (−19.2 km², −11 %); 97.2 km² (42 %) of the window changed; 24 clusters.
- Jakobshavn Isbrae, Greenland — NISAR GCOV orbit 131/037, 7 acquisitions, 512×512 px @ 40 m, EPSG:3413.
  225.0 km² (54 %) changed; 24 clusters, 12 persistent across the season.
- All values are **provisional NISAR calibration** and must stay labelled that way.

### 0.5 Real-time interpretation (current explorer behaviour)

The explorer no longer depends on pre-generated bundles. For any pulled location it now:

- picks the best footprint and the earliest/latest usable pair from the pulled catalogue records
  (`src/features/analysis/realtime.ts`);
- computes a cached browse-image difference and summary client-side
  (`src/features/comparison/useBrowseComparison.ts`, `src/features/comparison/difference.ts`);
- renders **Summary** (thumbnails, computed diff canvas, metrics, narrative), **Chart**
  (acquisition timeline + computed change bars + table) and **Context** (pulled metadata) in
  `src/features/evidence/EvidenceDrawer.tsx`;
- asks Groq for a short interpretation grounded in the computed facts (and optionally the preview
  images when a vision-capable model is configured), then falls back to a deterministic template on
  any error (`src/features/analysis/narrative.ts`).

Configuration lives in a gitignored `.env`:

```sh
VITE_GROQ_API_KEY=<key>
VITE_GROQ_MODEL=qwen/qwen3.8-27b
# Optional; only set this to a vision-capable model your account can access:
# VITE_GROQ_VISION_MODEL=
```

The current Groq account exposes `qwen/qwen3.8-27b` and `allam-2-7b` but no vision model, so the
narrative is facts-grounded (not image-grounded) today. If a vision model becomes available, set
`VITE_GROQ_VISION_MODEL`; the code tries images first and automatically retries facts-only on failure.

**Security:** every `VITE_` value is embedded in the client bundle and is public. This is acceptable
for a demo only. For any public production deployment, proxy Groq through a Worker (or similar) and
keep the key server-side. Do not commit `.env`.

All realtime output stays labelled exploratory: pulled preview images are uncalibrated, not
georeferenced, and not a hazard warning. The calibrated bundles under `public/analysis/**` remain
reproducible but are no longer read by the explorer.

### 0.6 Active handoff: full editorial UI overhaul (audit complete; implementation not started)

The owner requested a high-quality redesign of every public editorial page and the shared shell,
plus an on-page project video. A read-only route/content/style/test audit is complete. **No source
or style file was changed during this planning pass.** The next agent can begin implementation
directly from this section.

#### Required outcome

- Replace the repetitive card-grid pages with one coherent, evidence-led visual system that still
  gives Home, Methodology, Data Sources, GroundLine, About and guided stories distinct identities.
- Keep only content that explains the product, its actual implementation, its evidence, or its
  safety boundary. Remove slogans, repeated disclaimers and generic filler that add no information.
- Preserve the existing explorer functionality. Only adjust Explorer where shared shell/tokens need
  compatibility fixes; do not turn this redesign into another explorer logic refactor.
- Keep all claims aligned with the current implementation in section 0.5 and `README.md`.
- Complete responsive/mobile and accessibility work, update tests/snapshots, run the full baseline,
  then commit and push `development`.

#### Page-by-page implementation plan

- [ ] **UI.1 Shared shell and visual language**
  - Rework `src/app/AppShell.tsx`, `src/styles/tokens.css`, `src/styles/base.css` and
    `src/styles/shell.css` as a clear Earth-observation field-journal system: strong editorial type,
    disciplined grid, high-contrast forest/paper surfaces, and aqua/lime/coral used as data signals.
  - Improve desktop navigation, mobile menu, active states and footer information architecture.
    Footer should include Home/Explore/About and the repository or authoritative mission link where
    useful; do not duplicate the entire header.
  - Keep one `h1` per route, visible keyboard focus, reduced-motion support, 44 px touch targets and
    readable metadata (12 px minimum unless truly decorative).

- [ ] **UI.2 Home (`src/routes/landing/LandingPage.tsx`)**
  - Lead with the concrete product: choose a bounded area, pull real SAR acquisition metadata and
    official browse previews, compare compatible dates, and read an exploratory interpretation.
  - Do not claim the four-place name search is a worldwide geocoder. Worldwide discovery currently
    requires map/bounds selection, and archive coverage varies.
  - Make the project walkthrough a prominent proof section, not a footer afterthought. Embed:

    ```text
    https://www.youtube.com/embed/Z79QX64rM4w?si=TPwG5YWCkilhLh4e
    ```

    Use a responsive 16:9 `<iframe>`, `title="EarthEyes project walkthrough"`, `loading="lazy"`,
    `referrerPolicy="strict-origin-when-cross-origin"`, `allowFullScreen`, and the supplied allow list:
    `accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share`.
    Do not autoplay. Include a direct YouTube fallback link near the player.
  - Retain only meaningful modules/reference places/product-flow/GroundLine/source material. Replace
    the current false "Velocity / boundary / elevation" preview claim with facts the live explorer
    actually exposes.

- [ ] **UI.3 Methodology (`src/routes/methodology/MethodologyPage.tsx`)**
  - Describe the current live pipeline, not an aspirational calibrated pipeline: catalogue query;
    footprint/product grouping; earliest/latest usable browse selection; Canvas normalization capped
    at 1600 px; RGB luminance difference; threshold `26`; changed/brighter/darker shares; metadata-
    grounded narrative; visible limitations.
  - Explicitly state that browse previews are uncalibrated and unregistered, percentages are visual
    screening statistics rather than georeferenced measurements, and Groq currently receives computed
    facts unless a supported vision model is configured.
  - Keep the calibrated offline bundle workflow clearly separate and identify it as reproducible but
    not connected to the explorer UI.

- [ ] **UI.4 Data Sources and source detail**
  - Redesign `src/routes/data-sources/DataSourcesPage.tsx` around source roles rather than nine
    identical cards: observation archives, independent context, derived processing, and responsible
    authority records.
  - Preserve provider, technology, role, coverage, cadence, citation, limitations and authoritative
    links. Make fixture/reference metadata versus live explorer catalogue records unmistakable.
  - Redesign `DataSourceDetailPage.tsx` with a strong provenance hierarchy and useful return path.
    Do not invent product versions, licenses, freshness or acquisitions absent from the typed record.

- [ ] **UI.5 GroundLine (`src/routes/groundline/GroundLinePage.tsx`)**
  - Keep the existing five-stage safety gate and interactive tabs, but make "demonstration" visible
    before any notice. Review candidates must remain visually and semantically separate from
    authority-issued demo records.
  - Preserve E.164 validation, local OTP simulation, consent, delivery/language preferences and
    explicit statements that no data is transmitted or stored. Do not imply real SMS, voice,
    localization, subscription or warning operations.

- [ ] **UI.6 About and guided stories**
  - Rebuild `src/routes/about/AboutPage.tsx` around the NASA Space Apps challenge, problem, shipped
    system, scientific boundaries, open-source repository and current prototype state.
  - Do not invent team names, affiliations, awards, operational partners or deployment status. Add
    them only if the owner supplies verified information.
  - Replace the repeated filler in `src/routes/stories/StoryPage.tsx` with place-specific questions,
    evidence needed, what the current explorer can inspect, and what cannot be concluded. If a story
    cannot be made evidence-specific in this pass, remove/de-emphasize its route links rather than
    presenting generic prose as a case study.

#### Audit findings that constrain the redesign

- All route definitions are in `src/app/router.tsx`; shared shell/footer is `src/app/AppShell.tsx`;
  most editorial CSS is currently coupled in `src/styles/routes.css`.
- There are no production-ready local PNG/JPG/WebP/SVG mission images. Do not add generic stock
  photography. Prefer the authentic project video, data-derived/CSS cartographic graphics, or clearly
  sourced official imagery if new assets are added.
- The explorer renders acquisition footprints and selected official browse previews. Declared
  coastal/ice/GLOF layers in `module-registry.ts` are not all implemented; editorial copy must not
  present them as available map products.
- Live visual difference uses unregistered preview pixels (`difference.ts`, threshold 26), not the
  calibrated Int16 bundles. The bundles remain under `public/analysis/**` but are unused by the UI.
- Name search contains four reference places. "Any area" means a valid map-selected/bounded area,
  subject to provider coverage; it does not mean global place-name search.
- The current key has no Groq vision model. The narrative is facts-grounded today and falls back to a
  deterministic template. Never claim AI inspected pixels unless a working vision model is configured.
- GroundLine is a non-operational interface demonstration. A review candidate is never a warning.

#### Test and acceptance plan

- [ ] **UI.7 Unit and route coverage**
  - Update `src/routes/landing/LandingPage.test.tsx` for the new primary CTA and video iframe.
  - Add focused render/semantics tests for Methodology, Data Sources, GroundLine and About where they
    protect important factual/safety copy; avoid brittle tests for purely decorative text.
- [ ] **UI.8 E2E, responsive and accessibility**
  - Expand `e2e/responsive.spec.ts` to sweep Home, Methodology, Data Sources, GroundLine and About at
    320, 360, 768, 1280 and 1920 px without horizontal overflow.
  - Keep the GroundLine authority/review separation journey green. Add a Home assertion for the
    YouTube iframe URL/title and direct fallback link.
  - Run axe on the redesigned editorial routes, not Home alone.
  - Regenerate `e2e/visual.spec.ts-snapshots/landing-desktop-chromium-win32.png` only after the new
    design is final; add snapshots selectively rather than freezing every page.
- [ ] **UI.9 Final quality gate**
  - Run `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:backend`, `npm run build`,
    `npm run build-storybook` and `npm run test:e2e`.
  - Run `npm run lighthouse` or document the exact environment blocker because Home and iframe loading
    are changing. Lazy-load the YouTube player to limit initial-page cost.
  - Inspect desktop and 360 px mobile pages manually, verify no overlapping Argus/header/footer,
    review every retained claim for implementation fidelity, and confirm no secret or `.env` is staged.
  - Commit in the repository's imperative style and push `origin/development`. Do not merge `main`
    without the owner's explicit instruction.

---

## 1. Setup (do this first)

- [ ] **1.1** Clone and check out the working branch:

  ```sh
  git clone https://github.com/Shadman-Samin/EarthEyes_NASASpaceApps.git
  cd EarthEyes_NASASpaceApps
  git checkout development
  npm ci
  ```

- [ ] **1.2** Install Node **22.12 or newer** (`node -v`) and Python **3.10+** (`python --version`) if you intend to regenerate bundles.
- [ ] **1.3** Get your **own NASA Earthdata bearer token** and create a local, gitignored `.env.analysis`:

  ```sh
  echo "EARTHDATA_TOKEN=<your token>" > .env.analysis
  ```

  The token is required only to regenerate bundles from NISAR. `.env.analysis` is covered by `.gitignore`
  (`.env.*`). **Never commit it, never paste it into an issue, a PR, or chat.**

- [ ] **1.4** Confirm the ignore rules work before your first commit:

  ```sh
  git status --porcelain
  git check-ignore -v .env.analysis
  ```

  `.env.analysis` must appear in `git check-ignore` output.

- [ ] **1.5** Run the baseline table in 0.2 and record the actual numbers in your first PR description.

---

## 2. P0 — Publish the current build (the live site is still the old app)

The public GitHub Pages site currently serves `main` = the pre-restructure app. Nothing built in the last
two weeks is visible to a judge or a user.

- [ ] **2.1** Fast-forward `main` onto `development` and push it. This is the only step that triggers
  `.github/workflows/deploy.yml`:

  ```sh
  git checkout main
  git merge --ff-only development     # fast-forward only; if this fails, STOP and ask
  git push origin main
  ```

  Do **not** force-push `main`, and do not rewrite `83d39cd`.

- [ ] **2.2** Repo → **Settings → Pages → Source: GitHub Actions**. If it says "Deploy from a branch",
  switch it to GitHub Actions; otherwise the workflow will build but not publish.
- [ ] **2.3** Watch the **Deploy EarthEyes to GitHub Pages** run to green. The workflow runs
  `npm run lint && npm run typecheck && npm test` before building, so a red build means a real regression.
- [ ] **2.4** Smoke-test the deployed site at
  `https://shadman-samin.github.io/EarthEyes_NASASpaceApps/`:

  - [ ] Landing page loads, one `h1`, primary "Open the explorer" CTA works.
  - [ ] Deep link `…/explore/jakobshavn-glacier` survives a **hard reload** (proves the `404.html` SPA fallback
        built by the `github-pages-spa-fallback` Vite plugin).
  - [ ] Explorer opens, place search works, footprint selection works, date/polarization switch works.
  - [ ] Explorer loads pulled NISAR acquisitions and shows a real-time Summary (thumbnails, computed diff,
        metrics), Chart (acquisition timeline + change bars) and Context (pulled metadata) that update with
        the auto-selected pair.
  - [ ] Switching footprint, polarization, or date window refreshes Summary/Chart/Context; the Groq
        narrative appears, or the computed fallback is shown without breaking the page.
  - [ ] Difference mode renders for a live same-family pair and shows the exploratory disclaimer.
  - [ ] Argus, GroundLine, Methodology, Stories, Data sources, About routes all render.
  - [ ] 360 px mobile viewport: drawers/bottom sheet, no horizontal overflow.

- [ ] **2.5** Decide the hosted **catalogue API** story (see 2.6) and, if the Worker is deployed, set
  `VITE_CATALOGUE_API_BASE_URL=https://<worker>.workers.dev/api/catalog` as a repository
  Actions variable so the Pages build picks it up. Without it the hosted build reports a catalogue error
  instead of fixture data — that is intentional, but it must be a decision, not an accident.
- [ ] **2.6** Known hosting limitation: `npm run dev` serves a local metadata API through the Vite
  `catalogueApi()` plugin, but **Vite's local API is not deployed with static assets**. The hosted site
  therefore has no catalogue backend until the Worker is deployed (section 3.2). Either deploy the Worker
  or make sure the hosted UI states the catalogue as unavailable rather than looking broken.

---

## 3. P0 — Credentials and external accounts

- [ ] **3.1** Earthdata token per developer (section 1.3). Add the token source to the team onboarding
  notes; never to a tracked file.
- [ ] **3.2** **Deploy the catalogue Worker to Cloudflare** (needs owner authorization of the target
  account). Full procedure is in `backend/api/README.md` → "Cloud Deployment":

  1. `npx wrangler login` against the intended account.
  2. Set `ALLOWED_ORIGINS` in `backend/api/wrangler.jsonc` to the exact frontend origin(s), no trailing
     slash, no path — the default permits local testing only.
  3. Configure account-level rate limiting and watch request/CPU quotas before opening it publicly.
     CORS is not authentication; the free plan has no availability guarantee.
  4. `npm run check:api`, then `npm run deploy:api`, then `npm run smoke:api -- https://<worker>.workers.dev`.
  5. Record the worker URL in the README and in section 2.5 of this file.

  Do not enable paid upgrades automatically. Do not deploy this module as a substitute for the
  `/places`, `/metrics`, `/alerts` or subscription contracts.
- [ ] **3.3** Decide and document the **secret-sharing policy** for the team (a shared password manager
  entry named for the Earthdata token). Nothing secret goes into this repository.
- [ ] **3.4** Confirm what the **untracked file** `better understand, interpret, limitations SAR.pdf`
  (repo root) is meant to change, then handle it per 9.1. It is currently untracked and uncommitted by
  explicit decision — do not commit it by accident.

---

## 4. P1 — Known bugs and rough edges in what was just built

- [x] **4.1 Missing sentence break in the per-pair story.** Fixed in `tools/analysis/analyze.py`
  (`build_pair_story` now builds a proper sentence break and punctuation). The two shipped manifests were
  patched in place for the prose only; rasters, metrics and `delta_url` values were not touched.
- [ ] **4.2** Full bundle regeneration is still pending: a real `analyze.py` run will rewrite the whole
  `public/analysis/**` tree (36 files, ~30.9 MB). Review the diff carefully, confirm the numbers did not
  move, and validate each manifest with
  `node -e "JSON.parse(require('fs').readFileSync('public/analysis/kuakata-bangladesh/manifest.json','utf8'))"`.
- [x] **4.3** Ice pair stories now include a persistent-cluster sentence in `build_pair_story`; the
  shipped manifest prose was patched to match.
- [x] **4.4** The per-pair prose now states the 1.5 dB change threshold.
- [x] **4.5** Units verified by reading the JSON with Node; `km²` and em dashes are valid UTF-8.
- [x] **4.6** Empty `src/routes/catalogue/` directory removed.

---

## 5. P1 — Performance, repository size and CI

- [ ] **5.1 Large bundle warning.** `npm run build` reports the `EarthMap` chunk at
  **1,075.94 kB raw / 292.23 kB gzip**, above Vite's 500 kB warning threshold. Options, in order of
  preference:
  - lazy-load the map (`React.lazy` + suspense fallback) so the landing page does not pay for MapLibre;
  - split the analysis/MapLibre chunk with `build.rollupOptions.output.manualChunks`;
  - only as a last resort, raise `chunkSizeWarningLimit` in `vite.config.ts` **with a comment explaining why**.
  Re-measure the chunk size after the change and record the before/after numbers in the PR.
- [ ] **5.2 `public/analysis/` is ~30.9 MB of committed Int16 rasters** (36 files) and is now in every clone
  and every GitHub Pages build artifact. Consider Git LFS, or hosting the bundles as release assets / a CDN
  and referencing them by URL. If you keep them in-tree, document the clone cost in the README.
- [ ] **5.3 Record a Lighthouse baseline.** `npm run lighthouse` exists and `lighthouserc.cjs` asserts
  accessibility ≥ 0.95 (error), best-practices ≥ 0.9 (warn), performance ≥ 0.75 (warn), total script size
  ≤ 650,000 bytes (warn). No run has been recorded yet, so the budgets have never actually been enforced.
  Run it, paste the scorecard into the PR, and fix anything below the thresholds.
- [ ] **5.4 Add Playwright to CI.** `.github/workflows/backend-checks.yml` currently runs
  lint → typecheck → `npm test` → `npm run build` → `npm run check:api`, but **not** `npm run test:e2e`.
  Add a job with `npx playwright install --with-deps chromium` and run the E2E suite.
- [ ] **5.5 Add Python checks to CI.** `tools/analysis/*.py` has no tests, no linting and no CI coverage.
  At minimum add `python -m compileall tools/analysis`; better, add `ruff` and a small `pytest` suite for
  `config.py` / `analyze.py` helpers (ROI maths, cluster labelling, `build_pair_story` text).
- [x] **5.6 Add `.gitattributes`** with `* text=auto eol=lf` and the binary extension list (`*.i16`,
  `*.png`, `*.jpg`, `*.tif`) so Windows checkouts stop producing line-ending warnings and the committed
  rasters are not mangled.
- [ ] **5.7 Speed up the unit suite.** Vitest warns that the jsdom environment is created 9 times
  (≈60 s of the 18 s run). Apply the hint in the Vitest output (`pool: 'vmThreads'` or `isolate: false`)
  after confirming the frontend tests still pass in isolation.
- [ ] **5.8 Confirm the CI workflow actually ran.** The GitHub API rejected anonymous queries from this
  machine, so the run status of the `development` pushes was never observed. Open
  <https://github.com/Shadman-Samin/EarthEyes_NASASpaceApps/actions> and confirm
  "Verify worldwide catalogue" is green on `development` before merging anything.

---

## 6. P1 — Extend the offline analysis pipeline (`tools/analysis`)

- [ ] **6.1** Add at least one **third site**. `tools/analysis/config.py` holds `SITES`; Barishal (Bangladesh)
  and a second Greenland site were named in `plan.md` as featured investigations.
- [ ] **6.2** Widen the **date coverage** per site and, where the orbit allows, add the **second
  polarization** (HV *and* HH) so the UI can cross-compare polarizations offline, not only live.
- [ ] **6.3** Add a **`verify` step** that re-checks a generated bundle without re-downloading:
  every `pairs[*].delta_url` resolves to an existing raster, the raster dimensions match `manifest.grid`,
  the Int16 scale matches `DB_SCALE`, and `pairs` covers every adjacent date pair in `manifest.dates`.
- [ ] **6.4** Add a **one-command runner** (`tools/analysis/run_all.py` or a `make`-style script) that
  extracts + analyzes every configured site, so regeneration is reproducible and not a copy/paste ritual.
- [ ] **6.5** Improve **reproducibility metadata**: keep `algorithm_version` and `provenance` in the manifest
  current, and record the granule IDs and the exact extraction parameters per site so a reviewer can
  reproduce the numbers.
- [ ] **6.6** Keep `tools/analysis/cache/` and `__pycache__/` ignored (already done) and never commit
  raw HDF5 windows.

---

## 7. P2 — Backend module 2: from catalogue to analysis

The catalogue module deliberately stops at metadata. `docs/backend/catalogue-plan.md` names the next module:
**persistent worldwide analysis requests, admission limits and real queue orchestration, followed by metered
raster subset processing and UI wiring.**

- [ ] **7.1** Write the module plan in the same format as `docs/backend/catalogue-plan.md` (goals,
  constraints, tasks with checkboxes, review focus) before writing code.
- [ ] **7.2** Implement the **request/queue layer**: durable analysis requests, admission control and rate
  limits, honest job states, and cancellation. No fake jobs, no invented measurements.
- [ ] **7.3** Implement **metered raster subset processing**: read only the required window from
  Cloud Optimized GeoTIFF-style assets, with per-job byte/time budgets.
- [ ] **7.4** Wire the explorer to the new endpoints with honest loading / error / no-coverage states, and
  keep the existing MSW fixtures working as the offline boundary.
- [ ] **7.5** Keep the rule from module 1 intact: **the catalogue Worker must not download imagery**.

---

## 8. P2 — Product features declared in `plan.md` but not implemented

`src/domain/module-registry.ts` declares these layers and evidence tabs; the map currently renders SAR
imagery plus the calibrated analysis deltas. These are the remaining scope items.

- [ ] **8.1 Coastal module layers** — `shoreline`, `inundation`, `subsidence`, `settlements`, `population`,
  `altimetry`. Sea-level context must stay a *separate* measurement from SAR.
- [ ] **8.2 Ice module layers** — `velocity`, `direction-vectors`, `ice-front`, `displacement`,
  `elevation`, `temperature`, `quality-mask`.
- [x] **8.3 Evidence drawer charts** — the Chart tab now renders a real acquisition timeline, computed
  change bars and an acquisition table from pulled data (plus a note that change bars are exploratory).
- [ ] **8.4 GLOF workflow** — automated threshold → analyst review → supporting evidence → authority
  approval → public SMS/voice. GroundLine is a labelled demonstration; a satellite-detected change must
  never become an automatic public warning.
- [ ] **8.5 Argus** — today it uses transparent guided actions. If a real AI service is wanted, give it the
  structured context snapshot (place, module, observation IDs, active layers, dates, metrics, provenance)
  and keep the rule that Argus never issues operational warning advice.
- [ ] **8.6 Low-bandwidth mode** and **localization readiness** (the plan requires 12 px minimum metadata,
  14–16 px control labels, long translated content).
- [ ] **8.7 Reduced-motion behaviour** across the new map/analysis surfaces.

---

## 9. P2 — Content, documentation and housekeeping

- [ ] **9.1** Decide the fate of `better understand, interpret, limitations SAR.pdf`:
  read it, extract any concrete actions into this file, then either delete it, add it to `.gitignore`, or
  commit a distilled summary under `docs/`. It must not stay an accidental untracked file forever.
- [ ] **9.2** `plan.md` is a static design document from the planning phase. Mark the phases that are now
  implemented, or archive it and let `TODO.md` be the living document.
- [ ] **9.3** Keep `src/routes/methodology/MethodologyPage.tsx` in sync with the analysis algorithm
  (threshold, clustering, water classification, provisional calibration) whenever `analyze.py` changes.
- [ ] **9.4** Add case studies for Kuakata and Jakobshavn under `src/routes/stories/` using the shipped
  bundles, and make sure the README's product description matches the shipped reality.
- [ ] **9.5** Update `README.md`: live Pages URL, deployed worker URL, bundle regeneration instructions,
  the Earthdata token setup, and the current honest scope statement.
- [x] **9.6** Delete the empty local `src/routes/catalogue/` directory (see 4.6).
- [ ] **9.7** Review `public/analysis/*/manifest.json` `limitations` arrays and the app copy for scientific
  honesty one more time before the submission deadline.

---

## 10. Definition of done for a change

- [ ] `npm run lint` clean.
- [ ] `npm run typecheck` clean.
- [ ] `npm test` green (expect 145 tests; add yours).
- [ ] `npm run test:backend` green.
- [ ] `npm run build` green, and no new chunk-size warning.
- [ ] `npm run test:e2e` green (expect 37 passed / 26 project-scoped skips).
- [ ] `npm run lighthouse` run if the change touches the landing page, map or bundle loading.
- [ ] `npm run check:api` green if `backend/api` changed.
- [ ] Every new claim in the UI is tied to a source product, a date and a granule ID.
- [ ] Every changed measurement has a visible uncertainty/limitation line.
- [ ] No token, credential or `.env` file is staged.
- [ ] PR describes what a reviewer must verify scientifically, not just what changed in code.

---

## 11. Gotchas

### 11.1 Scientific safety rules (do not break these)

- NISAR SAR observations must **never** be presented as direct sea-level measurements.
- A GLOF candidate must **never** become a public warning without analyst review and authority approval.
- GroundLine is a labelled demonstration; it must not be used for safety decisions.
- Browse previews are uncalibrated; only the precomputed bundles are calibrated, and they are provisional.

### 11.2 Windows / tooling

- PowerShell console rendering shows `km?` for `km²` and `—` for em dashes. That is the console code
  page, not the file. Read JSON with Node before believing a file is corrupted.
- `npm run format` uses `oxfmt`; run it only on the files you touched.
- Long-running `vitest` output can exceed the tool output limit; use `--project backend` or a focused path
  when iterating.

### 11.3 The 26 skipped Playwright tests

They are project-scoped by design, not failing:

| Spec | Rule |
| --- | --- |
| `explorer.spec.ts` | desktop journey skipped on `mobile`; axe/Argus/GroundLine/low-bandwidth/safety journeys are Chromium-canonical |
| `live-explorer.spec.ts` | desktop journeys skipped on `mobile`; the mobile workspace journey runs only on `mobile`; one Firefox development-worker regression |
| `responsive.spec.ts` | Chromium-canonical sweep |
| `visual.spec.ts` | desktop baseline on Chromium, mobile baseline on `mobile` |

All of them still run in the full matrix. If you add a project, re-check the skip conditions.

---

## 12. Where things live

| Path | What it is |
| --- | --- |
| `src/features/map/EarthMap.tsx` | MapLibre adapter, acquisition footprints, selected browse preview, area search |
| `src/features/analysis/realtime.ts` | Auto footprint/pair selection, acquisition series and pulled-data context |
| `src/features/analysis/narrative.ts` | Groq vision/facts narrative with deterministic template fallback |
| `src/features/comparison/useBrowseComparison.ts` | Cached client-side browse-image difference for the selected pair |
| `src/features/comparison/` | Swipe / side-by-side / single / difference modes, compatibility rules |
| `src/features/analysis/analysisBundle.ts`, `AnalysisPanel.tsx` | **Deleted**: legacy pre-generated bundle UI (bundles remain on disk, unused by the explorer) |
| `src/features/explorer/useExplorerState.ts` | Shareable URL state |
| `src/features/evidence/EvidenceDrawer.tsx` | Summary / comparison / chart / context / sources tabs |
| `src/features/argus/Argus.tsx` | Guided assistant panel |
| `src/features/timeline/ObservationTimeline.tsx` | Acquisition ticks and playback |
| `src/domain/module-registry.ts` | Module definitions, layer ids, observed/context/cannot-prove statements |
| `src/domain/catalogue.ts` | Shared catalogue query/result contract |
| `backend/api/src/` | Cloudflare Worker: providers, cache, routes |
| `backend/api/README.md` | API contract and the cloud deployment procedure |
| `tools/analysis/` | Offline NISAR GCOV extraction + analysis pipeline (`analyze.py` builds the bundles) |
| `public/analysis/<site>/` | Committed manifests + Int16 rasters (~30.9 MB total) |
| `docs/backend/catalogue-plan.md` | Completed plan for catalogue module 1 + the module 2 direction |
| `plan.md` | Original design/architecture plan (phases 0–9) |
| `.github/workflows/deploy.yml` | GitHub Pages build + deploy; triggers on `main` only |
| `.github/workflows/backend-checks.yml` | CI for `development` pushes and PRs to `main`/`development` |

---

## 13. Do not

- Do not commit `.env.analysis` or any Earthdata token.
- Do not treat `VITE_GROQ_API_KEY` as secret: `VITE_` values ship in the client bundle. Use a Worker
  proxy before any public production deployment.
- Do not force-push `main` or rewrite `83d39cd`; `main` is the published branch.
- Do not merge `development` into `main` with a merge commit — fast-forward only, so Pages stays deployable.
- Do not delete or rewrite the `public/analysis` bundles without regenerating them from the pipeline.
- Do not soften any limitation, uncertainty or "this cannot prove" statement to make a number look better.
- Do not enable paid Cloudflare plans or other billable services without the owner's approval.
