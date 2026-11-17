# EarthEyes Sitewide Overhaul Plan

**Goal:** Turn the verified Kuakata pipeline into an honest, durable, polished sitewide product before a long maintenance pause.

**Architecture:** Keep the existing React 19/Vite architecture, visual language, and scientific contracts. Concentrate changes in the shared shell, editorial routes, and explorer state language; add no dependencies and no new processing.

**Tech Stack:** React 19, React Router, TanStack Query, Radix, MapLibre, Zod, Vitest, Playwright, Python pipeline.

**Spec:** This plan is its own design record; the binding scientific contract remains `docs/backend/calibrated-work.md` and `tools/analysis/README.md`.

## Global Constraints

- No commits, pushes, deployments, or secret changes.
- Preserve dirty worktree and user-owned PDF/JPEG/conversation files.
- Kuakata is the only published v3 study. It is exploratory, not validated ground truth.
- Calibrated source product is not validation of an EarthEyes result.
- Sensitivity range is not a confidence interval; zero retained area is not proof of no change.
- Preserve 208 existing tests' intent; update only assertions whose behavior intentionally changes.
- No new runtime dependencies.

## Review Focus

- A visitor with no catalogue access must still reach the published study.
- Failure states must never say "live", "pulling", or "copied" when untrue.
- Malformed URL fragments and unknown routes must not crash the shell.
- Video must be pausable and respect reduced motion.
- Mobile navigation and explorer sheets must remain keyboard-operable.

## Tasks

### Task 1: Shared shell and navigation

**Files:** `src/app/AppShell.tsx`, `src/styles/shell.css`, `src/app/AppShell.test.tsx`
- Add Kuakata pilot footer/navigation path with an accurate data-boundary line.
- Add a mobile "Inspect Kuakata pilot" action.
- Verify skip link, focus, and 44px targets.

### Task 2: Homepage evidence band and video control

**Files:** `src/routes/landing/LandingPage.tsx`, `src/styles/routes.css`, `src/routes/landing/LandingPage.test.tsx`
- Add a fixed-epoch Kuakata pilot band as the signature anchor.
- Add hero secondary CTA to the exact pilot URL.
- Replace the uncontrolled background video with pause/play control (hidden under reduced motion).
- Correct preview-only copy.

### Task 3: Truthful explorer states and identity

**Files:** `src/routes/explore/ExplorerPage.tsx`, `src/styles/explorer.css`, focused tests if present
- Preserve the reference place name when the bbox matches that place.
- Derive archive pill/status/hint from pending, error, empty, ready states.
- Report native share vs clipboard copy correctly; fall back safely.
- Add a Published study badge when a calibration bundle is active.

### Task 4: Route resilience and metadata

**Files:** `src/app/RouteAnnouncer.tsx`, `src/app/RouteAnnouncer.test.tsx`, `src/app/ErrorBoundary.tsx`, `src/app/router.tsx`, `src/styles/base.css`, `index.html`
- Safe URI decoding, better titles/descriptions, hash scrolling.
- Recoverable 404 and error pages with the pilot link.
- Social metadata and accurate description.

### Task 5: About/footer narrative accuracy

**Files:** `src/routes/about/AboutPage.tsx`, `src/routes/editorial.test.tsx`, `src/app/AppShell.tsx`
- State that the Kuakata pilot is connected; keep limits explicit.
- Keep existing boundary test strings.

### Task 6: Verification and handoff

- Update Playwright visual baselines intentionally.
- Run Vitest, typecheck, lint, production build, Python suite, API dry-run, targeted and full browser checks.
- Capture/inspect desktop and mobile screenshots.
- Append final status to `docs/backend/calibrated-work.md`; leave localhost running and open Firefox.
