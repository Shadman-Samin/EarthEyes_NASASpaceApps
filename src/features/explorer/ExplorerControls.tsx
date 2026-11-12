import type { ComparisonMode, LayerDefinition, ModuleId, Observation, Place } from "../../domain/models"
import { moduleRegistry } from "../../domain/module-registry"
import { formatDate } from "../../shared/formatting"
import { Icon } from "../../shared/ui"
import { PlaceSearch } from "../search/PlaceSearch"
import type { ReactNode } from "react"

const modes: Array<{ id: ComparisonMode; label: string }> = [
  { id: "side-by-side", label: "Side by side" },
  { id: "swipe", label: "Swipe" },
  { id: "difference", label: "Difference" },
  { id: "fade", label: "Fade" },
  { id: "single", label: "Single" },
]

export function ExplorerControls({
  place,
  moduleId,
  mode,
  observations,
  leftId,
  rightId,
  onPlaceChange,
  onModuleChange,
  onModeChange,
  onPairChange,
  archive,
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
  archive?: ReactNode
  dataOrigin?: "fixture" | "live"
}) {
  const left = observations.find((observation) => observation.id === leftId)
  const right = observations.find((observation) => observation.id === rightId)

  return (
    <aside className="control-rail" aria-label="Explorer controls">
      <div className="control-rail__section control-rail__search">
        <label className="control-label"><Icon name="search" size={16} /> Search any location</label>
        <PlaceSearch currentPlace={place} onSelect={onPlaceChange} compact />
      </div>

      {archive}

      <section className="control-rail__section">
        <p className="control-label"><Icon name="check" size={14} /> Auto analysis</p>
        <p className="auto-note">Best dates and view are selected automatically from pulled data. Summary, Chart and Context update in real time for this location.</p>
        {left && right && <p className="auto-note"><strong>Comparing:</strong> {formatDate(left.acquiredAt)} → {formatDate(right.acquiredAt)}</p>}
      </section>

      <details className="control-rail__section control-advanced">
        <summary className="control-label">Advanced (optional)</summary>
        {place.moduleIds.length > 1 && (
          <fieldset>
            <legend>View type</legend>
            <div className="module-picker">
              {place.moduleIds.map((id) => (
                <button key={id} type="button" aria-pressed={moduleId === id} onClick={() => onModuleChange(id)}>
                  <span style={{ background: moduleRegistry[id].accent }} />
                  <strong>{moduleRegistry[id].shortLabel}</strong>
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <fieldset>
          <legend>Compare view</legend>
          <div className="mode-picker">
            {modes.map((item) => (
              <button key={item.id} type="button" aria-pressed={mode === item.id} onClick={() => onModeChange(item.id)}>{item.label}</button>
            ))}
          </div>
        </fieldset>
        {observations.length > 1 && (
          <fieldset className="observation-pair">
            <legend>Pick dates</legend>
            <label><span>Earlier</span>
              <select value={leftId} onChange={(event) => onPairChange(event.target.value, rightId)}>
                {observations.map((o) => <option key={o.id} value={o.id}>{formatDate(o.acquiredAt)} / {o.platform}</option>)}
              </select>
            </label>
            <label><span>Later</span>
              <select value={rightId} onChange={(event) => onPairChange(leftId, event.target.value)}>
                {observations.map((o) => <option key={o.id} value={o.id}>{formatDate(o.acquiredAt)} / {o.platform}</option>)}
              </select>
            </label>
          </fieldset>
        )}
      </details>
    </aside>
  )
}
