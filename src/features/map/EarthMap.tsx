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
}: {
  place: Place
  moduleId: ModuleId
  activeLayers: string[]
  layerDefinitions: LayerDefinition[]
  selectedObservation?: Observation
  catalogueItems?: CatalogueItem[]
  onAreaChange?: (bounds: CatalogueBounds) => void
  onObservationSelect?: (id: string) => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
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
