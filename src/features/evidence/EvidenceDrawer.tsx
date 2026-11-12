import { useEffect, useRef, useState } from "react"
import * as Tabs from "@radix-ui/react-tabs"
import type { DataSource, LayerDefinition, ModuleId, Observation, Place } from "../../domain/models"
import type { AcquisitionSeriesPoint, RealtimeContext } from "../analysis/realtime"
import type { BrowseComparison } from "../comparison/useBrowseComparison"
import { generateNarrative, type Narrative } from "../analysis/narrative"
import { formatDate, formatDateTime } from "../../shared/formatting"
import { acquisitionGroupLabel } from "../../data/live-explorer"
import { DataBadge, Icon, StatePanel } from "../../shared/ui"

function DiffCanvas({ result }: { result: NonNullable<BrowseComparison["result"]> }) {
  const ref = useRef<HTMLCanvasElement>(null)
  useEffect(() => {
    const c = ref.current
    if (!c) return
    c.width = result.width
    c.height = result.height
    c.getContext("2d")?.putImageData(new ImageData(result.pixels, result.width, result.height), 0, 0)
  }, [result])
  return <canvas ref={ref} className="realtime-diff-canvas" aria-label="Computed visual difference from pulled preview images" />
}

function SummaryTab({ place, ctx, compared, browse, series }: { place: Place; ctx: RealtimeContext; compared: { left: Observation; right: Observation } | null; browse: BrowseComparison; series: AcquisitionSeriesPoint[] }) {
  const [narrativeState, setNarrativeState] = useState<{ key: string; value: Narrative | null }>({ key: "", value: null })
  const pairKey = compared
    ? `${compared.left.id}|${compared.right.id}|${browse.status}|${browse.summary?.changedPct ?? ""}`
    : `acq-${series.length}-${ctx.dateWindow?.start ?? ""}-${ctx.dateWindow?.end ?? ""}`
  const loadingNarrative = narrativeState.key !== pairKey
  const narrative = narrativeState.key === pairKey ? narrativeState.value : null
  useEffect(() => {
    let cancelled = false
    generateNarrative({ ctx, diff: browse.summary ?? null, earlierImageUrl: compared?.left.imageUrl ?? undefined, laterImageUrl: compared?.right.imageUrl ?? undefined })
      .then((n) => { if (!cancelled) setNarrativeState({ key: pairKey, value: n }) })
      .catch(() => { if (!cancelled) setNarrativeState({ key: pairKey, value: null }) })
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pairKey])

  const first = series[0]
  const last = series[series.length - 1]
  const noComparison = !compared

  return (
    <div className="evidence-summary realtime-evidence">
      <div className="evidence-summary__place">
        <span className="section-kicker">Real-time analysis</span>
        <h2>{place.name}</h2>
        <p>Generated now from {series.length} pulled acquisition{series.length === 1 ? "" : "s"} over {ctx.areaLabel} · {acquisitionGroupLabel(ctx.groupLabel)} ({ctx.acquisitionCount} records loaded across {ctx.groupCount} footprints).</p>
      </div>

      <article className="realtime-summary-card">
        <div className="realtime-summary-card__head">
          <DataBadge value={compared ? "derived" : "observed"} />
          <span className="section-kicker">
            {compared
              ? browse.status === "ready" ? "Visual comparison (computed from pulled images)" : "Preparing visual comparison…"
              : "Acquisition overview — comparison needs 2 or more dates"}
          </span>
        </div>
        <h3>{narrative?.headline ?? (browse.summary?.headline || (compared ? `Comparing ${ctx.comparedPair?.from} → ${ctx.comparedPair?.to}` : `${series.length} acquisition${series.length === 1 ? "" : "s"} for ${place.name}`))}</h3>
        <p className="realtime-lead">{loadingNarrative ? "Interpreting the pulled data…" : (narrative?.summary ?? browse.summary?.detail ?? (compared ? "Computing visual change from the pulled preview images." : "Showing the pulled acquisition record. A before/after view appears when at least two dates are available."))}</p>
        {narrative?.source && <small className="narrative-source">Interpretation: {narrative.source === "groq-vision" ? "Groq vision (imagery + facts)" : narrative.source === "groq" ? "Groq (from live facts)" : "computed summary"}</small>}

        {compared ? (
          <>
            <div className="realtime-visual-grid">
              <figure>
                {compared.left.imageUrl ? <img src={compared.left.imageUrl} alt={`Earlier radar preview ${formatDateTime(compared.left.acquiredAt)}`} loading="lazy" /> : <div className="realtime-img-missing">No preview</div>}
                <figcaption>Earlier · {formatDate(compared.left.acquiredAt)}</figcaption>
              </figure>
              <figure>
                {compared.right.imageUrl ? <img src={compared.right.imageUrl} alt={`Later radar preview ${formatDateTime(compared.right.acquiredAt)}`} loading="lazy" /> : <div className="realtime-img-missing">No preview</div>}
                <figcaption>Later · {formatDate(compared.right.acquiredAt)}</figcaption>
              </figure>
              <figure className="realtime-diff-figure">
                {browse.status === "ready" && browse.result ? <DiffCanvas result={browse.result} /> : <div className="realtime-img-missing">{browse.status === "loading" ? "Computing difference…" : browse.status === "error" ? (browse.error || "Analysis unavailable") : "No comparable previews"}</div>}
                <figcaption>Computed difference (warm = brighter later, teal = darker later)</figcaption>
              </figure>
            </div>

            {browse.summary && (
              <div className="realtime-metrics" aria-label="Computed change metrics">
                <div className="realtime-metric"><strong>{browse.summary.changedPct}%</strong><span>visibly changed</span></div>
                <div className="realtime-metric"><strong>{browse.summary.brighterPct}%</strong><span>brighter later</span></div>
                <div className="realtime-metric"><strong>{browse.summary.darkerPct}%</strong><span>darker later</span></div>
                <div className="realtime-metric"><strong>{series.length}</strong><span>acquisitions</span></div>
              </div>
            )}
          </>
        ) : (
          <div className="realtime-single">
            <dl className="realtime-facts">
              <div><dt>Acquisition dates</dt><dd>{series.length || 0}</dd></div>
              <div><dt>Records loaded</dt><dd>{ctx.acquisitionCount} across {ctx.groupCount} footprint{ctx.groupCount === 1 ? "" : "s"}</dd></div>
              <div><dt>Date range</dt><dd>{first && last ? `${formatDate(first.acquiredAt)} → ${formatDate(last.acquiredAt)}` : ctx.dateWindow ? `${ctx.dateWindow.start} → ${ctx.dateWindow.end}` : "No dates loaded"}</dd></div>
              <div><dt>Product</dt><dd>{ctx.productLabel}</dd></div>
              <div><dt>Footprint</dt><dd>{acquisitionGroupLabel(ctx.groupLabel)}</dd></div>
              <div><dt>Source maturity</dt><dd>{ctx.sourceMaturity}</dd></div>
            </dl>
            {series.length === 0 ? (
              <StatePanel compact title="No radar records in this window" message={`Nothing was returned for ${ctx.areaLabel}. Widen the dates or move the map, then the timeline and summary will fill in automatically.`} icon="calendar" />
            ) : (
              <p className="realtime-hint"><Icon name="info" size={15} /> One acquisition is enough for the timeline and metadata. It is not enough for a before/after difference; load more records or widen the date window.</p>
            )}
          </div>
        )}

        <details className="realtime-limits" open={noComparison && series.length === 0}>
          <summary>What this means &amp; limits</summary>
          <ul>{(narrative?.limits ?? ["Exploratory comparison of pulled preview images, not a calibrated measurement."]).map((l, i) => <li key={i}>{l}</li>)}</ul>
        </details>
      </article>

      {series.length > 0 && (
        <div className="realtime-acq-list">
          <span className="section-kicker">Latest {Math.min(series.length, 8)} of {series.length} acquisition dates</span>
          <ul>{series.slice(-8).map((p) => <li key={p.id}><strong>{p.date}</strong> · {p.platform} · {p.polarization}</li>)}</ul>
        </div>
      )}
    </div>
  )
}

function ChartTab({ series, compared, browse }: { series: AcquisitionSeriesPoint[]; compared: { left: Observation; right: Observation } | null; browse: BrowseComparison }) {
  if (!series.length) return <div className="chart-shell realtime-chart"><StatePanel compact title="No acquisitions in this window" message="Nothing was pulled for this area and date range. Widen the dates or move the map; this chart fills in automatically when records arrive." icon="calendar" /></div>
  const byDay = [...series].sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt))
  const minT = new Date(byDay[0].acquiredAt).getTime()
  const maxT = new Date(byDay[byDay.length - 1].acquiredAt).getTime()
  const span = Math.max(maxT - minT, 1)
  const w = 600, h = 140, pad = 30
  const x = (t: number) => pad + ((t - minT) / span) * (w - pad * 2)
  const comparedIds = new Set(compared ? [compared.left.id, compared.right.id] : [])
  return (
    <div className="chart-shell realtime-chart">
      <header><div><span className="section-kicker">Pulled data timeline</span><h3>Acquisitions over time (real-time)</h3></div><DataBadge value="observed" /></header>
      <svg viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Timeline of pulled acquisitions" className="acq-chart">
        <line x1={pad} y1={h - pad} x2={w - pad} y2={h - pad} stroke="currentColor" opacity="0.3" />
        {byDay.map((p) => {
          const cx = x(new Date(p.acquiredAt).getTime())
          const active = comparedIds.has(p.id)
          return <g key={p.id}><line x1={cx} y1={pad} x2={cx} y2={h - pad} stroke={active ? "#24757a" : "currentColor"} opacity={active ? 0.9 : 0.25} /><circle cx={cx} cy={h - pad} r={active ? 7 : 5} fill={active ? "#24757a" : "#3ca9ad"} /><title>{p.date} · {p.platform} · {p.polarization}</title></g>
        })}
        <text x={pad} y={h - 6} fontSize="11">{byDay[0].date}</text>
        <text x={w - pad} y={h - 6} fontSize="11" textAnchor="end">{byDay[byDay.length - 1].date}</text>
      </svg>
      {browse.summary && compared && (
        <div className="realtime-chart-bars" aria-label="Computed visual change">
          <span className="section-kicker">Computed visual change ({compared.left.acquiredAt.slice(0,10)} → {compared.right.acquiredAt.slice(0,10)})</span>
          <div className="bar-row"><span>Changed</span><div className="bar"><i style={{ width: `${browse.summary.changedPct}%`, background: "#3ca9ad" }} /></div><strong>{browse.summary.changedPct}%</strong></div>
          <div className="bar-row"><span>Brighter later</span><div className="bar"><i style={{ width: `${browse.summary.brighterPct}%`, background: "#e87656" }} /></div><strong>{browse.summary.brighterPct}%</strong></div>
          <div className="bar-row"><span>Darker later</span><div className="bar"><i style={{ width: `${browse.summary.darkerPct}%`, background: "#24757a" }} /></div><strong>{browse.summary.darkerPct}%</strong></div>
        </div>
      )}
      <table className="acq-table">
        <caption>Acquisitions (from pulled archive)</caption>
        <thead><tr><th>Date</th><th>Sensor</th><th>Polarization</th><th>Orbit</th></tr></thead>
        <tbody>{byDay.map((p) => <tr key={p.id} className={comparedIds.has(p.id) ? "row-active" : ""}><td>{p.date}</td><td>{p.platform}</td><td>{p.polarization}</td><td>{p.orbit}</td></tr>)}</tbody>
      </table>
      {series.length < 2 && <p className="chart-note"><strong>Only {series.length} acquisition is loaded.</strong> The timeline works with one record, but a change comparison needs two or more dates. Widen the date window or use Load more.</p>}
      <p className="chart-note">Chart shows acquisition availability over time from real pulled data. Change bars are computed from preview-image comparison (exploratory), not calibrated geophysical measurement.</p>
    </div>
  )
}

function ContextTab({ ctx, moduleId }: { ctx: RealtimeContext; moduleId: ModuleId }) {
  return (
    <div className="context-list realtime-context">
      <article><h3>Location &amp; area</h3><p><strong>{ctx.placeName}</strong> — {ctx.areaLabel}</p><small>Bounds: {ctx.bounds.map((n) => n.toFixed(4)).join(", ")}</small></article>
      <article><h3>Data pulled (real-time)</h3><ul>
        <li>Product: {ctx.productLabel}</li>
        <li>Window: {ctx.dateWindow ? `${ctx.dateWindow.start} to ${ctx.dateWindow.end}` : "n/a"}</li>
        <li>Acquisition dates here: {ctx.footprintAcquisitionCount} (selected footprint)</li>
        <li>Records loaded: {ctx.acquisitionCount} across {ctx.groupCount} footprints</li>
        <li>Footprint: {acquisitionGroupLabel(ctx.groupLabel)}</li>
        <li>Orbit(s): {ctx.orbits.join(", ") || "not reported"}</li>
        <li>Polarization: {ctx.polarizations.join(", ") || "see acquisition"}</li>
        <li>Source maturity: {ctx.sourceMaturity}</li>
      </ul>{ctx.sourceUrl && <a href={ctx.sourceUrl} target="_blank" rel="noreferrer">Open source record <Icon name="external" size={14} /></a>}</article>
      {ctx.comparedPair && <article><h3>Compared pair (auto-selected)</h3><p>{ctx.comparedPair.from} → {ctx.comparedPair.to}</p><small>Best available pair chosen automatically for visual analysis.</small></article>}
      <article><h3>How to read this</h3><p>Radar (SAR) senses surface brightness, not photos. Darker areas often mean smooth/wet surfaces (like calm water); brighter often mean rough/vegetated or textured surfaces. Differences shown are computed from pulled preview images (exploratory) — useful for spotting change, not a calibrated measurement.</p></article>
      {moduleId === "glof" && (
        <div className="review-workflow"><h3><Icon name="shield" size={18} /> Safety gate</h3><ol><li>Automated candidate</li><li>Analyst review</li><li>Supporting evidence</li><li>Authority approval</li><li>Public alert</li></ol><p>Satellite change is not a public warning.</p></div>
      )}
    </div>
  )
}

function SourcesTab({ sources, observations }: { sources: DataSource[]; observations: Observation[] }) {
  return (
    <div className="source-list">
      {sources.map((source) => (
        <article key={source.id}><div><Icon name="book" size={18} /><span><strong>{source.name}</strong><small>{source.provider}</small></span></div><p>{source.role}</p><a href={source.accessUrl} target="_blank" rel="noreferrer">Provider <Icon name="external" size={14} /></a></article>
      ))}
      {observations.slice(0, 6).map((o) => <article key={o.id}><strong>{formatDate(o.acquiredAt)}</strong><p>{o.platform} · {o.polarization}</p>{o.sourceUrl && <a href={o.sourceUrl} target="_blank" rel="noreferrer">Metadata <Icon name="external" size={13} /></a>}</article>)}
      <p className="fixture-note"><Icon name="info" size={14} /> Real acquisitions pulled live. Analysis and interpretation are generated in real time from this data.</p>
    </div>
  )
}

export function EvidenceDrawer({
  place,
  moduleId,
  selectedObservation,
  observations,
  sources,
  realtimeContext,
  series,
  comparedPair,
  browse,
}: {
  place: Place
  moduleId: ModuleId
  dataOrigin?: "fixture" | "live"
  selectedObservation?: Observation
  observations: Observation[]
  layers: LayerDefinition[]
  sources: DataSource[]
  realtimeContext: RealtimeContext
  series: AcquisitionSeriesPoint[]
  comparedPair: { left: Observation; right: Observation } | null
  browse: BrowseComparison
}) {
  void selectedObservation
  return (
    <aside className="evidence-drawer evidence-drawer--realtime" aria-label="Evidence drawer">
      <Tabs.Root defaultValue="summary">
        <Tabs.List aria-label="Evidence views">
          <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
          <Tabs.Trigger value="chart">Chart</Tabs.Trigger>
          <Tabs.Trigger value="context">Context</Tabs.Trigger>
          <Tabs.Trigger value="sources">Sources</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="summary"><SummaryTab place={place} ctx={realtimeContext} compared={comparedPair} browse={browse} series={series} /></Tabs.Content>
        <Tabs.Content value="chart"><ChartTab series={series} compared={comparedPair} browse={browse} /></Tabs.Content>
        <Tabs.Content value="context"><ContextTab ctx={realtimeContext} moduleId={moduleId} /></Tabs.Content>
        <Tabs.Content value="sources"><SourcesTab sources={sources} observations={observations} /></Tabs.Content>
      </Tabs.Root>
    </aside>
  )
}
