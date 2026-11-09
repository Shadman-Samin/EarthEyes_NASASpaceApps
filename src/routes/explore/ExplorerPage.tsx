import * as Dialog from "@radix-ui/react-dialog"
import { lazy, Suspense, useRef, useState } from "react"
import { Group, Panel, Separator } from "react-resizable-panels"
import { useParams, useSearchParams } from "react-router-dom"
import { moduleIdSchema, type ModuleId, type Place } from "../../domain/models"
import { moduleRegistry } from "../../domain/module-registry"
import { useDataSources, useEvents, useLayers, useMeasurements, useObservations, usePlace } from "../../data/queries"
import { getDataOrigin } from "../../data/repository"
import { ComparisonViewer } from "../../features/comparison/ComparisonViewer"
import { EvidenceDrawer } from "../../features/evidence/EvidenceDrawer"
import { ExplorerControls } from "../../features/explorer/ExplorerControls"
import { useExplorerState } from "../../features/explorer/useExplorerState"
import { PlaceSearch } from "../../features/search/PlaceSearch"
import { ObservationTimeline } from "../../features/timeline/ObservationTimeline"
import { Button, Icon, Skeleton, StatePanel } from "../../shared/ui"
import { useMediaQuery } from "../../shared/useMediaQuery"

type MobileSheet = "controls" | "evidence" | "comparison" | null

const EarthMap = lazy(() => import("../../features/map/EarthMap").then((module) => ({ default: module.EarthMap })))

function ExplorerWorkspace({ place }: { place: Place }) {
  const [searchParams] = useSearchParams()
  const requestedModule = moduleIdSchema.safeParse(searchParams.get("module"))
  const moduleId: ModuleId = requestedModule.success && place.moduleIds.includes(requestedModule.data)
    ? requestedModule.data
    : place.moduleIds[0]
  const observationsQuery = useObservations(place.id, moduleId)
  const layersQuery = useLayers(moduleId)
  const measurementsQuery = useMeasurements(place.id, moduleId)
  const eventsQuery = useEvents(place.id)
  const sourcesQuery = useDataSources()
  const [mobileSheet, setMobileSheet] = useState<MobileSheet>(null)
  const mobileSheetTrigger = useRef<HTMLButtonElement | null>(null)
  const [shareStatus, setShareStatus] = useState("")
  const isDesktop = useMediaQuery("(min-width: 1100px)")
  const fixtureData = getDataOrigin() === "fixture"

  const state = useExplorerState({
    place,
    observations: observationsQuery.data ?? [],
    layers: layersQuery.data ?? [],
  })
  const observations = observationsQuery.data ?? []
  const layers = layersQuery.data ?? []
  const left = observations.find((observation) => observation.id === state.leftId)
  const right = observations.find((observation) => observation.id === state.rightId)

  const share = async () => {
    const url = window.location.href
    try {
      if (navigator.share) await navigator.share({ title: `EarthEyes / ${place.name}`, url })
      else await navigator.clipboard.writeText(url)
      setShareStatus("Explorer link ready to share")
    } catch {
      setShareStatus("Sharing was cancelled")
    }
    window.setTimeout(() => setShareStatus(""), 2400)
  }

  const controls = (
    <ExplorerControls
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
    />
  )
  const evidence = (
    <EvidenceDrawer
      place={place}
      moduleId={state.moduleId}
      measurements={measurementsQuery.data ?? []}
      events={eventsQuery.data ?? []}
      observations={observations}
      layers={layers.filter((layer) => state.activeLayers.includes(layer.id))}
      sources={sourcesQuery.data ?? []}
    />
  )
  const comparison = <ComparisonViewer mode={state.mode} left={left} right={right} />
  const center = (
    <div className="explorer-center">
      <div className="explorer-center__switcher" role="group" aria-label="Central workspace view">
        <button type="button" aria-pressed={state.view === "map"} onClick={() => state.setView("map")}><Icon name="globe" size={15} /> Map</button>
        <button type="button" aria-pressed={state.view === "compare"} onClick={() => state.setView("compare")}><Icon name="compare" size={15} /> Compare</button>
      </div>
      {state.view === "map" ? (
        <>
          <Suspense fallback={<div className="explorer-loading"><Skeleton lines={5} /></div>}>
            <EarthMap key={`${place.id}-${state.moduleId}`} place={place} moduleId={state.moduleId} activeLayers={state.activeLayers} layerDefinitions={layers} selectedObservation={right} />
          </Suspense>
          {observations.length === 0 && <div className="explorer-no-coverage"><StatePanel compact title="No observation coverage" message={`No ${moduleRegistry[state.moduleId].title.toLowerCase()} acquisitions are available for ${place.name}. Choose another phenomenon in Controls.`} icon="calendar" /></div>}
        </>
      ) : comparison}
    </div>
  )

  const waiting = observationsQuery.isLoading || layersQuery.isLoading || measurementsQuery.isLoading || eventsQuery.isLoading || sourcesQuery.isLoading
  const failed = observationsQuery.isError || layersQuery.isError || measurementsQuery.isError || eventsQuery.isError || sourcesQuery.isError

  return (
    <main className={`explorer-page ${observations.length === 0 ? "explorer-page--no-timeline" : ""}`} id="main-content">
      <header className="explorer-toolbar">
        <div className="explorer-toolbar__identity">
          <span className="section-kicker">{moduleRegistry[state.moduleId].title}</span>
          <h1>{place.name} <small>{place.country}</small></h1>
        </div>
        <div className="explorer-toolbar__search"><PlaceSearch currentPlace={place} onSelect={state.setPlace} /></div>
        <div className="explorer-toolbar__actions">
          <span className="data-status"><i /> {fixtureData ? "Fixture API" : "Connected API"}</span>
          <Button tone="secondary" size="small" onClick={share}><Icon name="link" size={15} /> Share</Button>
        </div>
        {shareStatus && <span className="sr-only" role="status">{shareStatus}</span>}
      </header>

      {waiting ? <div className="explorer-loading"><Skeleton lines={6} /></div> : failed ? (
        <StatePanel title="Explorer data unavailable" message="The typed repository could not load this investigation. Try refreshing the page." icon="alert" />
      ) : isDesktop ? (
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

      {!waiting && observations.length > 0 && (
        <ObservationTimeline observations={observations} selectedId={state.rightId} events={eventsQuery.data ?? []} onSelect={state.selectObservation} />
      )}
    </main>
  )
}

export function ExplorerPage() {
  const { placeId = "kuakata-bangladesh" } = useParams()
  const placeQuery = usePlace(placeId)

  if (placeQuery.isLoading) return <main id="main-content" className="route-loading"><Skeleton lines={8} /></main>
  if (placeQuery.isError) return <main id="main-content"><StatePanel title="Place unavailable" message="EarthEyes could not load this place record." icon="alert" /></main>
  if (!placeQuery.data) return <main id="main-content"><StatePanel title="Place not found" message="This investigation does not exist or is no longer available." icon="pin" /></main>
  return <ExplorerWorkspace place={placeQuery.data} />
}
