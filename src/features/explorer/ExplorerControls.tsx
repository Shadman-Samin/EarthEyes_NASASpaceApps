import type { ComparisonMode, LayerDefinition, ModuleId, Observation, Place } from "../../domain/models"
import { moduleRegistry } from "../../domain/module-registry"
import { formatDate } from "../../shared/formatting"
import { DataBadge, Icon, QualityBadge } from "../../shared/ui"
import { PlaceSearch } from "../search/PlaceSearch"
import { getCompatibility } from "../comparison/compatibility"
import { getDataOrigin } from "../../data/repository"

const modes: Array<{ id: ComparisonMode; label: string }> = [
  { id: "swipe", label: "Swipe" },
  { id: "side-by-side", label: "Side by side" },
  { id: "single", label: "Single" },
  { id: "difference", label: "Difference" },
  { id: "fade", label: "Fade" },
]

export function ExplorerControls({
  place,
  moduleId,
  mode,
  observations,
  leftId,
  rightId,
  layers,
  activeLayers,
  onPlaceChange,
  onModuleChange,
  onModeChange,
  onPairChange,
  onToggleLayer,
}: {
  place: Place
  moduleId: ModuleId
  mode: ComparisonMode
  observations: Observation[]
  leftId: string
  rightId: string
  layers: LayerDefinition[]
  activeLayers: string[]
  onPlaceChange: (place: Place) => void
  onModuleChange: (moduleId: ModuleId) => void
  onModeChange: (mode: ComparisonMode) => void
  onPairChange: (leftId: string, rightId: string) => void
  onToggleLayer: (id: string) => void
}) {
  const left = observations.find((observation) => observation.id === leftId)
  const right = observations.find((observation) => observation.id === rightId)
  const compatibility = getCompatibility(left, right)
  const fixtureData = getDataOrigin() === "fixture"

  return (
    <aside className="control-rail" aria-label="Explorer controls">
      <div className="control-rail__section control-rail__search">
        <label className="control-label"><Icon name="search" size={14} /> Find place</label>
        <PlaceSearch currentPlace={place} onSelect={onPlaceChange} compact />
      </div>

      <fieldset className="control-rail__section">
        <legend className="control-label"><Icon name="globe" size={14} /> Phenomenon</legend>
        <div className="module-picker">
          {place.moduleIds.map((id) => (
            <button key={id} type="button" aria-pressed={moduleId === id} onClick={() => onModuleChange(id)}>
              <span style={{ background: moduleRegistry[id].accent }} />
              <strong>{moduleRegistry[id].shortLabel}</strong>
              <small>{id === "glof" ? "Reviewed hazard context" : moduleRegistry[id].title}</small>
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="control-rail__section">
        <legend className="control-label"><Icon name="compare" size={14} /> Display mode</legend>
        <div className="mode-picker">
          {modes.map((item) => (
            <button
              key={item.id}
              type="button"
              aria-pressed={mode === item.id}
              disabled={item.id === "difference" && compatibility.level !== "compatible"}
              onClick={() => onModeChange(item.id)}
            >
              {item.label}
            </button>
          ))}
        </div>
      </fieldset>

      <fieldset className="control-rail__section observation-pair">
        <legend className="control-label"><Icon name="calendar" size={14} /> Observations</legend>
        {mode !== "single" && (
          <label>
            <span>Earlier / left</span>
            <select value={leftId} onChange={(event) => onPairChange(event.target.value, rightId)}>
              {observations.map((observation) => (
                <option key={observation.id} value={observation.id}>{formatDate(observation.acquiredAt)} / {observation.platform}</option>
              ))}
            </select>
          </label>
        )}
        <label>
          <span>{mode === "single" ? "Selected date" : "Later / right"}</span>
          <select value={rightId} onChange={(event) => onPairChange(leftId, event.target.value)}>
            {observations.map((observation) => (
              <option key={observation.id} value={observation.id}>{formatDate(observation.acquiredAt)} / {observation.platform}</option>
            ))}
          </select>
        </label>
        {right && (
          <div className="observation-pair__state">
            <DataBadge value={right.classification} /> <QualityBadge value={right.quality} />
          </div>
        )}
      </fieldset>

      <fieldset className="control-rail__section">
        <legend className="control-label"><Icon name="layers" size={14} /> Evidence layers</legend>
        <div className="layer-list">
          {layers.map((layer) => (
            <label key={`${layer.moduleId}-${layer.id}`}>
              <input type="checkbox" checked={activeLayers.includes(layer.id)} onChange={() => onToggleLayer(layer.id)} />
              <i style={{ background: layer.color }} />
              <span><strong>{layer.label}</strong><small>{layer.classification}{layer.unit ? ` / ${layer.unit}` : ""}</small></span>
            </label>
          ))}
        </div>
      </fieldset>

      <div className="control-rail__data-state">
        <span><span className={`live-dot ${fixtureData ? "live-dot--fixture" : ""}`} /> {fixtureData ? "Fixture data" : "Connected data"}</span>
        <small>{fixtureData ? "Typed mock repository / no live feed" : "Configured EarthEyes API"}</small>
      </div>
    </aside>
  )
}
