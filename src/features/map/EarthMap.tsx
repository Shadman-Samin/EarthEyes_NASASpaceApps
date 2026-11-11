import { useEffect, useRef, useState } from "react"
import {
  AttributionControl,
  type GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  type StyleSpecification,
  type MapLayerMouseEvent,
} from "maplibre-gl"
import type { CatalogueBounds, CatalogueItem } from "../../domain/catalogue"
import type { LayerDefinition, ModuleId, Observation, Place } from "../../domain/models"
import { prefersLowBandwidth } from "../../shared/network"
import { DataBadge, Icon } from "../../shared/ui"
import { getDataOrigin } from "../../data/repository"
import { catalogueMapGeometry } from "./catalogueGeometry"
import type { AnalysisManifest } from "../analysis/analysisBundle"

const baseStyle: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: "raster",
      tiles: ["https://tile.openstreetmap.org/{z}/{x}/{y}.png"],
      tileSize: 256,
      attribution: "OpenStreetMap contributors",
    },
  },
  layers: [{ id: "osm", type: "raster", source: "osm" }],
}

const footprint = (place: Place) => ({
  type: "Feature" as const,
  properties: { name: place.name },
  geometry: catalogueMapGeometry({ bbox: place.bounds, geometry: null }, place.center[0]),
})

export function EarthMap({
  place,
  moduleId,
  activeLayers,
  layerDefinitions,
  selectedObservation,
  catalogueItems,
  onAreaChange,
  onObservationSelect,
  analysisManifest,
  analysisDate,
  analysisPair,
  showAnalysisChange,
}: {
  place: Place
  moduleId: ModuleId
  activeLayers: string[]
  layerDefinitions: LayerDefinition[]
  selectedObservation?: Observation
  catalogueItems?: CatalogueItem[]
  onAreaChange?: (bounds: CatalogueBounds) => void
  onObservationSelect?: (id: string) => void
  analysisManifest?: AnalysisManifest | null
  analysisDate?: string
  analysisPair?: string
  showAnalysisChange?: boolean
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const analysisObjectUrlRef = useRef("")
  const initialPlace = useRef(place)
  const initialModuleId = useRef(moduleId)
  const [inspected, setInspected] = useState<string | null>(null)
  const [mapReady, setMapReady] = useState(false)
  const [failedPreview, setFailedPreview] = useState<string | null>(null)
  const lowBandwidth = prefersLowBandwidth()
  const fixtureData = catalogueItems === undefined && getDataOrigin() === "fixture"

  useEffect(() => {
    if (!containerRef.current || import.meta.env.MODE === "test" || lowBandwidth) return
    const map = new MapLibreMap({
      container: containerRef.current,
      style: baseStyle,
      center: initialPlace.current.center,
      zoom: 7,
      attributionControl: false,
    })
    mapRef.current = map
    map.addControl(new NavigationControl({ showCompass: true }), "top-right")
    map.addControl(new AttributionControl({ compact: true }), "bottom-right")
    map.on("load", () => {
      map.addSource("study-footprint", { type: "geojson", data: footprint(initialPlace.current) })
      map.addLayer({
        id: "study-fill",
        type: "fill",
        source: "study-footprint",
        paint: { "fill-color": "#cbe870", "fill-opacity": 0.12 },
      })
      map.addLayer({
        id: "study-line",
        type: "line",
        source: "study-footprint",
        paint: { "line-color": "#cbe870", "line-width": 3, "line-dasharray": [2, 2] },
      })
      map.addSource("study-point", {
        type: "geojson",
        data: { type: "Feature", properties: { name: initialPlace.current.name }, geometry: { type: "Point", coordinates: initialPlace.current.center } },
      })
      map.addLayer({
        id: "study-point",
        type: "circle",
        source: "study-point",
        paint: {
          "circle-radius": 8,
          "circle-color": initialModuleId.current === "coastal" ? "#39a9ad" : initialModuleId.current === "ice" ? "#cbe870" : "#eb7658",
          "circle-stroke-color": "#19312d",
          "circle-stroke-width": 3,
        },
      })
      map.addSource("live-acquisitions", { type: "geojson", data: { type: "FeatureCollection", features: [] } })
      map.addLayer({ id: "live-acquisition-fill", type: "fill", source: "live-acquisitions", paint: { "fill-color": ["case", ["get", "selected"], "#ee7656", "#24757a"], "fill-opacity": 0.13 } })
      map.addLayer({ id: "live-acquisition-line", type: "line", source: "live-acquisitions", paint: { "line-color": ["case", ["get", "selected"], "#99422f", "#24757a"], "line-width": ["case", ["get", "selected"], 3, 1] } })
      map.on("click", "study-point", (event) => setInspected(String(event.features?.[0].properties?.name ?? "Selected area")))
      const bounds = initialPlace.current.bounds
      map.fitBounds([[bounds[0], Math.max(-85, Math.min(85, bounds[1]))], [bounds[2] < bounds[0] ? bounds[2] + 360 : bounds[2], Math.max(-85, Math.min(85, bounds[3]))]], { padding: 45, duration: 0 })
      setMapReady(true)
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [lowBandwidth])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady) return
    const footprintSource = map.getSource("study-footprint") as GeoJSONSource | undefined
    const pointSource = map.getSource("study-point") as GeoJSONSource | undefined
    footprintSource?.setData(footprint(place))
    pointSource?.setData({ type: "Feature", properties: { name: place.name }, geometry: { type: "Point", coordinates: place.center } })
    map.fitBounds([[place.bounds[0], Math.max(-85, Math.min(85, place.bounds[1]))], [place.bounds[2] < place.bounds[0] ? place.bounds[2] + 360 : place.bounds[2], Math.max(-85, Math.min(85, place.bounds[3]))]], {
      padding: 45,
      duration: 0,
    })
  }, [place, mapReady])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !catalogueItems) return
    const source = map.getSource("live-acquisitions") as GeoJSONSource
    const center = (place.bounds[0] + (place.bounds[2] < place.bounds[0] ? place.bounds[2] + 360 : place.bounds[2])) / 2
    source.setData({ type: "FeatureCollection", features: catalogueItems.map((item) => ({ type: "Feature", properties: { id: item.id, selected: item.id === selectedObservation?.id }, geometry: catalogueMapGeometry(item, center) })) })
    for (const layer of ["live-acquisition-fill", "live-acquisition-line"]) map.setLayoutProperty(layer, "visibility", activeLayers.includes("acquisition-footprint") ? "visible" : "none")
  }, [catalogueItems, mapReady, place.bounds, selectedObservation?.id, activeLayers])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !onObservationSelect) return
    const select = (event: MapLayerMouseEvent) => { const id = event.features?.[0].properties?.id; if (typeof id === "string") onObservationSelect(id) }
    map.on("click", "live-acquisition-fill", select)
    return () => { map.off("click", "live-acquisition-fill", select) }
  }, [mapReady, onObservationSelect])

  useEffect(() => {
    const map = mapRef.current
    if (!map || !mapReady || !analysisManifest || !analysisDate) return
    const manifest = analysisManifest
    const grid = manifest.grid
    const corners = grid.corners.map(([lon, lat]) => [lon, lat]) as [[number, number], [number, number], [number, number], [number, number]]
    const url = `/analysis/${place.id}/${manifest.raster.urls[analysisDate]}`
    let cancelled = false
    const load = async () => {
      try {
        const response = await fetch(url)
        if (!response.ok) return
        const buffer = await response.arrayBuffer()
        if (cancelled) return
        const values = new Int16Array(buffer)
        const canvas = document.createElement("canvas")
        canvas.width = grid.width
        canvas.height = grid.height
        const context = canvas.getContext("2d")
        if (!context) return
        const image = context.createImageData(grid.width, grid.height)
        if (showAnalysisChange && analysisPair) {
          const pair = manifest.pairs[analysisPair] as { delta_url: string } | undefined
          if (!pair) return
          const deltaResponse = await fetch(`/analysis/${place.id}/${pair.delta_url}`)
          if (!deltaResponse.ok || cancelled) return
          const deltaValues = new Int16Array(await deltaResponse.arrayBuffer())
          for (let i = 0; i < deltaValues.length; i += 1) {
            const value = deltaValues[i] / 100
            const alpha = Math.abs(value) < 0.5 ? 0 : Math.min(200, 60 + Math.abs(value) * 24)
            if (value > 0) {
              image.data[i * 4] = 232
              image.data[i * 4 + 1] = 118
              image.data[i * 4 + 2] = 86
              image.data[i * 4 + 3] = alpha
            } else if (value < 0) {
              image.data[i * 4] = 36
              image.data[i * 4 + 1] = 117
              image.data[i * 4 + 2] = 122
              image.data[i * 4 + 3] = alpha
            }
          }
        } else {
          const dateMeta = manifest.dates.find((item) => item.date === analysisDate)
          const lo = dateMeta?.p2_db ?? -25
          const hi = dateMeta?.p98_db ?? -8
          const range = Math.max(hi - lo, 1)
          for (let i = 0; i < values.length; i += 1) {
            if (values[i] <= manifest.raster.invalid + 1) continue
            const db = values[i] / 100
            const shade = Math.round(((db - lo) / range) * 255)
            const clamped = Math.max(0, Math.min(255, shade))
            image.data[i * 4] = clamped
            image.data[i * 4 + 1] = clamped
            image.data[i * 4 + 2] = clamped
            image.data[i * 4 + 3] = 180
          }
        }
        context.putImageData(image, 0, 0)
        const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"))
        if (!blob || cancelled) return
        const nextUrl = URL.createObjectURL(blob)
        const previousUrl = analysisObjectUrlRef.current
        analysisObjectUrlRef.current = nextUrl
        const source = map.getSource("analysis-raster") as { setUrl?: (value: string) => void; updateImage?: (options: { url: string; coordinates: typeof corners }) => void } | undefined
        if (source?.updateImage) source.updateImage({ url: nextUrl, coordinates: corners })
        else if (source?.setUrl) source.setUrl(nextUrl)
        else {
          map.addSource("analysis-raster", { type: "image", url: nextUrl, coordinates: corners })
          map.addLayer({ id: "analysis-raster", type: "raster", source: "analysis-raster", paint: { "raster-opacity": 0.72 } }, "study-point")
        }
        if (previousUrl) URL.revokeObjectURL(previousUrl)
      } catch {
        // Leave the map unchanged if a bundle raster cannot be decoded.
      }
    }
    void load()
    return () => {
      cancelled = true
    }
  }, [analysisManifest, analysisDate, analysisPair, showAnalysisChange, mapReady, place.id])

  useEffect(() => () => {
    if (analysisObjectUrlRef.current) URL.revokeObjectURL(analysisObjectUrlRef.current)
  }, [])

  const visibleLayers = layerDefinitions.filter((layer) => activeLayers.includes(layer.id))

  return (
    <section className={`earth-map ${catalogueItems ? "earth-map--live" : ""}`} aria-label={`Interactive map of ${place.name}`}>
      <div ref={containerRef} className={`earth-map__canvas ${lowBandwidth ? "earth-map__canvas--paused" : ""}`} />
      <div className="earth-map__wash" aria-hidden="true" />
      <div className="earth-map__status">
        <span><span className="live-dot" /> Map / {place.name}</span>
        <small>{selectedObservation ? `${selectedObservation.platform} / ${selectedObservation.processingLevel}` : "Select an observation"}</small>
      </div>
      <div className="earth-map__layer-visuals" data-module={moduleId} aria-hidden="true">
        {fixtureData && visibleLayers.map((layer, index) => (
          <span key={`${layer.moduleId}-${layer.id}`} style={{ "--layer-color": layer.color, "--layer-index": index } as React.CSSProperties} />
        ))}
      </div>
      {lowBandwidth && <div className="earth-map__low-data"><Icon name="info" size={15} /> Low-bandwidth mode: remote basemap tiles are paused.</div>}
      {onAreaChange && <button className="earth-map__search-area" type="button" disabled={!mapReady || lowBandwidth} onClick={() => {
        const bounds = mapRef.current!.getBounds()
        const wrap = (value: number) => ((value + 180) % 360 + 360) % 360 - 180
        const world = bounds.getEast() - bounds.getWest() >= 360
        onAreaChange([world ? -180 : wrap(bounds.getWest()), Math.max(-90, bounds.getSouth()), world ? 180 : wrap(bounds.getEast()), Math.min(90, bounds.getNorth())])
      }}>Search this map area</button>}
      {catalogueItems && selectedObservation && activeLayers.includes("sar-preview") && (
        <details className="earth-map__preview" open>
          <summary>Selected SAR image</summary>
          {lowBandwidth ? <p>Image paused in low-bandwidth mode.</p> : selectedObservation.imageUrl && failedPreview !== selectedObservation.imageUrl ? <img src={selectedObservation.imageUrl} alt={`Official SAR browse image acquired ${selectedObservation.acquiredAt}`} onError={() => setFailedPreview(selectedObservation.imageUrl)} /> : <p>Source preview unavailable.</p>}
          <p>Official browse image, not a georeferenced map layer. Open Compare for the full view.</p>
        </details>
      )}
      {inspected && (
        <div className="earth-map__inspection">
          <button type="button" aria-label="Close inspected feature" onClick={() => setInspected(null)}><Icon name="close" size={14} /></button>
          <strong>{inspected}</strong>
          <span>Feature inspection / {fixtureData ? "fixture" : "API"} geometry</span>
        </div>
      )}
      <div className="earth-map__legend">
        <strong>{fixtureData ? "Fixture layer previews" : "Live source layers"}</strong>
        {visibleLayers.length ? visibleLayers.map((layer) => (
          <span key={`${layer.moduleId}-${layer.id}`}><i style={{ background: layer.color }} />{layer.label}<DataBadge value={layer.classification} /></span>
        )) : <span>No analytical layers selected</span>}
      </div>
      <details className="earth-map__text-alternative">
        <summary>Map text alternative</summary>
        <p>{place.description}</p>
        <ul>
          <li>Center: {place.center[1].toFixed(3)}, {place.center[0].toFixed(3)}</li>
          {visibleLayers.map((layer) => <li key={`${layer.moduleId}-${layer.id}`}>{layer.label}: {layer.description}</li>)}
        </ul>
        <button type="button" className="earth-map__feature-button" onClick={() => setInspected(`${place.name} study reference`)}>Inspect study reference</button>
      </details>
    </section>
  )
}
