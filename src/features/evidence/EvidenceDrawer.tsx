import * as Tabs from "@radix-ui/react-tabs"
import { Link } from "react-router-dom"
import type { DataSource, EventContext, LayerDefinition, Measurement, ModuleId, Observation, Place } from "../../domain/models"
import { moduleRegistry } from "../../domain/module-registry"
import { formatDate } from "../../shared/formatting"
import { DataBadge, Icon, QualityBadge, StatePanel } from "../../shared/ui"
import { getDataOrigin } from "../../data/repository"

function Summary({ place, moduleId, measurements }: { place: Place; moduleId: ModuleId; measurements: Measurement[] }) {
  const definition = moduleRegistry[moduleId]
  return (
    <div className="evidence-summary">
      <div className="evidence-summary__place">
        <span className="section-kicker">Selected investigation</span>
        <h2>{place.name}</h2>
        <p>{place.description}</p>
      </div>
      <div className="measurement-grid">
        {measurements.map((measurement) => (
          <article key={measurement.id} className="measurement-card">
            <div><DataBadge value={measurement.classification} /><QualityBadge value={measurement.quality} /></div>
            <span>{measurement.label}</span>
            <strong>{measurement.value} <small>{measurement.unit}</small></strong>
            <p>{measurement.uncertainty}</p>
            <details>
              <summary>Provenance</summary>
              <dl>
                <div><dt>Area</dt><dd>{measurement.spatialArea}</dd></div>
                <div><dt>Dates</dt><dd>{measurement.effectiveDateRange}</dd></div>
                <div><dt>Products</dt><dd>{measurement.sourceProducts.join(", ")}</dd></div>
                <div><dt>Version</dt><dd>{measurement.processingVersion}</dd></div>
                <div><dt>Citation</dt><dd>{measurement.citation}</dd></div>
                <div><dt>Updated</dt><dd>{formatDate(measurement.updatedAt)}</dd></div>
              </dl>
            </details>
          </article>
        ))}
      </div>
      <div className="claim-ladder">
        <article data-kind="observed"><DataBadge value="observed" /><h3>What we observed</h3><p>{definition.observedStatement}</p></article>
        <article data-kind="context"><DataBadge value="context" /><h3>Context to check</h3><p>{definition.contextStatement}</p></article>
        <article data-kind="interpretation"><DataBadge value="interpretation" /><h3>Possible explanations</h3><p>{definition.possibleExplanations}</p></article>
        <article data-kind="not-proven"><span className="data-badge data-badge--warning">Not proven</span><h3>What this cannot prove</h3><p>{definition.cannotProve}</p></article>
      </div>
    </div>
  )
}

function MiniChart({ measurements, moduleId }: { measurements: Measurement[]; moduleId: ModuleId }) {
  const fixtureData = getDataOrigin() === "fixture"
  return (
    <div className="chart-shell">
      <header><div><span className="section-kicker">Time series</span><h3>{moduleId === "ice" ? "Surface velocity context" : moduleId === "glof" ? "Mapped lake-area history" : "Shoreline-position samples"}</h3></div><DataBadge value="derived" /></header>
      <StatePanel compact title="Trend not available" message={`The ${fixtureData ? "fixture " : ""}API returned summary measurements, not enough dated points for a defensible time-series chart.`} icon="timeline" />
      <table>
        <caption>Available measurements</caption>
        <thead><tr><th>Measure</th><th>Value</th><th>State</th></tr></thead>
        <tbody>{measurements.map((measurement) => <tr key={measurement.id}><td>{measurement.label}</td><td>{measurement.value} {measurement.unit}</td><td>{measurement.quality}</td></tr>)}</tbody>
      </table>
      <p>A chart will render only after the API supplies multiple dated values with compatible units, methods, and uncertainty.</p>
    </div>
  )
}

function Context({ events, moduleId }: { events: EventContext[]; moduleId: ModuleId }) {
  const fixtureData = getDataOrigin() === "fixture"
  return (
    <div className="context-list">
      {events.length ? events.map((event) => (
        <article key={event.id}><div><DataBadge value={event.classification} /><time dateTime={event.date}>{formatDate(event.date)}</time></div><h3>{event.title}</h3><p>{event.description}</p><small>Source: {event.source}</small></article>
      )) : <StatePanel compact title="No dated context" message={`No ${fixtureData ? "fixture " : ""}event overlaps this investigation.`} />}
      {moduleId === "glof" && (
        <div className="review-workflow">
          <h3><Icon name="shield" size={18} /> Safety gate</h3>
          <ol><li>Automated threshold</li><li>Analyst review</li><li>Supporting evidence</li><li>Authority approval</li><li>Public SMS / voice alert</li></ol>
          <p>A satellite change can create a review candidate. It cannot automatically become a public warning.</p>
        </div>
      )}
    </div>
  )
}

function Sources({ observations, layers, measurements, sources }: { observations: Observation[]; layers: LayerDefinition[]; measurements: Measurement[]; sources: DataSource[] }) {
  const fixtureData = getDataOrigin() === "fixture"
  const usedIds = new Set([
    ...observations.map((observation) => observation.sourceId),
    ...layers.map((layer) => layer.sourceId),
    ...measurements.flatMap((measurement) => measurement.sourceIds),
  ])
  const usedSources = sources.filter((source) => usedIds.has(source.id))
  return (
    <div className="source-list">
      {usedSources.map((source) => (
        <article key={source.id}>
          <div><Icon name="book" size={18} /><span><strong>{source.name}</strong><small>{source.provider}</small></span></div>
          <p>{source.role}</p>
          <Link to={`/data-sources/${source.id}`}>Open source record <Icon name="arrow" size={14} /></Link>
        </article>
      ))}
      <p className="fixture-note"><Icon name="info" size={14} /> {fixtureData ? "Source links describe intended provenance. Fixture images are not products from these archives." : "Source links and limitations correspond to identifiers supplied by the configured API."}</p>
    </div>
  )
}

export function EvidenceDrawer({
  place,
  moduleId,
  measurements,
  events,
  observations,
  layers,
  sources,
}: {
  place: Place
  moduleId: ModuleId
  measurements: Measurement[]
  events: EventContext[]
  observations: Observation[]
  layers: LayerDefinition[]
  sources: DataSource[]
}) {
  return (
    <aside className="evidence-drawer" aria-label="Evidence drawer">
      <Tabs.Root defaultValue="summary">
        <Tabs.List aria-label="Evidence views">
          <Tabs.Trigger value="summary">Summary</Tabs.Trigger>
          <Tabs.Trigger value="chart">Chart</Tabs.Trigger>
          <Tabs.Trigger value="context">Context</Tabs.Trigger>
          <Tabs.Trigger value="sources">Sources</Tabs.Trigger>
        </Tabs.List>
        <Tabs.Content value="summary"><Summary place={place} moduleId={moduleId} measurements={measurements} /></Tabs.Content>
        <Tabs.Content value="chart"><MiniChart measurements={measurements} moduleId={moduleId} /></Tabs.Content>
        <Tabs.Content value="context"><Context events={events} moduleId={moduleId} /></Tabs.Content>
        <Tabs.Content value="sources"><Sources observations={observations} layers={layers} measurements={measurements} sources={sources} /></Tabs.Content>
      </Tabs.Root>
    </aside>
  )
}
