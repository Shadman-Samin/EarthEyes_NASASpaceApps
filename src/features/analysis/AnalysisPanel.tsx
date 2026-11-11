import type { AnalysisManifest } from "./analysisBundle"
import { DataBadge, Icon } from "../../shared/ui"
import "./analysis.css"

function Metric({ label, value, unit }: { label: string; value: string | number; unit?: string }) {
  return (
    <article className="analysis-metric">
      <span>{label}</span>
      <strong>{value}{unit ? <small> {unit}</small> : null}</strong>
    </article>
  )
}

function Sparkline({ values }: { values: number[] }) {
  if (values.length < 2) return null
  const min = Math.min(...values)
  const max = Math.max(...values)
  const range = Math.max(max - min, 1e-6)
  const points = values.map((value, index) => {
    const x = (index / (values.length - 1)) * 100
    const y = 100 - ((value - min) / range) * 100
    return `${x},${y}`
  }).join(" ")
  return (
    <svg className="analysis-sparkline" viewBox="0 0 100 100" role="img" aria-label="Time series">
      <polyline points={points} />
    </svg>
  )
}

export function AnalysisPanel({
  manifest,
  date,
  onDateChange,
  pair,
  onPairChange,
  showChange,
  onShowChange,
}: {
  manifest: AnalysisManifest
  date: string
  onDateChange: (date: string) => void
  pair: string
  onPairChange: (pair: string) => void
  showChange: boolean
  onShowChange: (value: boolean) => void
}) {
  const coastal = manifest.phenomenon === "coastal-water-change"
  const currentPair = manifest.pairs[pair] as {
    from: string
    to: string
    changed_area_km2: number
    gain_area_km2: number
    loss_area_km2: number
    story?: { headline: string; summary: string }
    clusters: Array<{ kind: string; area_km2: number; id: number }>
  } | undefined
  const coverage = Math.round((manifest.dates.find((item) => item.date === date)?.valid_fraction ?? 1) * 100)
  const pairFrom = currentPair?.from ?? manifest.dates[0]?.date ?? ""
  const pairTo = currentPair?.to ?? manifest.dates.at(-1)?.date ?? ""
  const waterFrom = (manifest.water[pairFrom] as { area_km2: number } | undefined)?.area_km2 ?? 0
  const waterTo = (manifest.water[pairTo] as { area_km2: number } | undefined)?.area_km2 ?? 0
  const waterDelta = waterTo - waterFrom
  const seriesValues = coastal
    ? manifest.time_series.map((item) => item.water_fraction ?? 0)
    : manifest.time_series.map((item) => item.mean_db)
  const topClusters = (currentPair?.clusters ?? []).slice(0, 3)
  const headline = currentPair?.story?.headline ?? manifest.story.headline
  const summary = currentPair?.story?.summary ?? manifest.story.summary

  return (
    <section className="analysis-panel" aria-label="Calibrated change analysis">
      <header className="analysis-panel__header">
        <div>
          <span className="section-kicker">Calibrated change</span>
          <h3>{headline}</h3>
        </div>
        <DataBadge value="derived" />
      </header>
      <p className="analysis-story">{summary}</p>
      <p className="analysis-note">{manifest.story.detail}</p>

      <div className="analysis-metrics">
        {coastal ? (
          <>
            <Metric label={`Water on ${pairTo}`} value={waterTo.toFixed(1)} unit="km²" />
            <Metric label="Change" value={`${waterDelta >= 0 ? "+" : ""}${waterDelta.toFixed(1)}`} unit="km²" />
            <Metric label="Changed area" value={currentPair?.changed_area_km2.toFixed(0) ?? "0"} unit="km²" />
            <Metric label="Valid coverage" value={coverage} unit="%" />
          </>
        ) : (
          <>
            <Metric label="Changed area" value={currentPair?.changed_area_km2.toFixed(0) ?? "0"} unit="km²" />
            <Metric label="Gain" value={currentPair?.gain_area_km2.toFixed(0) ?? "0"} unit="km²" />
            <Metric label="Loss" value={currentPair?.loss_area_km2.toFixed(0) ?? "0"} unit="km²" />
            <Metric label="Valid coverage" value={coverage} unit="%" />
          </>
        )}
      </div>

      <div className="analysis-controls">
        <label>
          <span>Map date</span>
          <select value={date} onChange={(event) => onDateChange(event.target.value)}>
            {manifest.dates.map((item) => (
              <option key={item.date} value={item.date}>
                {item.date}
              </option>
            ))}
          </select>
        </label>
        <label>
          <span>Compare</span>
          <select value={pair} onChange={(event) => onPairChange(event.target.value)}>
            {Object.keys(manifest.pairs).map((key) => (
              <option key={key} value={key}>
                {(manifest.pairs[key] as { from: string; to: string }).from} to {(manifest.pairs[key] as { from: string; to: string }).to}
              </option>
            ))}
          </select>
        </label>
        <button type="button" className="analysis-toggle" aria-pressed={showChange} onClick={() => onShowChange(!showChange)}>
          <Icon name="compare" size={14} /> {showChange ? "Hide change" : "Show change"}
        </button>
      </div>

      <div className="analysis-chart">
        <span className="section-kicker">{coastal ? "Water area over time" : "Mean backscatter over time"}</span>
        <Sparkline values={seriesValues} />
      </div>

      {topClusters.length > 0 && (
        <ul className="analysis-clusters">
          {topClusters.map((cluster: { kind: string; area_km2: number; id: number }) => (
            <li key={`${cluster.kind}-${cluster.id}`}>
              <strong>{cluster.kind === "gain" ? "Brighter" : cluster.kind === "loss" ? "Darker" : "Changed"}</strong>
              <span>{cluster.area_km2.toFixed(1)} km²</span>
            </li>
          ))}
        </ul>
      )}

      <details className="analysis-provenance">
        <summary>Source and limitations</summary>
        <p>{manifest.provenance.product} · {manifest.provenance.polarization} · provisional calibration.</p>
        <ul>
          {manifest.limitations.map((limitation) => (
            <li key={limitation}>{limitation}</li>
          ))}
        </ul>
      </details>
    </section>
  )
}
