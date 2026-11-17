import * as Dialog from "@radix-ui/react-dialog"
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useInfiniteQuery, useQuery, useQueryClient } from "@tanstack/react-query"
import { Group, Panel, Separator } from "react-resizable-panels"
import { useLocation, useParams, useSearchParams } from "react-router-dom"
import { moduleIdSchema, type LayerDefinition, type ModuleId, type Place } from "../../domain/models"
import { catalogueBoundsSchema, catalogueProductIdSchema, catalogueQuerySchema, type CatalogueBounds, type CatalogueProductId, type CatalogueSearchResult } from "../../domain/catalogue"
import { moduleRegistry } from "../../domain/module-registry"
import { usePlace } from "../../data/queries"
import { catalogueItemKey, fetchCatalogue } from "../../data/catalogue"
import { fetchAnalysis } from "../../data/analysis"
import type { AnalysisQuery } from "../../domain/analysis"
import { CalibratedAnalysis, type AnalysisOverlayMode } from "../../features/analysis/CalibratedAnalysis"
import { acquisitionGroup, acquisitionGroupLabel, catalogueObservation, nisarSource, operaSource, type NisarPolarization, type NisarProductKey } from "../../data/live-explorer"
import { bestGroup, buildRealtimeContext, buildSeries, pickBestPair } from "../../features/analysis/realtime"
import { useBrowseComparison } from "../../features/comparison/useBrowseComparison"
import { ComparisonViewer } from "../../features/comparison/ComparisonViewer"
import { EvidenceDrawer } from "../../features/evidence/EvidenceDrawer"
import { Argus } from "../../features/argus/Argus"
import { ExplorerControls } from "../../features/explorer/ExplorerControls"
import { useExplorerState } from "../../features/explorer/useExplorerState"
import { PlaceSearch } from "../../features/search/PlaceSearch"
import { ObservationTimeline } from "../../features/timeline/ObservationTimeline"
import { Button, Icon, Skeleton, StatePanel } from "../../shared/ui"
import { useMediaQuery } from "../../shared/useMediaQuery"
import { formatDate } from "../../shared/formatting"

type MobileSheet = "controls" | "evidence" | "comparison" | null

function archiveWindow(product: CatalogueProductId) {
  if (product.startsWith("nisar")) return { start: "2026-01-01", end: new Date().toISOString().slice(0, 10) }
  return { start: "2024-05-01", end: "2024-05-31" }
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch { /* fall back to a temporary selection */ }
  }
  const area = document.createElement("textarea")
  area.value = text
  area.setAttribute("readonly", "")
  area.style.position = "fixed"
  area.style.opacity = "0"
  document.body.append(area)
  area.select()
  try {
    return document.execCommand("copy")
  } catch {
    return false
  } finally {
    area.remove()
  }
}

const EarthMap = lazy(() => import("../../features/map/EarthMap").then((module) => ({ default: module.EarthMap })))

function ExplorerWorkspace({ place }: { place: Place }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const { pathname } = useLocation()
  const queryClient = useQueryClient()
  const requestedModule = moduleIdSchema.safeParse(searchParams.get("module"))
  const moduleId: ModuleId = requestedModule.success && place.moduleIds.includes(requestedModule.data) ? requestedModule.data : place.moduleIds[0]
  const requestedProduct = catalogueProductIdSchema.safeParse(searchParams.get("product"))
  const product: CatalogueProductId = requestedProduct.success ? requestedProduct.data : "nisar-gcov-provisional"
  const isNisar = product.startsWith("nisar")
  const polarization: NisarPolarization = searchParams.get("pol") === "HHHH" ? "HHHH" : "HVHV"
  const windowDefaults = archiveWindow(product)
  const activeSource = isNisar ? nisarSource(product as NisarProductKey) : operaSource
  const parsedQuery = catalogueQuerySchema.safeParse({ product, bbox: place.bounds, start: searchParams.get("start") ?? windowDefaults.start, end: searchParams.get("end") ?? windowDefaults.end, limit: 20 })
  const query = parsedQuery.success ? parsedQuery.data : null
  const analysisQuery: AnalysisQuery | null = query ? { product, bbox: query.bbox, start: query.start, end: query.end,
    ...(isNisar ? { polarization: polarization === "HHHH" ? "HH" : "HV" } : {}) } : null
  const [analysisOverlayMode, setAnalysisOverlayMode] = useState<AnalysisOverlayMode>("water")
  const calibrated = useQuery({
    queryKey: ["published-analysis", analysisQuery], enabled: analysisQuery !== null, retry: false, staleTime: 300_000,
    queryFn: ({ signal }) => fetchAnalysis(analysisQuery!, signal),
  })
  const bundle = calibrated.data?.status === "analysis_available" ? calibrated.data.manifest : undefined
  const overlayKind = analysisOverlayMode === "water" && !bundle?.raster?.water_change_url ? "delta" : analysisOverlayMode
  const overlayPath = overlayKind === "water" ? bundle?.raster?.water_change_url : bundle?.raster?.delta_url
  const analysisOverlay = bundle?.raster && overlayKind !== "off" && overlayPath ? {
    id: `${bundle.id}-${overlayKind}`, kind: overlayKind, coordinates: bundle.raster.coordinates,
    url: `${import.meta.env.BASE_URL.replace(/\/$/, "")}${overlayPath}`,
  } : undefined
  const archive = useInfiniteQuery({
    queryKey: ["explorer-catalogue", query], enabled: query !== null,
    initialPageParam: [] as CatalogueSearchResult["next"],
    queryFn: ({ pageParam, signal }) => {
      if (!query) throw new Error("Choose valid bounds and a start date before the end date.")
      return Promise.all((pageParam.length ? pageParam.map((partition) => ({ ...query, ...partition })) : [query]).map((request) => fetchCatalogue(request, signal)))
    },
    getNextPageParam: (pages) => { const next = pages.flatMap((page) => page.next); return next.length ? next : undefined },
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false, staleTime: 300_000,
  })
  const autoPageCount = archive.data?.pages.length ?? 0
  useEffect(() => {
    // Pull a few pages automatically so a place has several dates to compare, not just the first page.
    if (!archive.hasNextPage || archive.isFetching || autoPageCount >= 3) return
    void archive.fetchNextPage()
  }, [archive, autoPageCount])
  const pages = useMemo(() => archive.data?.pages.flat() ?? [], [archive.data])
  const items = useMemo(() => [...new Map(pages.flatMap((page) => page.items).map((item) => [catalogueItemKey(item), item])).values()], [pages])
  const groups = useMemo(() => [...new Set(items.map(acquisitionGroup))], [items])
  const requestedGroup = searchParams.get("burst")
  const requestedItem = items.find((item) => item.id === searchParams.get("right")) ?? items.find((item) => item.id === searchParams.get("left"))
  const autoGroup = useMemo(() => bestGroup(items), [items])
  const group = requestedGroup ?? (requestedItem ? acquisitionGroup(requestedItem) : autoGroup || groups[0] || "")
  const groupItems = useMemo(() => items.filter((item) => acquisitionGroup(item) === group).sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt)), [items, group])
  const observations = useMemo(() => {
    // One comparable observation per acquisition day; duplicate products on the same pass
    // must not become a fake "before/after" pair. Prefer the record that has a preview.
    const byDay = new Map<string, ReturnType<typeof catalogueObservation>>()
    for (const item of groupItems) {
      const observation = catalogueObservation(item, place.id, moduleId, { polarization })
      const day = observation.acquiredAt.slice(0, 10)
      const existing = byDay.get(day)
      if (!existing || (!existing.imageUrl && observation.imageUrl)) byDay.set(day, observation)
    }
    return [...byDay.values()]
  }, [groupItems, place.id, moduleId, polarization])
  const layers: LayerDefinition[] = useMemo(() => [
    { id: "acquisition-footprint", moduleId, label: "Acquisition footprints", description: "Loaded acquisition areas.", classification: "observed", quality: "validated", sourceId: activeSource.id, unit: null, color: "#3ca9ad", defaultEnabled: true },
    { id: "sar-preview", moduleId, label: "SAR browse overlay", description: "Official browse image draped over the acquisition footprint (approximate placement, not georeferenced).", classification: "observed", quality: "validated", sourceId: activeSource.id, unit: null, color: "#c8e56b", defaultEnabled: true },
  ], [moduleId, activeSource.id])
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)
  const mobileSheetTrigger = useRef<HTMLButtonElement | null>(null)
  const [shareStatus, setShareStatus] = useState("")
  const isDesktop = useMediaQuery("(min-width: 1100px)")
  const [formError, setFormError] = useState("")

  const state = useExplorerState({ place, observations, layers })
  const left = observations.find((observation) => observation.id === state.leftId)
  const right = observations.find((observation) => observation.id === state.rightId)
  const missingSelection = Boolean(archive.data && ((searchParams.has("burst") && !groups.includes(group)) || (searchParams.has("left") && !left) || (searchParams.has("right") && !right)))

  const bestPair = useMemo(() => pickBestPair(observations), [observations])
  const pairLeft = left ?? bestPair?.left
  const pairRight = right ?? bestPair?.right
  const comparedPair = useMemo(() => (pairLeft && pairRight ? { left: pairLeft, right: pairRight } : null), [pairLeft, pairRight])
  const series = useMemo(() => buildSeries(observations), [observations])
  const rtContext = useMemo(() => buildRealtimeContext({ place, items, observations, group, query, compared: comparedPair }), [place, items, observations, group, query, comparedPair])
  const browse = useBrowseComparison(comparedPair?.left, comparedPair?.right)

  const chooseArea = (bbox: CatalogueBounds) => {
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("bbox", bbox.map((value) => Number(value.toFixed(5))).join(","))
      for (const key of ["burst", "left", "right"]) next.delete(key)
      return next
    })
  }
  const submitArchive = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const form = new FormData(event.currentTarget)
    const parsed = catalogueQuerySchema.safeParse({ product: form.get("product") ?? product, bbox: String(form.get("bbox")).split(",").map((value) => value.trim() ? Number(value) : NaN), start: form.get("start"), end: form.get("end"), limit: 20 })
    if (!parsed.success) { setFormError("Enter valid bounds and a start date before the end date."); return }
    setFormError("")
    void queryClient.resetQueries({ queryKey: ["explorer-catalogue", parsed.data], exact: true })
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("start", parsed.data.start); next.set("end", parsed.data.end); next.set("product", parsed.data.product)
      if (parsed.data.product.startsWith("nisar")) next.set("pol", polarization); else next.delete("pol")
      if (current.has("bbox") || parsed.data.bbox.some((value, index) => value !== place.bounds[index])) next.set("bbox", parsed.data.bbox.join(","))
      for (const key of ["burst", "left", "right"]) next.delete(key)
      return next
    })
  }

  const share = async () => {
    const url = new URL(window.location.href)

    url.searchParams.set("module", state.moduleId); url.searchParams.set("mode", state.mode); url.searchParams.set("view", state.view)
    if (query) { url.searchParams.set("start", query.start); url.searchParams.set("end", query.end); url.searchParams.set("bbox", query.bbox.join(",")) }
    url.searchParams.set("product", product)
    if (isNisar) url.searchParams.set("pol", polarization); else url.searchParams.delete("pol")
    if (group) url.searchParams.set("burst", group)
    if (state.leftId) url.searchParams.set("left", state.leftId)
    if (state.rightId) url.searchParams.set("right", state.rightId)
    try {
      if (navigator.share) {
        await navigator.share({ title: `EarthEyes / ${place.name}`, url: url.href })
        setShareStatus("Shared")
      } else {
        setShareStatus(await copyText(url.href) ? "Link copied" : "Copy unavailable")
      }
    } catch (error) {
      setShareStatus(error instanceof DOMException && error.name === "AbortError" ? "Share cancelled" : "Link not shared")
    }
    window.setTimeout(() => setShareStatus(""), 2400)
  }

  const waiting = query !== null && archive.isPending
  const failed = !query || archive.isError
  const archiveState = archive.isError ? "error" : archive.isPending || archive.isFetching ? "waiting" : items.length ? "live" : "empty"
  const archiveStatusText = archive.isError ? "unavailable" : archive.isPending || archive.isFetching ? "loading" : items.length ? `${items.length} records` : "none found"
  const dataStatus = archive.isError ? ["Archive unavailable", "error"] : archive.isPending || archive.isFetching ? ["Loading archive", "waiting"] : items.length ? ["Live archive", "live"] : ["No archive records", "empty"]
  const statusText = bundle && state.view === "map" ? `Published study: precomputed ${bundle.polarization} gamma0 analysis from ${bundle.dates.length} acquisitions. Exploratory result; sensitivity and reference coverage are in Summary.` : comparedPair ? `Real-time visual analysis: ${formatDate(comparedPair.left.acquiredAt)} → ${formatDate(comparedPair.right.acquiredAt)} (${observations.length} acquisitions)` : archive.isError ? "Archive request failed — adjust the dates or area to try again." : waiting || archive.isFetching ? "Loading real satellite records for this location…" : items.length ? `${items.length} acquisitions loaded — preparing analysis…` : "No radar records match this window."

  const controls = (
    <ExplorerControls
      dataOrigin="live" place={place} moduleId={state.moduleId} mode={state.mode} observations={observations}
      leftId={pairLeft?.id ?? state.leftId} rightId={pairRight?.id ?? state.rightId} layers={layers} activeLayers={state.activeLayers}
      onPlaceChange={state.setPlace} onModuleChange={state.setModule} onModeChange={state.setMode} onPairChange={state.setPair} onToggleLayer={state.toggleLayer}
      archive={(
        <section className="control-rail__section archive-search">
          <div className="archive-search__head">
            <h2 className="control-label"><Icon name="globe" size={16} /> Live radar data</h2>
            <span className={`archive-pill archive-pill--${archiveState}`}><i /> {archiveStatusText}</span>
          </div>
          <p className="archive-search__source"><strong>{activeSource.name}</strong><br />{query ? `${query.start} → ${query.end}` : "Waiting for a valid area"}</p>
          <p className="archive-search__hint">
            {archive.isError
              ? "The archive request failed. Adjust the dates or area and try again; no demo data is substituted."
              : items.length
                ? `${observations.length} acquisition date${observations.length === 1 ? "" : "s"} in the selected footprint (${items.length} records across ${groups.length} footprints). Summary, chart and comparison update automatically.`
                : archive.isPending || archive.isFetching
                  ? "Loading real NASA satellite records for this area. No demo data is substituted."
                  : "No radar records match this window. Try a wider date range, another product, or move the map."}
          </p>
          <details className="archive-search__filters">
            <summary>Advanced options (optional)</summary>
            <form key={`${place.bounds.join(",")}/${query?.start}/${query?.end}/${product}`} onSubmit={submitArchive}>
              <label>Satellite product<select name="product" defaultValue={product}><option value="nisar-gcov-provisional">NISAR GCOV (recommended)</option><option value="nisar-gcov">NISAR GCOV (validated)</option><option value="opera-rtc-s1">Sentinel-1 RTC</option></select></label>
              {isNisar && <label>Polarization<select value={polarization} onChange={(event) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("pol", event.target.value); return next })}><option value="HVHV">HV (recommended)</option><option value="HHHH">HH</option></select></label>}
              <div className="archive-search__dates"><label>Start<input name="start" type="date" required defaultValue={query?.start ?? windowDefaults.start} /></label><label>End<input name="end" type="date" required defaultValue={query?.end ?? windowDefaults.end} /></label></div>
              <label>Area (W,S,E,N)<input name="bbox" required defaultValue={place.bounds.join(",")} /></label>
              <Button type="submit" size="small" disabled={archive.isFetching}>{archive.isFetching ? "Searching…" : "Apply"}</Button>
            </form>
            {(groups.length > 1 || (requestedGroup && !groups.includes(requestedGroup))) && (
              <>
                <label>Footprint<select value={group} onChange={(event) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("burst", event.target.value); next.delete("left"); next.delete("right"); return next })}>{!groups.includes(group) && <option value={group}>Requested footprint</option>}{groups.map((id) => {
                  const gi = items.filter((item) => acquisitionGroup(item) === id)
                  const dates = new Set(gi.map((item) => item.acquiredAt.slice(0, 10))).size
                  return <option key={id} value={id}>{acquisitionGroupLabel(id)} — {dates} date{dates === 1 ? "" : "s"}</option>
                })}</select></label>
                <small>Footprints are grouped by track and frame so before/after dates cover the same ground.</small>
              </>
            )}
          </details>
          {formError && <p role="alert">{formError}</p>}
          {archive.hasNextPage && <Button tone="secondary" size="small" disabled={archive.isFetching} onClick={() => { void archive.fetchNextPage() }}>Load more dates</Button>}
          {archive.isError && <p role="alert">{archive.error.message}</p>}
        </section>
      )}
    />
  )

  const evidence = (
    <EvidenceDrawer place={place} moduleId={state.moduleId} dataOrigin="live" selectedObservation={pairRight ?? right} observations={observations} layers={layers.filter((layer) => state.activeLayers.includes(layer.id))} sources={[activeSource]} realtimeContext={rtContext} series={series} comparedPair={comparedPair} browse={browse}
      hasPublishedAnalysis={Boolean(bundle)}
      publishedAnalysis={<CalibratedAnalysis result={calibrated.data} loading={Boolean(analysisQuery) && calibrated.isPending} error={calibrated.error?.message}
        overlay={overlayKind} onOverlayChange={(mode) => { setAnalysisOverlayMode(mode); if (mode !== "off") state.setView("map") }} />} />
  )

  const selectionNotice = <div className="shared-selection-notice"><StatePanel compact title="Selection not loaded" message={archive.hasNextPage ? "Load more acquisitions to restore the linked selection." : "Requested records not found. Use loaded acquisitions."} icon="info" /><Button tone="secondary" size="small" disabled={!items.length} onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); for (const key of ["burst", "left", "right"]) next.delete(key); return next })}>Use loaded</Button></div>
  const comparison = missingSelection && state.mode !== "difference" ? selectionNotice : <ComparisonViewer mode={state.mode} left={pairLeft} right={pairRight} dataOrigin="live" />

  const center = (
    <div className="explorer-center">
      <div className="explorer-center__switcher" role="group" aria-label="View">
        <button type="button" aria-pressed={state.view === "map"} onClick={() => state.setView("map")}><Icon name="globe" size={15} /> Map</button>
        <button type="button" aria-pressed={state.view === "compare"} onClick={() => state.setView("compare")}><Icon name="compare" size={15} /> Compare</button>
      </div>
      <div className="explorer-analysis-banner explorer-analysis-banner--quick" role="status"><Icon name="info" size={16} /> {statusText}</div>
      {state.view === "map" ? (
        <>
          <Suspense fallback={<div className="explorer-loading"><Skeleton lines={5} /></div>}>
            <EarthMap place={place} moduleId={state.moduleId} activeLayers={state.activeLayers} layerDefinitions={layers} selectedObservation={pairRight} catalogueItems={groupItems} onAreaChange={chooseArea} onObservationSelect={state.selectObservation} analysisOverlay={analysisOverlay} />
          </Suspense>
          {!bundle && waiting && <div className="explorer-no-coverage"><StatePanel compact title="Pulling satellite data" message="Loading real acquisitions for this area." icon="calendar" /></div>}
          {!bundle && !waiting && failed && <div className="explorer-no-coverage"><StatePanel compact title="Could not load data" message={archive.error?.message ?? "Try a different date range or area."} icon="alert" /></div>}
          {!waiting && !failed && missingSelection && <div className="explorer-no-coverage">{selectionNotice}</div>}
          {!bundle && !waiting && !failed && !missingSelection && observations.length === 0 && <div className="explorer-no-coverage"><StatePanel compact title="No acquisitions found" message="No radar records for this window. Try a wider date range or move the map." icon="calendar" /></div>}
        </>
      ) : waiting ? <Skeleton lines={6} /> : failed && !observations.length ? <StatePanel title="Could not load data" message={archive.error?.message ?? "Try a different date range or area."} icon="alert" /> : comparison}
    </div>
  )

  return (
    <main className={`explorer-page ${observations.length === 0 || missingSelection ? "explorer-page--no-timeline" : ""}`} id="main-content">
      <header className="explorer-toolbar">
        <div className="explorer-toolbar__identity"><span className="section-kicker">{moduleRegistry[state.moduleId].title}</span><h1>{place.name} <small>{place.country}</small></h1></div>
        <div className="explorer-toolbar__search"><PlaceSearch currentPlace={place} onSelect={state.setPlace} /></div>
        <div className="explorer-toolbar__actions">{bundle && <span className="study-badge">Published study</span>}<span className={`data-status data-status--${dataStatus[1]}`}><i /> {dataStatus[0]}</span><Button tone="secondary" size="small" onClick={share}><Icon name="link" size={15} /> Share</Button></div>
        {shareStatus && <span className="sr-only" role="status">{shareStatus}</span>}
      </header>
      {isDesktop ? (
        <Group orientation="horizontal" className="explorer-workspace" id="earth-explorer-panels">
          <Panel id="controls" defaultSize="22%" minSize="260px" maxSize="360px" collapsible collapsedSize="0px">{controls}</Panel>
          <Separator className="panel-separator" />
          <Panel id="map" defaultSize="48%" minSize="420px">{center}</Panel>
          <Separator className="panel-separator" />
          <Panel id="evidence" defaultSize="30%" minSize="360px" maxSize="580px" collapsible collapsedSize="0px">{evidence}</Panel>
        </Group>
      ) : (
        <div className="explorer-mobile-workspace">
          {center}
          <nav className="explorer-mobile-actions" aria-label="Explorer panels">
            <button type="button" aria-expanded={mobileSheet === "controls"} onClick={(event) => { mobileSheetTrigger.current = event.currentTarget; setMobileSheet("controls") }}><Icon name="layers" size={17} /> Controls</button>
            <button type="button" aria-expanded={mobileSheet === "comparison"} onClick={(event) => { mobileSheetTrigger.current = event.currentTarget; setMobileSheet("comparison") }}><Icon name="compare" size={17} /> Compare</button>
            <button type="button" aria-expanded={mobileSheet === "evidence"} onClick={(event) => { mobileSheetTrigger.current = event.currentTarget; setMobileSheet("evidence") }}><Icon name="book" size={17} /> Summary</button>
          </nav>
          <Dialog.Root open={mobileSheet !== null} onOpenChange={(open) => { if (!open) setMobileSheet(null) }}>
            <Dialog.Portal>
              <Dialog.Overlay className="explorer-sheet-overlay" />
              <Dialog.Content className="explorer-bottom-sheet" onCloseAutoFocus={(event) => { event.preventDefault(); mobileSheetTrigger.current?.focus() }}>
                <Dialog.Title className="sr-only">{mobileSheet} panel</Dialog.Title>
                <Dialog.Description className="sr-only">Explorer {mobileSheet}.</Dialog.Description>
                <div className="explorer-bottom-sheet__handle" />
                <Dialog.Close className="explorer-bottom-sheet__close" aria-label={`Close ${mobileSheet} panel`}><Icon name="close" size={18} /></Dialog.Close>
                {mobileSheet === "controls" ? controls : mobileSheet === "evidence" ? evidence : mobileSheet === "comparison" ? comparison : null}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      )}
      {!waiting && !missingSelection && observations.length > 0 && (
        <ObservationTimeline observations={observations} selectedId={pairRight?.id ?? state.rightId} events={[]} onSelect={state.selectObservation} dataOrigin="live" />
      )}
      <Argus context={{
        analysisQuery: bundle && analysisQuery ? analysisQuery : undefined,
        view: rtContext,
        acquisitions: series,
        comparison: { status: browse.status, summary: missingSelection ? null : browse.summary },
        catalogueStatus: waiting ? "loading" : failed ? "error" : "ready",
        hasMore: Boolean(archive.hasNextPage),
        missingSelection,
        display: {
          moduleId: state.moduleId,
          moduleTitle: moduleRegistry[state.moduleId].title,
          comparisonMode: state.mode,
          view: state.view,
          polarization: isNisar ? polarization : null,
          productId: product,
          activeLayers: state.activeLayers,
          previewsWithImages: observations.filter((observation) => Boolean(observation.imageUrl)).length,
          previewsMissing: observations.filter((observation) => !observation.imageUrl).length,
        },
        page: { path: pathname, title: `${place.name} / ${moduleRegistry[state.moduleId].title}` },
      }} />
    </main>
  )
}

export function ExplorerPage() {
  const { placeId = "kuakata-bangladesh" } = useParams()
  const [params] = useSearchParams()
  const placeQuery = usePlace(placeId)

  if (params.has("bbox")) {
    const bounds = catalogueBoundsSchema.safeParse(params.get("bbox")!.split(",").map((value) => value.trim() ? Number(value) : NaN))
    if (!bounds.success) return <main id="main-content"><StatePanel title="Invalid map area" message="Use west,south,east,north bounds in valid WGS84 coordinates." icon="alert" /></main>
    const [west, south, east, north] = bounds.data
    const centerLongitude = (west + (east < west ? east + 360 : east)) / 2
    const matchedPlace = placeQuery.data && bounds.data[0] >= placeQuery.data.bounds[0] - 1e-6 && bounds.data[1] >= placeQuery.data.bounds[1] - 1e-6 && bounds.data[2] <= placeQuery.data.bounds[2] + 1e-6 && bounds.data[3] <= placeQuery.data.bounds[3] + 1e-6 ? placeQuery.data : null
    return <ExplorerWorkspace place={{ id: matchedPlace?.id ?? "selected-area", name: matchedPlace?.name ?? "Selected map area", country: matchedPlace?.country ?? "", kind: matchedPlace?.kind ?? "area", center: [centerLongitude > 180 ? centerLongitude - 360 : centerLongitude, (south + north) / 2], bounds: bounds.data, description: matchedPlace ? `Analysis from satellite records within ${matchedPlace.name}.` : "Analysis from satellite records for this area.", moduleIds: matchedPlace?.moduleIds ?? ["flood", "coastal", "ice", "glof"], coverage: matchedPlace?.coverage ?? [], storySlug: matchedPlace?.storySlug }} />
  }
  if (placeQuery.isLoading) return <main id="main-content" className="route-loading"><Skeleton lines={8} /></main>
  if (placeQuery.isError) return <main id="main-content"><StatePanel title="Place unavailable" message="Could not load this place." icon="alert" /></main>
  if (!placeQuery.data) return <main id="main-content"><StatePanel title="Place not found" message="This investigation is not available." icon="pin" /></main>
  return <ExplorerWorkspace place={placeQuery.data} />
}
