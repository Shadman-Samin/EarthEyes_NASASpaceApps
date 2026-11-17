import { Link } from "react-router-dom"
import type { AnalysisResult } from "../../domain/analysis"
import { catalogueProducts } from "../../domain/catalogue"
import { KUAKATA_PILOT_URL } from "../../shared/links"

export type AnalysisOverlayMode = "water" | "delta" | "off"
const format = (number: number) => number.toLocaleString("en-US", { maximumFractionDigits: 3 })

export function CalibratedAnalysis({ result, loading, error, overlay, onOverlayChange }: {
  result?: AnalysisResult
  loading: boolean
  error?: string
  overlay: AnalysisOverlayMode
  onOverlayChange: (mode: AnalysisOverlayMode) => void
}) {
  if (!result || result.status === "analysis_unavailable") return (
    <section className="calibrated-analysis calibrated-analysis--unavailable" aria-label="Published analysis availability">
      <span className="section-kicker">Calibrated-source processing</span>
      <h2>{loading ? "Checking published analysis" : error ? "Analysis service unavailable" : "No matching precomputed analysis"}</h2>
      <p role="status">{loading ? "Checking the exact bounds, dates, product and polarization." : error ?? (result?.status === "analysis_unavailable" ? result.reason : "Select a valid area and date range.")}</p>
      {!loading && <><p>Live browse previews are not calibrated measurements. No job or substitute result has been created.</p><Link className="calibrated-pilot-link" to={KUAKATA_PILOT_URL}>Open Kuakata pilot</Link></>}
    </section>
  )
  const bundle = result.manifest
  const water = bundle.claims.find((claim) => claim.id === "water_extent_change")
  const crossedZero = water?.sensitivity && water.sensitivity.low <= 0 && water.sensitivity.high >= 0
  const points = bundle.time_series
  const isWater = points.every((point) => point.water_km2 !== undefined)
  const values = points.map((point) => isWater ? point.water_km2! : point.mean_db)
  const low = Math.min(...points.map((point, index) => isWater ? point.water_low_km2 ?? values[index] : values[index]))
  const high = Math.max(...points.map((point, index) => isWater ? point.water_high_km2 ?? values[index] : values[index]))
  const axisLow = high === low ? low - 0.5 : low
  const axisHigh = high === low ? high + 0.5 : high
  const time0 = Date.parse(points[0].date)
  const span = Math.max(1, Date.parse(points.at(-1)!.date) - time0)
  const x = (day: string) => 30 + (Date.parse(day) - time0) / span * 268
  const y = (value: number) => 119 - (value - axisLow) / (axisHigh - axisLow) * 83
  const source = bundle.provenance.source_processing
  return (
    <section className="calibrated-analysis" aria-labelledby="calibrated-heading">
      <header className="calibrated-analysis__head">
        <span className="section-kicker">NISAR / precomputed evidence</span>
        <h2 id="calibrated-heading">Calibrated source analysis</h2>
        <span className="calibrated-status">Exploratory result, not ground-truth validated</span>
        <p><strong>{bundle.label}</strong> / {bundle.polarization} / {bundle.grid.spacing_m} m / source maturity: {bundle.source_maturity}</p>
      </header>
      <div className="calibrated-epochs">
        <div><span>First epoch</span><strong>{bundle.epochs.first.dates[0]} to {bundle.epochs.first.dates.at(-1)}</strong></div>
        <div><span>Last epoch</span><strong>{bundle.epochs.last.dates[0]} to {bundle.epochs.last.dates.at(-1)}</strong></div>
      </div>
      <p className="calibrated-scope">Fixed {bundle.epochs.first.dates.length}-date median epochs, independent of the live preview pair. Common valid ground: {format(bundle.change.common_valid_area_km2)} km2 ({format(bundle.change.common_valid_fraction * 100)}% of this ROI).</p>
      <div className="calibrated-metrics">
        {bundle.claims.map((claim) => <article key={claim.id}>
          <h3>{claim.label}</h3>
          <strong>{format(claim.value)} <small>{claim.unit}</small></strong>
          {claim.sensitivity && <p className="calibrated-range">Sensitivity: {format(claim.sensitivity.low)} to {format(claim.sensitivity.high)} {claim.unit}</p>}
          <p>{claim.sensitivity?.basis ?? claim.method}</p>
        </article>)}
      </div>
      {crossedZero && <p className="calibrated-caution">The water-change sensitivity range crosses zero; a direction is not established.</p>}
      <p className="calibrated-caution">Zero retained area is not proof of no change. The noise screen is conditional, not a validated detection limit.</p>
      {bundle.raster ? <fieldset className="calibrated-overlay-controls">
        <legend>Analytical map overlay</legend>
        {bundle.raster.water_change_url && <button type="button" aria-pressed={overlay === "water"} onClick={() => onOverlayChange("water")}>Water candidates</button>}
        <button type="button" aria-pressed={overlay === "delta"} onClick={() => onOverlayChange("delta")}>Brightness screen</button>
        <button type="button" aria-pressed={overlay === "off"} onClick={() => onOverlayChange("off")}>Hide overlay</button>
      </fieldset> : <p>No map display is available for this projection; measurements remain in the native grid.</p>}
      <figure className="calibrated-chart">
        <figcaption>{isWater ? "Water-candidate area (km2)" : "Mean backscatter (dB)"}</figcaption>
        <svg viewBox="0 0 320 150" role="img" aria-label={isWater ? "Water-candidate time series with threshold sensitivity ranges" : "Calibrated backscatter time series"}>
          <line x1="30" y1="119" x2="298" y2="119" className="calibrated-chart__axis" />
          <text x="4" y="32">{format(axisHigh)}</text><text x="4" y="124">{format(axisLow)}</text>
          {isWater && points.map((point) => <line key={point.date} x1={x(point.date)} x2={x(point.date)} y1={y(point.water_low_km2 ?? point.water_km2!)} y2={y(point.water_high_km2 ?? point.water_km2!)} className="calibrated-chart__range" />)}
          <path d={points.map((point, index) => `${index ? "L" : "M"}${x(point.date)},${y(values[index])}`).join(" ")} className="calibrated-chart__line" />
          {points.map((point, index) => <circle key={point.date} cx={x(point.date)} cy={y(values[index])} r="3"><title>{point.date}: {format(values[index])}</title></circle>)}
          <text x="30" y="143">{points[0].date}</text><text x="298" y="143" textAnchor="end">{points.at(-1)!.date}</text>
        </svg>
        <p>{isWater ? "Vertical lines: +/-1 dB threshold sensitivity, not confidence intervals." : "Descriptive means on a fixed common footprint."}</p>
      </figure>
      <div className="calibrated-table">
        <table><caption>Calibrated time series</caption><thead><tr><th>Date / source</th><th>Mean dB</th>{isWater && <th>Water km2</th>}</tr></thead>
          <tbody>{points.map((point, index) => <tr key={point.date}><td><a href={`https://cmr.earthdata.nasa.gov/stac/ASF/collections/${catalogueProducts[bundle.product].collectionId}/items/${encodeURIComponent(bundle.dates[index].granule)}`} target="_blank" rel="noreferrer">{point.date}</a></td><td>{format(point.mean_db)}</td>{isWater && <td>{format(point.water_km2!)}</td>}</tr>)}</tbody>
        </table>
      </div>
      <section className="calibrated-references" aria-label="Independent references">
        <h3>Independent references</h3>
        <p>Cross-sensor class agreement is corroboration, not ground truth or proof of change.</p>
        {bundle.validation.references.map((check) => <details key={check.source}>
          <summary>{check.source}: {check.compared_dates}/{check.attempted_dates} dates compared{check.mean_iou !== null ? ` / mean IoU ${check.mean_iou}` : ""}</summary>
          <p>{check.method}. {check.unique_scenes} distinct reference scenes.</p>
          <ul>{check.dates.map((row) => <li key={row.date}>{row.date}: {row.status.replace(/_/g, " ")}{row.coverage !== undefined ? ` (${format(row.coverage * 100)}% coverage)` : ""}{row.offset_days !== undefined ? ` / offset ${row.offset_days} days` : ""}{row.reason ? ` / ${row.reason}` : ""}{row.source_url && <> / <a href={row.source_url} target="_blank" rel="noreferrer">Reference scene</a></>}</li>)}</ul>
        </details>)}
        {bundle.validation.status === "unchecked" && <p>Independent checks have not been run.</p>}
        {bundle.validation.maturity && <details><summary>Other NISAR releases</summary>
          <ul>{bundle.validation.maturity.collections.map((row) => <li key={row.product}>{row.product}: {row.status === "unavailable" ? "release search unavailable; coverage unknown." : `${row.matching_dates} matching dates; ${row.compared_dates} radiometric comparisons.`}</li>)}</ul>
          <p>{bundle.validation.maturity.limitation}</p>
        </details>}
      </section>
      <details className="calibrated-method">
        <summary>Method, source processing and limits</summary>
        <p>Track {bundle.provenance.series.relative_orbit}, frame {bundle.provenance.series.frame}, baseline {bundle.provenance.series.baseline}. Algorithm {bundle.provenance.algorithm_version}.</p>
        <p>Source RTC applied: {source.radiometricTerrainCorrectionApplied ?? "unknown"}. Source noise correction applied: {source.noiseCorrectionApplied ?? "unknown"}. Source shadow masking applied: {source.shadowMaskingApplied ?? "unknown"}.</p>
        <p>{bundle.grid.area_basis}. Median conditional screening threshold: {format(bundle.change.median_conditional_threshold_db)} dB; actual thresholds vary by pixel.</p>
        <ul>{bundle.limitations.map((limit) => <li key={limit}>{limit}</li>)}</ul>
        <p>Bundle <code>{bundle.id}</code></p>
        <a href={`${import.meta.env.BASE_URL.replace(/\/$/, "")}/analysis/${encodeURIComponent(bundle.site)}/manifest.json`} target="_blank" rel="noreferrer">Open full provenance JSON</a>
      </details>
    </section>
  )
}
