Direction Locked  
- Product: short editorial landing page plus dedicated map-first explorer.  
- Visual style: elevated field atlas: warm, distinctive, scientific, restrained.  
- Ice hazard scope: GLOF, meaning glacial lake outburst flood.  
- Build scope: backend-ready UI using typed mock APIs before real services are connected.  
Current Problems  
The current design is attractive, but several structural issues prevent it from becoming the required product:  
Current experience  
Long scrolling presentation  
Five-place dropdown  
Static photograph presented as a map  
Dates mostly change labels  
Same image shown twice  
Swipe comparison only  
Generic metrics  
Fixed event-context cards  
GroundLine mixed into explorer  
Fixed Argus launcher  
2,600+ line App.tsx  
Repeated prototype disclaimers  
The comparison interaction is currently the strongest part. It should remain, but become one mode inside a complete observation workspace.  
Reference Strategy  
ReferenceWhat EarthEyes should borrow  
21st.devCarefully selected command search, sheets, tabs, dialogs, skeletons, status indicators, empty states, and responsive panel primitives  
BenchoImage compare physics, time scrubber, resizable panels, command interactions, and high-quality microinteractions  
NASA Earthdata SearchDataset filtering, spatial search, coverage states, result metadata, and provenance  
ASF VertexSAR-specific observation selection, scene footprints, acquisition metadata, and map-driven search  
Current EarthEyesField-atlas identity, evidence philosophy, comparison interaction, methodology, stories, and transparent prototype status  
Components will be adapted into EarthEyes rather than installed blindly. Bencho-style animation will be reserved for interactions where motion communicates meaning.  
Information Architecture  
/                         Polished landing page  
/explore                  Global explorer  
/explore/:placeId         Shareable selected location  
/stories/:storySlug       Guided case studies  
/methodology              Scientific workflow and limitations  
/data-sources             Dataset catalogue  
/data-sources/:sourceId   Detailed source metadata  
/groundline               Warning-system case study  
/about                    Team, challenge, mission, prototype state  
Every explorer state becomes shareable through URL parameters:  
/explore/jakobshavn-glacier  
?module=ice  
&mode=swipe  
&left=observation-id  
&right=observation-id  
&layers=velocity,boundary,temperature  
This enables refresh, browser history, bookmarking, sharing, and reproducible investigations.  
Landing Page  
The landing page becomes shorter and more purposeful.  
1. Compact hero with one clear statement and one primary CTA.  
2. Interactive miniature globe or map preview.  
3. Two primary module cards: Coastal Change and Ice Change.  
4. Featured investigations: Kuakata, Barishal, Jakobshavn.  
5. Three-step explanation: Find place → Compare dates → Understand evidence.  
6. GroundLine case-study preview.  
7. Scientific trust principles.  
8. Data-source strip.  
9. Final explorer CTA.  
The landing page should explain the mission without forcing regular users to scroll through the entire product.  
Explorer Layout  
Desktop  
┌──────────────────────────────────────────────────────────────┐  
│ Header / Search / Share / Data status / Argus               │  
├───────────────┬─────────────────────────┬────────────────────┤  
│ Control rail  │                         │ Evidence drawer    │  
│               │                         │                    │  
│ Location      │       Live map          │ Summary            │  
│ Phenomenon    │                         │ Comparison         │  
│ Dates         │                         │ Charts             │  
│ Layers        │                         │ Context            │  
│ Display mode  │                         │ Sources            │  
├───────────────┴─────────────────────────┴────────────────────┤  
│ Observation timeline / playback / available scenes          │  
└──────────────────────────────────────────────────────────────┘  
- Left and right panels are collapsible and resizable.  
- The map remains visible while users inspect charts or evidence.  
- Comparison can expand into a distraction-free workspace.  
- Source attribution and legends remain permanently accessible.  
- The current long stack of cards becomes tabs and drawers connected to map state.  
Tablet  
- Full map remains central.  
- Controls open as a left drawer.  
- Evidence opens as a right drawer.  
- Only one drawer remains open when space is limited.  
- Timeline remains attached to the map.  
Mobile  
- Map occupies most of the viewport.  
- Search and module selection remain visible.  
- Controls and evidence use a snap-point bottom sheet.  
- Comparison opens in a dedicated full-screen view.  
- Argus becomes a bottom sheet instead of a draggable desktop window.  
- Safe areas and mobile keyboards are explicitly handled.  
Central User Journey  
 1. User searches “Kuakata, Bangladesh,” “Barishal,” or “Jakobshavn Glacier.”  
 2. Search result shows place type, country, supported modules, and observation coverage.  
 3. Map smoothly fits the selected region.  
 4. User selects Coastal Change, Ice Change, or GLOF context.  
 5. Available acquisition dates load from the selected source.  
 6. EarthEyes suggests a useful comparison pair and explains why.  
 7. User selects Swipe, Side-by-side, Single, or Difference mode.  
 8. Relevant overlays appear with legends, units, source, and uncertainty.  
 9. Evidence drawer presents observations, metrics, charts, nearby population, and context.  
10. “What we observed,” “Possible explanations,” and “What this cannot prove” remain visually separate.  
11. User opens exact sources, asks Argus for explanation, or shares the URL.  
A first-time user should complete this journey in under one minute without needing the methodology page.  
Global Search And Map  
Location Search  
The search experience will support:  
- Place names.  
- Districts and administrative regions.  
- Glaciers, lakes, and coastal features.  
- Coordinates.  
- Recent searches.  
- Curated investigations.  
- Keyboard navigation.  
- Loading, no-result, limited-coverage, and offline states.  
Search results will indicate module availability before selection.  
Real Map Foundation  
Use MapLibre GL behind an EarthEyes-owned adapter.  
The map will support:  
- Global-to-local navigation.  
- Pan, zoom, fit bounds, and reset.  
- Search-result footprints.  
- Observation footprints.  
- Raster imagery and Cloud Optimized GeoTIFF-derived tiles.  
- Vector layers, heatmaps, boundaries, settlements, and population grids.  
- Map click and feature inspection.  
- Real attribution.  
- Keyboard-accessible feature list.  
- Textual alternatives for nonvisual users.  
The map library will remain isolated so it can be replaced without rewriting the explorer.  
Observation And Comparison System  
Display Modes  
- Swipe: current jelly divider, using two real aligned observations.  
- Side-by-side: synchronized cameras, optional unlinking.  
- Single observation: no hidden or manufactured comparison.  
- Difference view: derived change visualization with explicit methodology.  
- Overlay fade: optional opacity transition for dense imagery.  
Date Selection  
- Actual acquisition timestamps instead of universal year lists.  
- Date availability tied to selected place and source.  
- Mission coverage and revisit intervals.  
- Unavailable dates disabled.  
- Observation-quality indicators.  
- Recommended comparison pairs.  
- Range selection for trend analysis.  
Timeline  
The Bencho-inspired time scrubber will include:  
- Acquisition ticks.  
- Product-quality state.  
- Event markers.  
- Gaps and unavailable periods.  
- Multi-date playback.  
- Current observation metadata.  
- Keyboard controls.  
- Reduced-motion mode.  
- aria-valuetext announcing real acquisition dates.  
Comparison Requirements  
Every pair must expose:  
- Acquisition date and time.  
- Platform and instrument.  
- Orbit direction.  
- Polarization.  
- Processing level.  
- Resolution.  
- Coverage overlap.  
- Alignment quality.  
- Source identifier.  
- Observed, derived, or modeled state.  
- Known limitations.  
Incompatible observations cannot be compared silently.  
Module A: Coastal Change  
Controls  
- Shoreline movement.  
- Temporary inundation.  
- Potential persistent coastal loss.  
- Land subsidence.  
- Exposed settlements.  
- Population context.  
- SAR imagery.  
- Altimetry context.  
- Tide and surge context where available.  
Evidence Drawer  
- Observed shoreline displacement.  
- Potential inundated area.  
- Subsidence estimate.  
- Nearby population and settlements.  
- Sea-level context chart.  
- Comparison dates and sources.  
- Confidence and uncertainty.  
- Short public explanation.  
Scientific Communication  
Every result follows this structure:  
Observed  
SAR imagery indicates movement or surface-water change.  
   
Context  
Altimetry, tide, surge, weather, and vertical-land-motion data.  
   
Possible explanations  
Erosion, flooding, sediment change, subsidence, construction, or processing artifacts.  
   
Not proven  
SAR shoreline movement alone does not prove sea-level rise caused the change.  
NISAR observations and sea-level altimetry will never be presented as the same measurement.  
Module B: Ice Change  
Jakobshavn Glacier becomes the featured case study.  
Layers  
- SAR observation imagery.  
- Glacier velocity heatmap.  
- Direction vectors.  
- Ice-front boundaries.  
- Displacement.  
- Elevation.  
- Temperature context.  
- Quality masks.  
- Observation footprints.  
Evidence  
- Displacement statistics.  
- Velocity change.  
- Affected area.  
- Boundary movement where classification is reliable.  
- Multi-date movement timeline.  
- Source and processing details.  
- Uncertainty and quality flags.  
GLOF Context  
GLOF will remain separate from ordinary glacier-change interpretation.  
Layers  
- Glacial lakes.  
- Lake-area history.  
- Glacier boundaries.  
- Elevation and slope.  
- Potential downstream paths.  
- Exposed settlements.  
- Authority-validated assessments.  
Safety Rule  
Satellite-detected lake or glacier change may create an internal review candidate. It must not automatically become a public warning.  
The workflow is:  
Automated threshold  
→ analyst review  
→ supporting evidence  
→ responsible authority approval  
→ public SMS/voice alert  
Scientific Trust Model  
Every data object will carry a visible classification:  
State  
Observed  
Derived  
Modeled  
Context  
Interpretation  
Authority alert  
Every metric and layer must expose:  
- Value and unit.  
- Spatial area.  
- Effective date range.  
- Source products.  
- Processing version.  
- Quality state.  
- Uncertainty.  
- Citation.  
- Updated time.  
The UI will never replace unavailable live values with sample values without changing the entire data-state indicator.  
GroundLine Warning Experience  
GroundLine moves to its own route.  
Public Experience  
- Active authority-issued alerts.  
- Plain-language SMS preview.  
- Voice-message preview.  
- Area and village selection.  
- Language selection.  
- Severity, certainty, urgency, and expiry.  
- Instructions and authority source.  
- No app required for recipients.  
Subscription Experience  
- E.164 phone formatting.  
- SMS, voice, or both.  
- Area subscriptions.  
- OTP confirmation.  
- Consent and privacy statement.  
- Preference editing.  
- Unsubscribe flow.  
- Delivery status.  
Operational Boundary  
EarthEyes can automate detection and prioritization, but public messages require validated thresholds and authority approval.  
Argus Redesign  
Desktop States  
Minimized  
Floating  
Docked left  
Docked right  
Expanded  
Floating Behavior  
- Drag from the header.  
- Clamp inside the visible viewport.  
- Snap to nearby edges.  
- Avoid covering map attribution and primary controls.  
- Resize within defined limits.  
- Remember position and dock state per viewport.  
- Reset-position action.  
- Minimize and close controls.  
- Re-clamp after browser resize.  
Pointer movement will update a transform imperatively and commit position only after dragging, avoiding full React rerenders on every pixel.  
Mobile Behavior  
- No arbitrary floating window.  
- Opens as an accessible bottom sheet.  
- Uses dynamic viewport units.  
- Accounts for keyboard and safe-area insets.  
- Restores focus to the launcher after closing.  
Assistant Content  
Argus will receive a structured context snapshot:  
- Place.  
- Module.  
- Observation IDs.  
- Active layers.  
- Selected feature.  
- Dates.  
- Metrics.  
- Provenance.  
Responses will provide source links and dates. Argus will never issue operational warning advice.  
Until a real AI service exists, it will use transparent guided actions:  
- Explain this layer.  
- Explain this value.  
- Show uncertainty.  
- Show source.  
- Why is this not proof?  
- Open methodology.  
Visual System  
Brand Direction  
Preserve:  
- Warm paper canvas.  
- Forest-green primary surfaces.  
- Lime signal accent.  
- Coral event accent.  
- Technical mono details.  
- Survey lines, contours, and orbit motifs.  
Improve:  
- Higher text and focus contrast.  
- Fewer arbitrary border radii.  
- Fewer tiny uppercase labels.  
- More deliberate visual hierarchy.  
- Less repeated prototype prose.  
- Clearer semantic color roles.  
- Consistent panel and card structure.  
Typography  
- Manrope for display headings.  
- DM Sans for body and controls.  
- DM Mono for metadata only.  
- Self-hosted and subset fonts.  
- 12px minimum metadata.  
- 14–16px control labels.  
- 16–18px body copy.  
- Controlled line length for explanations.  
Color Roles  
Separate tokens will exist for:  
- Brand surfaces.  
- Primary text.  
- Secondary text.  
- Interactive controls.  
- Focus indicator.  
- Observed data.  
- Derived data.  
- Modeled data.  
- Provisional data.  
- Validated data.  
- Warning.  
- Error.  
- Uncertainty.  
- Selected map features.  
All token combinations must pass WCAG 2.2 AA.  
Motion  
Use motion only for comprehension:  
- 140–220ms controls.  
- 300–450ms panel transitions.  
- Map fit-bound transitions.  
- Jelly comparison divider.  
- Timeline scrub feedback.  
- Loading skeletons.  
- Edge snap for Argus.  
Reduced-motion mode removes springs, glides, and smooth scrolling.  
Design System And UI Lab  
A Storybook-based UI lab will lock the interface before backend integration.  
Primitive Components  
- Button and icon button.  
- Input and search combobox.  
- Select and segmented control.  
- Toggle and checkbox.  
- Tooltip and popover.  
- Dialog, drawer, and bottom sheet.  
- Tabs.  
- Resizable panels.  
- Toast.  
- Skeleton.  
- Empty/error/no-coverage states.  
- Badge and data-state indicator.  
- Measurement card.  
- Source row.  
- Uncertainty summary.  
- Map legend.  
- Timeline.  
- Comparison viewer.  
- Chart shell.  
- Argus panel.  
Each component gets:  
- Desktop/mobile stories.  
- Keyboard examples.  
- Loading and error variants.  
- Long translated content.  
- Reduced-motion variant.  
- Automated accessibility checks.  
- Visual regression snapshots.  
Once these are stable, backend work should only replace repository adapters and fixtures.  
Frontend Architecture  
src/  
  app/  
    router  
    providers  
    shell  
    route-announcer  
    error-boundary  
   
  routes/  
    landing  
    explore  
    stories  
    methodology  
    data-sources  
    groundline  
    about  
   
  features/  
    explorer  
    map  
    search  
    timeline  
    comparison  
    evidence  
    coastal  
    ice  
    glof  
    events  
    argus  
    groundline  
   
  domain/  
    places  
    observations  
    layers  
    measurements  
    events  
    alerts  
    modules  
    provenance  
   
  shared/  
    ui  
    accessibility  
    formatting  
    validation  
   
  mocks/  
    places  
    observations  
    comparisons  
    events  
    alerts  
   
  styles/  
    tokens  
    typography  
    motion  
    map  
Tooling Plan  
Runtime  
- react-router-dom for real routes.  
- @tanstack/react-query for server state.  
- zod for runtime API validation.  
- maplibre-gl behind an internal adapter.  
- Select Radix/shadcn primitives for dialogs, sheets, popovers, tabs, and tooltips.  
- cmdk or an equivalent accessible command-search primitive.  
- react-resizable-panels for desktop workspace panels.  
Development  
- MSW for backend-compatible mock endpoints.  
- Storybook for component development and visual approval.  
- Vitest and Testing Library.  
- Playwright for real user workflows.  
- @axe-core/playwright for accessibility.  
- ESLint and explicit TypeScript checks.  
- Playwright visual snapshots.  
- Lighthouse CI performance budgets.  
No large template or animation package will be installed wholesale.  
Backend-Ready Contracts  
The frontend will initially consume MSW fixtures through the exact future API boundary.  
GET /places/search  
GET /places/:id  
GET /modules  
GET /observations  
GET /observations/:id  
GET /comparisons  
GET /timelines  
GET /layers  
GET /metrics  
GET /events  
GET /alerts  
POST /subscriptions  
Observation assets should be compatible with STAC concepts and Cloud Optimized GeoTIFF/raster-tile delivery.  
This lets frontend and backend proceed independently without redesigning UI states later.  
Execution Plan  
PhaseWork  
0. BaselineCapture current screenshots, characterize existing interactions, define API schemas  
1. FoundationsRouter, project structure, design tokens, primitives, Storybook, test setup, MSW  
2. Product shellLanding page, global navigation, route layouts, metadata, responsive shell  
3. Explorer coreMapLibre adapter, global search, module picker, URL state, resizable workspace  
4. ObservationsDate availability, timeline, scene metadata, loading/error/no-coverage states  
5. ComparisonSwipe, side-by-side, single, difference, synchronized map cameras  
6. ModulesCoastal, Ice, GLOF, event context, evidence panels and charts  
7. ArgusFloating/docking desktop behavior, mobile sheet, contextual citations  
8. GroundLineAlert feed, thresholds, message previews, subscription UI  
9. HardeningAccessibility, localization readiness, performance, visual regression, browser testing  
User Simulation Plan  
PersonaTest task  
General visitorSearch Kuakata and compare coastal dates  
StudentExplain what changed and what is uncertain  
Cryosphere researcherInspect Jakobshavn velocity and source metadata  
Community officialReview a GLOF candidate and warning status  
Feature-phone recipientUnderstand an SMS/voice warning preview  
Keyboard userComplete search, date selection, comparison, and source inspection  
Mobile userComplete the full journey at 360px  
Low-bandwidth userUse summary and alerts without heavy imagery  
I will manually act through these flows in Firefox and Chromium after each major phase, not only inspect screenshots.  
Final Acceptance Criteria  
- Worldwide search and map navigation work.  
- Every supported place exposes only valid modules and dates.  
- Swipe and side-by-side comparison use distinct observations.  
- Timeline, map, metrics, events, and charts remain synchronized.  
- Coastal UI distinguishes SAR coastal observations from altimetry context.  
- Ice UI supports velocity, displacement, boundaries, elevation, and temperature.  
- GLOF context never becomes an unverified automated public warning.  
- Every metric has date, source, unit, quality, and uncertainty.  
- Argus floats, docks, minimizes, resizes, and adapts to mobile.  
- Explorer state is shareable and survives reload/back navigation.  
- WCAG 2.2 AA checks pass.  
- 320px–1920px layouts pass.  
- Reduced-motion and low-bandwidth modes work.  
- Storybook, unit tests, workflow tests, visual snapshots, and production build pass.  
- The backend can replace MSW repositories without changing the interface architecture.  
The key is to rebuild the explorer foundation rather than cosmetically restyle the existing monolith. This produces the polished interface you want while locking the frontend contract tightly enough that backend work can begin without repeated UI rewrites.  
