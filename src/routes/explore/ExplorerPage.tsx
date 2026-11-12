import * as Dialog from "@radix-ui/react-dialog"
import { lazy, Suspense, useEffect, useMemo, useRef, useState, type FormEvent } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Group, Panel, Separator } from "react-resizable-panels"
import { useParams, useSearchParams } from "react-router-dom"
import { moduleIdSchema, type LayerDefinition, type ModuleId, type Place } from "../../domain/models"
import { catalogueBoundsSchema, catalogueProductIdSchema, catalogueQuerySchema, type CatalogueBounds, type CatalogueProductId, type CatalogueSearchResult } from "../../domain/catalogue"
import { moduleRegistry } from "../../domain/module-registry"
import { usePlace } from "../../data/queries"
import { catalogueItemKey, fetchCatalogue } from "../../data/catalogue"
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

const EarthMap = lazy(() => import("../../features/map/EarthMap").then((module) => ({ default: module.EarthMap })))

function ExplorerWorkspace({ place }: { place: Place }) {
  const [searchParams, setSearchParams] = useSearchParams()
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
      if (navigator.share) await navigator.share({ title: `EarthEyes / ${place.name}`, url: url.href })
      else await navigator.clipboard.writeText(url.href)
      setShareStatus("Link copied")
    } catch { setShareStatus("Share cancelled") }
    window.setTimeout(() => setShareStatus(""), 2400)
  }

  const controls = (
    <ExplorerControls
      dataOrigin="live" place={place} moduleId={state.moduleId} mode={state.mode} observations={observations}
      leftId={pairLeft?.id ?? state.leftId} rightId={pairRight?.id ?? state.rightId} layers={layers} activeLayers={state.activeLayers}
      onPlaceChange={state.setPlace} onModuleChange={state.setModule} onModeChange={state.setMode} onPairChange={state.setPair} onToggleLayer={state.toggleLayer}
      archive={(
        <section className="control-rail__section archive-search">
          <div className="archive-search__head">
            <h2 className="control-label"><Icon name="globe" size={16} /> Live radar data</h2>
            <span className={`archive-pill ${items.length ? "archive-pill--live" : "archive-pill--waiting"}`}><i /> {items.length ? `${items.length} records` : "pulling"}</span>
          </div>
          <p className="archive-search__source"><strong>{activeSource.name}</strong><br />{query ? `${query.start} → ${query.end}` : "Waiting for a valid area"}</p>
          <p className="archive-search__hint">
            {items.length
              ? `${observations.length} acquisition date${observations.length === 1 ? "" : "s"} in the selected footprint (${items.length} records across ${groups.length} footprints). Summary, chart and comparison update automatically.`
              : "Pulling real NASA satellite records for this area. No demo data is substituted."}
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
    <EvidenceDrawer place={place} moduleId={state.moduleId} dataOrigin="live" selectedObservation={pairRight ?? right} observations={observations} layers={layers.filter((layer) => state.activeLayers.includes(layer.id))} sources={[activeSource]} realtimeContext={rtContext} series={series} comparedPair={comparedPair} browse={browse} />
  )

  const selectionNotice = <div className="shared-selection-notice"><StatePanel compact title="Selection not loaded" message={archive.hasNextPage ? "Load more acquisitions to restore the linked selection." : "Requested records not found. Use loaded acquisitions."} icon="info" /><Button tone="secondary" size="small" disabled={!items.length} onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); for (const key of ["burst", "left", "right"]) next.delete(key); return next })}>Use loaded</Button></div>
  const comparison = missingSelection && state.mode !== "difference" ? selectionNotice : <ComparisonViewer mode={state.mode} left={pairLeft} right={pairRight} dataOrigin="live" />
  const waiting = query !== null && archive.isPending
  const failed = !query || archive.isError
  const statusText = comparedPair ? `Real-time visual analysis: ${formatDate(comparedPair.left.acquiredAt)} → ${formatDate(comparedPair.right.acquiredAt)} (${observations.length} acquisitions)` : items.length ? `${items.length} acquisitions loaded — preparing analysis…` : "Pulling real satellite data for this location…"

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
            <EarthMap place={place} moduleId={state.moduleId} activeLayers={state.activeLayers} layerDefinitions={layers} selectedObservation={pairRight} catalogueItems={groupItems} onAreaChange={chooseArea} onObservationSelect={state.selectObservation} />
          </Suspense>
          {waiting && <div className="explorer-no-coverage"><StatePanel compact title="Pulling satellite data" message="Loading real acquisitions for this area." icon="calendar" /></div>}
          {!waiting && failed && <div className="explorer-no-coverage"><StatePanel compact title="Could not load data" message={archive.error?.message ?? "Try a different date range or area."} icon="alert" /></div>}
          {!waiting && !failed && missingSelection && <div className="explorer-no-coverage">{selectionNotice}</div>}
          {!waiting && !failed && !missingSelection && observations.length === 0 && <div className="explorer-no-coverage"><StatePanel compact title="No acquisitions found" message="No radar records for this window. Try a wider date range or move the map." icon="calendar" /></div>}
        </>
      ) : waiting ? <Skeleton lines={6} /> : failed && !observations.length ? <StatePanel title="Could not load data" message={archive.error?.message ?? "Try a different date range or area."} icon="alert" /> : comparison}
    </div>
  )

  return (
    <main className={`explorer-page ${observations.length === 0 || missingSelection ? "explorer-page--no-timeline" : ""}`} id="main-content">
      <header className="explorer-toolbar">
        <div className="explorer-toolbar__identity"><span className="section-kicker">{moduleRegistry[state.moduleId].title}</span><h1>{place.name} <small>{place.country}</small></h1></div>
        <div className="explorer-toolbar__search"><PlaceSearch currentPlace={place} onSelect={state.setPlace} /></div>
        <div className="explorer-toolbar__actions"><span className="data-status"><i /> Live data</span><Button tone="secondary" size="small" onClick={share}><Icon name="link" size={15} /> Share</Button></div>
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
      <Argus context={{ view: rtContext, acquisitions: series, comparison: { status: browse.status, summary: missingSelection ? null : browse.summary }, catalogueStatus: waiting ? "loading" : failed ? "error" : "ready", hasMore: Boolean(archive.hasNextPage), missingSelection }} />
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
    return <ExplorerWorkspace place={{ id: "selected-area", name: "Selected map area", country: "", kind: "area", center: [centerLongitude > 180 ? centerLongitude - 360 : centerLongitude, (south + north) / 2], bounds: bounds.data, description: "Real-time analysis from pulled satellite data for this area.", moduleIds: ["flood", "coastal", "ice", "glof"], coverage: [] }} />
  }
  if (placeQuery.isLoading) return <main id="main-content" className="route-loading"><Skeleton lines={8} /></main>
  if (placeQuery.isError) return <main id="main-content"><StatePanel title="Place unavailable" message="Could not load this place." icon="alert" /></main>
  if (!placeQuery.data) return <main id="main-content"><StatePanel title="Place not found" message="This investigation is not available." icon="pin" /></main>
  return <ExplorerWorkspace place={placeQuery.data} />
}
