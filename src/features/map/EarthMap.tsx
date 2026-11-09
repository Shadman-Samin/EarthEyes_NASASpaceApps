import { useEffect, useRef, useState } from "react"
import {
  AttributionControl,
  type GeoJSONSource,
  Map as MapLibreMap,
  NavigationControl,
  type StyleSpecification,
} from "maplibre-gl"
import type { LayerDefinition, ModuleId, Observation, Place } from "../../domain/models"
import { prefersLowBandwidth } from "../../shared/network"
import { DataBadge, Icon } from "../../shared/ui"
import { getDataOrigin } from "../../data/repository"

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
  geometry: {
    type: "Polygon" as const,
    coordinates: [[
      [place.bounds[0], place.bounds[1]],
      [place.bounds[2], place.bounds[1]],
      [place.bounds[2], place.bounds[3]],
      [place.bounds[0], place.bounds[3]],
      [place.bounds[0], place.bounds[1]],
    ]],
  },
})

export function EarthMap({
  place,
  moduleId,
  activeLayers,
  layerDefinitions,
  selectedObservation,
}: {
  place: Place
  moduleId: ModuleId
  activeLayers: string[]
  layerDefinitions: LayerDefinition[]
  selectedObservation?: Observation
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  const mapRef = useRef<MapLibreMap | null>(null)
  const initialPlace = useRef(place)
  const initialModuleId = useRef(moduleId)
  const [inspected, setInspected] = useState<string | null>(null)
  const lowBandwidth = prefersLowBandwidth()
  const fixtureData = getDataOrigin() === "fixture"

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
      map.on("click", "study-point", () => setInspected(`${initialPlace.current.name} study reference`))
      const bounds = initialPlace.current.bounds
      map.fitBounds([[bounds[0], bounds[1]], [bounds[2], bounds[3]]], { padding: 70, duration: 0 })
    })
    return () => {
      map.remove()
      mapRef.current = null
    }
  }, [lowBandwidth])

  useEffect(() => {
    const map = mapRef.current
    if (!map?.isStyleLoaded()) return
    const footprintSource = map.getSource("study-footprint") as GeoJSONSource | undefined
    const pointSource = map.getSource("study-point") as GeoJSONSource | undefined
    footprintSource?.setData(footprint(place))
    pointSource?.setData({ type: "Feature", properties: { name: place.name }, geometry: { type: "Point", coordinates: place.center } })
    map.fitBounds([[place.bounds[0], place.bounds[1]], [place.bounds[2], place.bounds[3]]], {
      padding: 70,
      duration: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 0 : 700,
    })
  }, [place])

  const visibleLayers = layerDefinitions.filter((layer) => activeLayers.includes(layer.id))

  return (
    <section className="earth-map" aria-label={`Interactive map of ${place.name}`}>
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
      {!fixtureData && visibleLayers.length > 0 && <div className="earth-map__asset-state"><Icon name="info" size={15} /> Connected layer metadata loaded. Analytical assets render only when the API supplies map tiles.</div>}
      {inspected && (
        <div className="earth-map__inspection">
          <button type="button" aria-label="Close inspected feature" onClick={() => setInspected(null)}><Icon name="close" size={14} /></button>
          <strong>{inspected}</strong>
          <span>Feature inspection / {fixtureData ? "fixture" : "API"} geometry</span>
        </div>
      )}
      <div className="earth-map__legend">
        <strong>{fixtureData ? "Fixture layer previews" : "Selected layers"}</strong>
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
