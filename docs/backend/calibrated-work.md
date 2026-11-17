# Calibrated Analysis Work Log

Scope approved in conversation: a generic offline pipeline, Bangladesh-first published
bundles, in-app evidence and Argus grounding. No on-demand queue, deployment, commit,
or GitHub push. Finish with localhost running in Firefox.

## Corrections To The Draft Plan

- Provider product maturity is separate from the quality of an EarthEyes result.
  Cross-sensor agreement is not ground-truth validation, and beta is not necessarily
  a newer or better release than provisional. Keep all of these statuses separate.
- Threshold sweeps are sensitivity ranges, not calibrated confidence intervals.
  Remove the invented pixel-independent mean error bar and guaranteed detection limit.
- NISAR numberOfLooks counts averaged radar-grid samples; it is not proven effective
  independent looks after geocoding. Use it only for an explicitly conditional noise
  model, with no assumed factor-squared or median-composite precision improvement.
- Do not infer incidence angle from the RTC gamma-to-sigma area factor or subtract
  thermal noise without verified product metadata. No corrections are applied twice.
- Check every source grid and quality mask, sum every retained cluster, and preserve
  spatial/temporal scope. Missing reference dates must remain visibly unchecked.
- Reuse the existing local extraction cache without treating its old grid signatures
  as independently verified. Publication requires matching geometry evidence; do not
  overwrite old cached data or publish an unverified bundle as validated.

## Progress

- Environment and bounded layer probe completed earlier; Kuakata has ten local dates.
- Resumed audit: discovery coverage arguments were reversed; grid check reused the
  reference grid; clusters were still truncated; external validation had not run.
- Current work: regression tests and pipeline corrections, followed by reference
  checks, bundle/API/UI integration, and local verification.
- First regression gate: 15 tests reproduced 11 failures and 4 errors, then passed
  after discovery coverage/grouping, full-coordinate signatures, per-source grid
  reads, local conditional log-Gamma thresholds, masked medians and complete totals.
- Ruling: retain this dirty development worktree and local ledger rather than create
  a worktree/commit workspace; moving the existing uncommitted extraction work would
  risk losing context. No commits or pushes.
- Provider XML confirms the subswath mask uses 0 for invalid and 255 for fill.
  Current inputDataExceptionMask is uint16 with low-byte anomaly flags and high-byte
  polarization validity bits; earlier products may use uint8 anomaly codes only.
  Inspect the actual dtype/metadata and preserve the source convention.
- Ruling: write verified extraction caches in a new v3/product directory, preserving
  the old caches. Reuse old power only when source, window and every quality sample
  are verified; otherwise re-read power. This costs bounded quality reads, not blind
  full-granule downloads.
- Ruling: replace hand-written projection equations with installed rasterio/GDAL;
  use local ellipsoidal equal-area cell weights, not projected spacing squared, for
  worldwide area totals. Reject oversized windows instead of silently cropping.
- Implemented the generic v3 bounded extractor/analyzer, exact bbox/date/product API
  matching, explicit unavailable UI state, and server-overridden Argus analysis fields.
- Two source dates were verified and safely migrated to v3 using existing cached power
  only after matching the source granule, polarization, source grid, ROI window and
  footprint. The remaining remote HDF5 reads exceeded the local run window; the
  requested 10-date series is incomplete and intentionally not published.
- Current Kuakata static manifest is now status `analysis_unavailable`; draft rasters
  were removed. The backend publication index is empty until an exact, complete,
  independently checked bundle is approved.
- Sentinel-2 STAC confirms 2026 imagery exists near the requested period; one Sentinel-1
  RTC item also exists. No aligned NDWI/S1 classifications, per-date completeness,
  maturity comparison or validation metrics have been computed. Keep validation
  unavailable; weather context is not causal validation.
- Verification so far: Python offline suite 21/21; backend suite 105/105; TypeScript
  typecheck clean. Full frontend suite hit one known 5-second timing flake (186/187);
  standalone reruns and build/lint/browser checks remain.

## Completed Pilot And Integration

- All ten Kuakata source dates are now in the verified v3 cache. Each reports full
  quality coverage over the ROI; source RTC is applied and source noise correction
  is not. All original caches were preserved.
- Fixed an additional publication regression: identical surfaces with different
  valid coverage falsely appeared as water loss. All dates/epochs now use the same
  common valid ground. Same-sign components cannot merge opposite changes to pass
  the area filter, and component IDs retain their original label identity.
- Added guarded local publication, a shared Zod contract, exact area/date/product/
  polarization matching, real JSON routing in Vite, calibrated-source overlays and
  time-series evidence. The display is reprojected to Web Mercator; measurement
  areas remain on ellipsoidal equal-area cells.
- Initial external checks encountered repeated signing failures. Ruling: cache only
  verified container-scoped SAS signatures until expiry, never tokens in artifacts.
  After rerunning, S1 compares 10/10 dates (mean IoU 0.784) and S2 compares 3/10
  (mean IoU 0.772). The remaining optical dates fail the eligibility/clear-coverage
  filters. Class agreement is not ground truth or validation of a change claim.
- CMR release availability checks found no same-mode matching dates in beta or
  standard GCOV. A radiometric release comparison remains unavailable, not zero error.
- Pilot: water-candidate delta -5.538 km2, threshold sensitivity -19.784 to 5.211
  km2 (direction not established); median brightness delta 0.38 dB; zero area retained
  at k=2.5, not proof of no change. These are exploratory, conditional estimates.
- Ruling: published-study Argus answers use server-owned deterministic templates,
  not a model asked to obey numeric constraints. The normal browse AI path remains.
  This avoids invented measurements and needs no Groq key for the published pilot.
- Additional portfolio regions and the legacy Jakobshavn artifact are not published
  as v3 studies. No rainfall attribution, ground-truth validation, queue, deployment,
  commit or push is supplied. Those limits remain explicit in the app and docs.
- Current verification: 33 offline regressions passed before the final credential-host
  guard test; 14 new frontend checks and 11 analysis/adapter checks passed. Full final
  test/build/browser verification follows; the stale earlier incomplete-pilot notes
  above record the previous state, not current coverage.

## Final Verification (2026-11-16)

- Fresh offline suite: `python -W ignore::PendingDeprecationWarning -m unittest
  discover -s tools/analysis -p test_*.py` passed 38/38 tests. Only the existing
  rasterio/affine deprecation warning was suppressed; failures were not filtered.
- Fresh full application suite: `npm test -- --maxWorkers=1` passed 208/208 tests
  across 21 files. `npm run typecheck` and `npm run lint` passed.
- `npm run check:api` completed the Wrangler bundle dry-run. Nothing was uploaded
  or deployed. The generated public and backend indexes match, contain only the
  complete Kuakata pilot, and retain the independent reference-check records.
- Fresh targeted browser run: `npx playwright test e2e/analysis.spec.ts
  e2e/argus.spec.ts --workers=1` passed all 9 checks in one run across Chromium,
  Firefox and mobile. This includes published evidence, map overlays, server-owned
  Argus answers, unavailable selections, accessibility and mobile overflow.
- The browser run built production assets successfully. The existing large-chunk
  warning remains. The full unrelated Playwright suite was not run.
- Earlier parallel runs suffered resource-related timeouts and one Firefox page
  crash. Serial verification and the fresh all-green browser run supersede those
  incomplete gates; no user browser processes were stopped.
- Final independent review found no critical issue. Its important migration,
  sensitivity-rounding and same-date coverage-selection findings were reproduced
  and fixed with regressions. All 10 pilot legacy windows passed the additional
  native-power-validity audit.
- Reanalysis now preserves reference evidence only for an identical manifest ID;
  the changed-identity case resets validation. Both paths have regression coverage.
- The sensitivity upper bound is now 5.211 km2 after delaying rounding; this
  supersedes the earlier 5.212 figure without changing the exploratory conclusion.
- `git diff --check` passed, with only generated-JSON line-ending notices. The
  development branch and all unrelated user files remain in place, uncommitted.
- Local handoff completed below; no implementation or verification step remains
  for the one-pilot scope recorded here.

## Local Handoff

- Detached Vite is listening only on `127.0.0.1:5173`, Node PID `3304` (launcher
  PID `16552`). It remained available after the launching tool exited and after
  opening Firefox. Logs are `E:\Temp_User\opencode\eartheyes-vite.log` and
  `E:\Temp_User\opencode\eartheyes-vite.err.log`; the error log is empty.
- Live HTTP smoke checks passed: health, explorer HTML, the exact 10-date analysis,
  and both versioned WebP rasters return 200. HH correctly returns unavailable;
  Argus returns server-owned `source: data` and ignores injected client measurements.
- Opened the exact pilot in a new tab of the installed Firefox, preserving the
  existing session. Its EarthEyes explorer window was confirmed responsive.
- Pilot URL: http://127.0.0.1:5173/explore/kuakata-bangladesh?bbox=90.0575,21.7524,90.2025,21.8876&start=2026-06-01&end=2026-10-31&product=nisar-gcov-provisional&pol=HVHV&module=coastal&view=map
- The server is intentionally left running. No commit, push, merge or deployment
  was made; HEAD remains `291e955601489c5a80a8890f2ec840b0a15b7690`.

## Sitewide Overhaul Verification (2026-11-16)

- Added the shared Kuakata pilot entry point across the homepage, mobile navigation,
  footer, error recovery and published-analysis empty state. The homepage now labels
  the ten-date Kuakata study as exploratory derived evidence and keeps its validation
  boundary visible.
- Added an accessible background-video pause/play control, route-aware titles and
  descriptions, safe malformed-URI handling, hash scrolling, a recoverable 404 page,
  truthful archive/loading/error labels, native-share feedback, and social metadata.
- Corrected the explorer pilot route so its bounded Kuakata footprint keeps the
  Kuakata identity while still sending the exact analysis bounds to the published
  analysis endpoint.
- Fresh application suite: `npm test -- --maxWorkers=1` passed 214/214 tests across
  22 files. `npm run typecheck`, `npm run lint`, and `npm run build` passed.
- `npm run check:api` passed the Wrangler dry-run at 841.38 KiB / gzip 136.77 KiB.
  The existing large-chunk warning remains from the map bundle.
- Fresh Python analysis suite passed 38/38 tests.
- Chromium browser suite passed 37 tests with 5 intentional project skips. Targeted
  Firefox and mobile runs passed 28 tests with 10 intentional skips. The visual landing
  baseline was regenerated after inspection; desktop and mobile screenshots were
  inspected at 1440x900 and 390x844.
- Final review corrected the About page's epoch-median wording and improved the
  study badge contrast. The 11 editorial unit checks and lint passed afterward;
  desktop and mobile explorer screenshots were recaptured and inspected.
- Local Vite was restarted for the final handoff on `127.0.0.1:5173`, Node PID
  `25056`, launcher PID `6848`. Logs remain at `E:\Temp_User\opencode\eartheyes-vite.log` and
  `E:\Temp_User\opencode\eartheyes-vite.err.log`.
- Opened the exact Kuakata pilot in Firefox again for this handoff.
- No commit, push, merge or deployment was made. The final site remains local-only.
