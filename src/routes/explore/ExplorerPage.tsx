import * as Dialog from "@radix-ui/react-dialog"
import { lazy, Suspense, useRef, useState, type FormEvent } from "react"
import { useInfiniteQuery, useQueryClient } from "@tanstack/react-query"
import { Group, Panel, Separator } from "react-resizable-panels"
import { useParams, useSearchParams } from "react-router-dom"
import { moduleIdSchema, type LayerDefinition, type ModuleId, type Place } from "../../domain/models"
import { catalogueBoundsSchema, catalogueProductIdSchema, catalogueQuerySchema, type CatalogueBounds, type CatalogueProductId, type CatalogueSearchResult } from "../../domain/catalogue"
import { moduleRegistry } from "../../domain/module-registry"
import { usePlace } from "../../data/queries"
import { catalogueItemKey, fetchCatalogue } from "../../data/catalogue"
import { useAnalysisBundle } from "../../features/analysis/analysisBundle"
import { AnalysisPanel } from "../../features/analysis/AnalysisPanel"
import { acquisitionGroup, catalogueObservation, nisarSource, operaSource, type NisarPolarization, type NisarProductKey } from "../../data/live-explorer"
import { ComparisonViewer } from "../../features/comparison/ComparisonViewer"
import { EvidenceDrawer } from "../../features/evidence/EvidenceDrawer"
import { ExplorerControls } from "../../features/explorer/ExplorerControls"
import { useExplorerState } from "../../features/explorer/useExplorerState"
import { PlaceSearch } from "../../features/search/PlaceSearch"
import { ObservationTimeline } from "../../features/timeline/ObservationTimeline"
import { Button, Icon, Skeleton, StatePanel } from "../../shared/ui"
import { useMediaQuery } from "../../shared/useMediaQuery"
import { formatDateTime } from "../../shared/formatting"

type MobileSheet = "controls" | "evidence" | "comparison" | null

const nisarPolarizations: Array<{ id: NisarPolarization; label: string }> = [
  { id: "HVHV", label: "HV cross-pol" },
  { id: "HHHH", label: "HH co-pol" },
]

function archiveWindow(product: CatalogueProductId) {
  if (product.startsWith("nisar")) return { start: "2026-01-01", end: new Date().toISOString().slice(0, 10) }
  return { start: "2024-05-01", end: "2024-05-31" }
}

const EarthMap = lazy(() => import("../../features/map/EarthMap").then((module) => ({ default: module.EarthMap })))

function ExplorerWorkspace({ place }: { place: Place }) {
  const [searchParams, setSearchParams] = useSearchParams()
  const queryClient = useQueryClient()
  const requestedModule = moduleIdSchema.safeParse(searchParams.get("module"))
  const moduleId: ModuleId = requestedModule.success && place.moduleIds.includes(requestedModule.data)
    ? requestedModule.data
    : place.moduleIds[0]
  const requestedProduct = catalogueProductIdSchema.safeParse(searchParams.get("product"))
  const product: CatalogueProductId = requestedProduct.success ? requestedProduct.data : "nisar-gcov-provisional"
  const isNisar = product.startsWith("nisar")
  const polarization: NisarPolarization = searchParams.get("pol") === "HHHH" ? "HHHH" : "HVHV"
  const windowDefaults = archiveWindow(product)
  const activeSource = isNisar ? nisarSource(product as NisarProductKey) : operaSource
  const analysisQuery = useAnalysisBundle(place.id)
  const analysis = analysisQuery.data ?? null
  const [analysisDate, setAnalysisDate] = useState("")
  const [analysisPair, setAnalysisPair] = useState("")
  const [showAnalysisChange, setShowAnalysisChange] = useState(false)
  const resolvedAnalysisDate = analysisDate || analysis?.dates.at(-1)?.date || ""
  const resolvedAnalysisPair = analysisPair || (analysis ? Object.keys(analysis.pairs).at(-1) || "" : "")
  const parsedQuery = catalogueQuerySchema.safeParse({ product, bbox: place.bounds, start: searchParams.get("start") ?? windowDefaults.start, end: searchParams.get("end") ?? windowDefaults.end, limit: 20 })
  const query = parsedQuery.success ? parsedQuery.data : null
  const archive = useInfiniteQuery({
    queryKey: ["explorer-catalogue", query], enabled: query !== null,
    initialPageParam: [] as CatalogueSearchResult["next"],
    queryFn: ({ pageParam, signal }) => {
      if (!query) throw new Error("Choose valid bounds and a date window of 1 to 366 days.")
      return Promise.all((pageParam.length ? pageParam.map((partition) => ({ ...query, ...partition })) : [query]).map((request) => fetchCatalogue(request, signal)))
    },
    getNextPageParam: (pages) => { const next = pages.flatMap((page) => page.next); return next.length ? next : undefined },
    retry: false, refetchOnWindowFocus: false, refetchOnReconnect: false, refetchOnMount: false, staleTime: 300_000,
  })
  const pages = archive.data?.pages.flat() ?? []
  const items = [...new Map(pages.flatMap((page) => page.items).map((item) => [catalogueItemKey(item), item])).values()]
  const groups = [...new Set(items.map(acquisitionGroup))]
  const requestedGroup = searchParams.get("burst")
  const requestedItem = items.find((item) => item.id === searchParams.get("right")) ?? items.find((item) => item.id === searchParams.get("left"))
  const group = requestedGroup ?? (requestedItem ? acquisitionGroup(requestedItem) : groups.find((id) => new Set(items.filter((item) => acquisitionGroup(item) === id).map((item) => item.acquiredAt)).size > 1) ?? groups[0] ?? "")
  const groupItems = items.filter((item) => acquisitionGroup(item) === group).sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt))
  const observations = groupItems.map((item) => catalogueObservation(item, place.id, moduleId, { polarization }))
  const layers: LayerDefinition[] = [
    { id: "acquisition-footprint", moduleId, label: "Acquisition footprints", description: "Provider geometries for loaded acquisitions.", classification: "observed", quality: "validated", sourceId: activeSource.id, unit: null, color: "#3ca9ad", defaultEnabled: true },
    { id: "sar-preview", moduleId, label: "Selected SAR preview", description: "Official browse image, shown separately from the georeferenced map.", classification: "observed", quality: "validated", sourceId: activeSource.id, unit: null, color: "#c8e56b", defaultEnabled: true },
  ]
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)
  const mobileSheetTrigger = useRef<HTMLButtonElement | null>(null)
  const [shareStatus, setShareStatus] = useState("")
  const isDesktop = useMediaQuery("(min-width: 1100px)")
  const [formError, setFormError] = useState("")

  const state = useExplorerState({
    place,
    observations,
    layers,
  })
  const left = observations.find((observation) => observation.id === state.leftId)
  const right = observations.find((observation) => observation.id === state.rightId)
  const missingSelection = Boolean(archive.data && (
    (searchParams.has("burst") && !groups.includes(group)) ||
    (searchParams.has("left") && !left) || (searchParams.has("right") && !right)
  ))

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
    if (!parsed.success) { setFormError("Enter valid west,south,east,north bounds and an inclusive date window of 1 to 366 days."); return }
    setFormError("")
    void queryClient.resetQueries({ queryKey: ["explorer-catalogue", parsed.data], exact: true })
    setSearchParams((current) => {
      const next = new URLSearchParams(current)
      next.set("start", parsed.data.start); next.set("end", parsed.data.end)
      next.set("product", parsed.data.product)
      if (parsed.data.product.startsWith("nisar")) next.set("pol", polarization); else next.delete("pol")
      if (current.has("bbox") || parsed.data.bbox.some((value, index) => value !== place.bounds[index])) next.set("bbox", parsed.data.bbox.join(","))
      for (const key of ["burst", "left", "right"]) next.delete(key)
      return next
    })
  }

  const share = async () => {
    const url = new URL(window.location.href)
    url.searchParams.set("module", state.moduleId)
    url.searchParams.set("mode", state.mode)
    url.searchParams.set("view", state.view)
    if (query) {
      url.searchParams.set("start", query.start); url.searchParams.set("end", query.end)
      url.searchParams.set("bbox", query.bbox.join(","))
    }
    url.searchParams.set("product", product)
    if (isNisar) url.searchParams.set("pol", polarization); else url.searchParams.delete("pol")
    if (group) url.searchParams.set("burst", group)
    if (state.leftId) url.searchParams.set("left", state.leftId)
    if (state.rightId) url.searchParams.set("right", state.rightId)
    try {
      if (navigator.share) await navigator.share({ title: `EarthEyes / ${place.name}`, url: url.href })
      else await navigator.clipboard.writeText(url.href)
      setShareStatus("Explorer link ready to share")
    } catch {
      setShareStatus("Sharing was cancelled")
    }
    window.setTimeout(() => setShareStatus(""), 2400)
  }

  const controls = (
    <ExplorerControls
      dataOrigin="live"
      place={place}
      moduleId={state.moduleId}
      mode={state.mode}
      observations={observations}
      leftId={state.leftId}
      rightId={state.rightId}
      layers={layers}
      activeLayers={state.activeLayers}
      onPlaceChange={state.setPlace}
      onModuleChange={state.setModule}
      onModeChange={state.setMode}
      onPairChange={state.setPair}
      onToggleLayer={state.toggleLayer}
      archive={(
        <section className="control-rail__section archive-search">
          <h2 className="control-label"><Icon name="globe" size={14} /> Live SAR archive</h2>
          <p>{isNisar ? "NASA NISAR GCOV. Real L-band source previews, not computed change maps." : "NASA OPERA / Sentinel-1 RTC. Real source previews, not computed change maps."}</p>
          <label>Product<select value={product} onChange={(event) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("product", event.target.value); for (const key of ["burst", "left", "right", "pol"]) next.delete(key); return next })}>
            <option value="nisar-gcov-provisional">NISAR GCOV (provisional)</option>
            <option value="nisar-gcov">NISAR GCOV (validated)</option>
            <option value="opera-rtc-s1">OPERA Sentinel-1 RTC</option>
          </select></label>
          {isNisar && <label>Polarization<select value={polarization} onChange={(event) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("pol", event.target.value); return next })}>{nisarPolarizations.map((option) => <option key={option.id} value={option.id}>{option.label}</option>)}</select></label>}
          <details className="archive-search__filters"><summary>Area and date filters</summary>
          <form key={`${place.bounds.join(",")}/${query?.start}/${query?.end}/${product}`} onSubmit={submitArchive}>
            <div className="archive-search__dates"><label>Start date<input name="start" type="date" required defaultValue={query?.start ?? windowDefaults.start} /></label><label>End date<input name="end" type="date" required defaultValue={query?.end ?? windowDefaults.end} /></label></div>
            <label>Area bounds<input name="bbox" required defaultValue={place.bounds.join(",")} aria-describedby="bounds-help" /></label>
            <small id="bounds-help">West, south, east, north. Or pan the map and select Search this map area. The initial window is {isNisar ? "January 2026 to today" : "May 2024"}.</small>
            <Button type="submit" size="small" disabled={archive.isFetching}>{archive.isFetching ? "Searching archive..." : "Search archive"}</Button>
          </form>
          </details>
          {formError && <p role="alert">{formError}</p>}
          {(groups.length > 0 || requestedGroup) && <label>Scene footprint<select value={group} onChange={(event) => setSearchParams((current) => { const next = new URLSearchParams(current); next.set("burst", event.target.value); next.delete("left"); next.delete("right"); return next })}>{!groups.includes(group) && <option value={group}>Requested footprint (not loaded)</option>}{groups.map((id) => <option key={id} value={id}>{id} / {items.filter((item) => acquisitionGroup(item) === id).length} records</option>)}</select></label>}
          <small>{items.length} records loaded; {observations.length} in this footprint. Pages are not a complete archive count.</small>
          {pages[0] && <small>Metadata fetched {formatDateTime(pages[0].fetchedAt)}</small>}
          {archive.hasNextPage && <Button tone="secondary" size="small" disabled={archive.isFetching} onClick={() => { void archive.fetchNextPage() }}>Load more acquisitions</Button>}
          {archive.isError && <p role="alert">{archive.error.message}</p>}
        </section>
      )}
    />
  )
  const evidence = (
    <EvidenceDrawer
      dataOrigin="live"
      selectedObservation={right}
      place={place}
      moduleId={state.moduleId}
      measurements={[]}
      events={[]}
      observations={observations}
      layers={layers.filter((layer) => state.activeLayers.includes(layer.id))}
      sources={[activeSource]}
      analysisPanel={analysis ? (
        <AnalysisPanel
          manifest={analysis}
          date={resolvedAnalysisDate}
          onDateChange={setAnalysisDate}
          pair={resolvedAnalysisPair}
          onPairChange={setAnalysisPair}
          showChange={showAnalysisChange}
          onShowChange={setShowAnalysisChange}
        />
      ) : null}
    />
  )
  const selectionNotice = <div className="shared-selection-notice"><StatePanel compact title="Shared selection not loaded" message={archive.hasNextPage ? "The link names records that are not in the loaded pages. Load more acquisitions in Controls to restore them; no different scenes have been substituted." : "The requested records are not available in this search. Adjust the filters or explicitly choose loaded acquisitions; no different scenes have been substituted."} icon="info" /><Button tone="secondary" size="small" disabled={!items.length} onClick={() => setSearchParams((current) => { const next = new URLSearchParams(current); for (const key of ["burst", "left", "right"]) next.delete(key); return next })}>Use loaded acquisitions</Button></div>
  const comparison = missingSelection && state.mode !== "difference" ? selectionNotice : <ComparisonViewer mode={state.mode} left={left} right={right} dataOrigin="live" />
  const waiting = query !== null && archive.isPending
  const failed = !query || archive.isError
  const center = (
    <div className="explorer-center">
      <div className="explorer-center__switcher" role="group" aria-label="Central workspace view">
        <button type="button" aria-pressed={state.view === "map"} onClick={() => state.setView("map")}><Icon name="globe" size={15} /> Map</button>
        <button type="button" aria-pressed={state.view === "compare"} onClick={() => state.setView("compare")}><Icon name="compare" size={15} /> Compare</button>
      </div>
      {state.view === "map" ? (
        <>
          <Suspense fallback={<div className="explorer-loading"><Skeleton lines={5} /></div>}>
            <EarthMap place={place} moduleId={state.moduleId} activeLayers={state.activeLayers} layerDefinitions={layers} selectedObservation={right} catalogueItems={groupItems} onAreaChange={chooseArea} onObservationSelect={state.selectObservation} analysisManifest={analysis} analysisDate={resolvedAnalysisDate} analysisPair={resolvedAnalysisPair} showAnalysisChange={showAnalysisChange} />
          </Suspense>
          {waiting && <div className="explorer-no-coverage"><StatePanel compact title="Searching satellite archive" message="Loading real acquisition records. No satellite rasters are downloaded." icon="calendar" /></div>}
          {!waiting && failed && <div className="explorer-no-coverage"><StatePanel compact title="Archive unavailable" message={archive.error?.message ?? "Choose valid bounds and a date window of 1 to 366 days."} icon="alert" /></div>}
          {!waiting && !failed && missingSelection && <div className="explorer-no-coverage">{selectionNotice}</div>}
          {!waiting && !failed && !missingSelection && observations.length === 0 && <div className="explorer-no-coverage"><StatePanel compact title="No acquisitions in this window" message="The provider returned no matching records. Change the date window or map area in Controls; no demo observations have been substituted." icon="calendar" /></div>}
        </>
      ) : waiting ? <Skeleton lines={6} /> : failed && !observations.length ? <StatePanel title="Archive unavailable" message={archive.error?.message ?? "Choose valid bounds and a date window of 1 to 366 days."} icon="alert" /> : comparison}
    </div>
  )

  return (
    <main className={`explorer-page ${observations.length === 0 || missingSelection ? "explorer-page--no-timeline" : ""}`} id="main-content">
      <header className="explorer-toolbar">
        <div className="explorer-toolbar__identity">
          <span className="section-kicker">{moduleRegistry[state.moduleId].title}</span>
          <h1>{place.name} <small>{place.country}</small></h1>
        </div>
        <div className="explorer-toolbar__search"><PlaceSearch currentPlace={place} onSelect={state.setPlace} /></div>
        <div className="explorer-toolbar__actions">
          <span className="data-status"><i /> {isNisar ? "Live NISAR archive" : "Live SAR archive"}</span>
          <Button tone="secondary" size="small" onClick={share}><Icon name="link" size={15} /> Share</Button>
        </div>
        {shareStatus && <span className="sr-only" role="status">{shareStatus}</span>}
      </header>

      {isDesktop ? (
        <Group orientation="horizontal" className="explorer-workspace" id="earth-explorer-panels">
          <Panel id="controls" defaultSize="21%" minSize="260px" maxSize="390px" collapsible collapsedSize="0px">{controls}</Panel>
          <Separator className="panel-separator" />
          <Panel id="map" defaultSize="52%" minSize="430px">{center}</Panel>
          <Separator className="panel-separator" />
          <Panel id="evidence" defaultSize="27%" minSize="320px" maxSize="520px" collapsible collapsedSize="0px">{evidence}</Panel>
        </Group>
      ) : (
        <div className="explorer-mobile-workspace">
          {center}
          <nav className="explorer-mobile-actions" aria-label="Explorer panels">
            <button type="button" aria-expanded={mobileSheet === "controls"} onClick={(event) => { mobileSheetTrigger.current = event.currentTarget; setMobileSheet("controls") }}><Icon name="layers" size={17} /> Controls</button>
            <button type="button" aria-expanded={mobileSheet === "comparison"} onClick={(event) => { mobileSheetTrigger.current = event.currentTarget; setMobileSheet("comparison") }}><Icon name="compare" size={17} /> Compare</button>
            <button type="button" aria-expanded={mobileSheet === "evidence"} onClick={(event) => { mobileSheetTrigger.current = event.currentTarget; setMobileSheet("evidence") }}><Icon name="book" size={17} /> Evidence</button>
          </nav>
          <Dialog.Root open={mobileSheet !== null} onOpenChange={(open) => { if (!open) setMobileSheet(null) }}>
            <Dialog.Portal>
              <Dialog.Overlay className="explorer-sheet-overlay" />
              <Dialog.Content
                className="explorer-bottom-sheet"
                onCloseAutoFocus={(event) => {
                  event.preventDefault()
                  mobileSheetTrigger.current?.focus()
                }}
              >
                <Dialog.Title className="sr-only">{mobileSheet} panel</Dialog.Title>
                <Dialog.Description className="sr-only">Explorer {mobileSheet} options for the selected investigation.</Dialog.Description>
                <div className="explorer-bottom-sheet__handle" />
                <Dialog.Close className="explorer-bottom-sheet__close" aria-label={`Close ${mobileSheet} panel`}><Icon name="close" size={18} /></Dialog.Close>
                {mobileSheet === "controls" ? controls : mobileSheet === "evidence" ? evidence : mobileSheet === "comparison" ? comparison : null}
              </Dialog.Content>
            </Dialog.Portal>
          </Dialog.Root>
        </div>
      )}

      {!waiting && !missingSelection && observations.length > 0 && (
        <ObservationTimeline observations={observations} selectedId={state.rightId} events={[]} onSelect={state.selectObservation} dataOrigin="live" />
      )}
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
    return <ExplorerWorkspace place={{ id: "selected-area", name: "Selected map area", country: "", kind: "area", center: [centerLongitude > 180 ? centerLongitude - 360 : centerLongitude, (south + north) / 2], bounds: bounds.data, description: "User-selected WGS84 area. Source coverage depends on the chosen archive window.", moduleIds: ["coastal", "ice", "glof"], coverage: [] }} />
  }

  if (placeQuery.isLoading) return <main id="main-content" className="route-loading"><Skeleton lines={8} /></main>
  if (placeQuery.isError) return <main id="main-content"><StatePanel title="Place unavailable" message="EarthEyes could not load this place record." icon="alert" /></main>
  if (!placeQuery.data) return <main id="main-content"><StatePanel title="Place not found" message="This investigation does not exist or is no longer available." icon="pin" /></main>
  return <ExplorerWorkspace place={placeQuery.data} />
}
