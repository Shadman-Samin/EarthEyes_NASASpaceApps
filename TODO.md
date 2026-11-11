# EarthEyes — Remaining Work

Hand-off document for the next person picking up the project.
Written **12 November 2026** at the end of the Phase 3 session.

- Repository: <https://github.com/Shadman-Samin/EarthEyes_NASASpaceApps>
- Working branch: `development` (HEAD `2eac270`, tracks `origin/development`)
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
| Calibrated offline change analysis for two sites (`public/analysis/kuakata-bangladesh`, `public/analysis/jakobshavn-glacier`) | Done |
| GitHub Pages deploy workflow + CI workflow | Written; **CI on GitHub has never been observed, Pages has never received the new build** |

### 0.2 Verified baseline (reproduce before changing anything)

| Command | Expected result |
| --- | --- |
| `npm ci` | Clean install, Node 22.12+ required |
| `npm run lint` | Clean |
| `npm run typecheck` | Clean |
| `npm test` | **150 passed / 13 files** (60 frontend in 9 files, 90 backend in 4 files) |
| `npm run test:backend` | **90 passed / 4 files** |
| `npm run build` | Succeeds, **emits a chunk-size warning** (see 5.1) |
| `npm run build-storybook` | Succeeds |
| `npm run test:e2e` | **37 passed, 26 skipped** — skips are project-scoped by design, not broken (see 11.3) |
| `npm run lighthouse` | Not run yet — no recorded baseline (see 5.3) |

### 0.3 Recent commits on `development`

```
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
  - [ ] Kuakata and Jakobshavn load their calibrated analysis panel; switching the date pair updates the
        prose, the metrics and the delta raster (each pair has its own `delta_url` and `story`).
  - [ ] Difference mode renders for a live same-family pair.
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

- [ ] **4.1 Missing sentence break in the per-pair story** (real, user-visible).
  `tools/analysis/analyze.py:328` builds `f"in {n_clusters} clusters{top_txt}"`, and `top_txt` starts with a
  space, so the generated sentence reads
  `…between the two dates, in 24 clusters The largest changed cluster covers 8.2 km².`
  Fix the punctuation, regenerate the bundles, and re-check the rendered copy in the analysis panel.
- [ ] **4.2** After 4.1 the regenerated `manifest.json` files change → the whole `public/analysis/**` tree
  changes (36 files, ~30.9 MB). Review the diff carefully, confirm the numbers did not move, and check the
  manifest with `node -e "JSON.parse(require('fs').readFileSync('public/analysis/kuakata-bangladesh/manifest.json','utf8'))"`.
- [ ] **4.3** Pair-level stories for the ice site omit the **persistent-cluster** information that the
  season-level story carries. Decide whether a pair story should mention how many clusters change
  persistently, and make the two consistent.
- [ ] **4.4** Consider adding the **1.5 dB change threshold** to the per-pair prose. The panel already shows
  manifest-level limitations and the provisional-calibration note, but the threshold itself is only in the
  JSON, not in the sentence a user reads.
- [ ] **4.5** Double-check the **unit rendering**: `km²` and `—` are UTF-8 in the manifest and in the app.
  If a Windows console shows `km?`, that is the console code page, not the file. Verify by reading the JSON
  with Node, not by eye in PowerShell.
- [ ] **4.6** Empty, untracked directory `src/routes/catalogue/` exists locally and is not part of the
  project. Delete it locally; nothing to commit.

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
- [ ] **5.6 Add `.gitattributes`** with `* text=auto eol=lf` and the binary extension list (`*.i16`,
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
- [ ] **8.3 Evidence drawer charts** — the registry declares a `chart` tab; check whether it renders real
  charts (water-area time series exists in the manifest) or a placeholder.
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
- [ ] **9.6** Delete the empty local `src/routes/catalogue/` directory (see 4.6).
- [ ] **9.7** Review `public/analysis/*/manifest.json` `limitations` arrays and the app copy for scientific
  honesty one more time before the submission deadline.

---

## 10. Definition of done for a change

- [ ] `npm run lint` clean.
- [ ] `npm run typecheck` clean.
- [ ] `npm test` green (expect 150 tests; add yours).
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
| `src/features/map/EarthMap.tsx` | MapLibre adapter, raster overlays, delta-raster loading, object-URL lifecycle |
| `src/features/analysis/analysisBundle.ts` | Zod manifest contract (each pair needs `delta_url` + `story`) |
| `src/features/analysis/AnalysisPanel.tsx` | Pair-specific prose, metrics, limitations |
| `src/features/comparison/` | Swipe / side-by-side / single / difference modes, compatibility rules |
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
- Do not force-push `main` or rewrite `83d39cd`; `main` is the published branch.
- Do not merge `development` into `main` with a merge commit — fast-forward only, so Pages stays deployable.
- Do not delete or rewrite the `public/analysis` bundles without regenerating them from the pipeline.
- Do not soften any limitation, uncertainty or "this cannot prove" statement to make a number look better.
- Do not enable paid Cloudflare plans or other billable services without the owner's approval.
