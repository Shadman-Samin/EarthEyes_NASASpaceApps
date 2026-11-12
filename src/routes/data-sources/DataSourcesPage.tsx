import { Link } from "react-router-dom"
import { useDataSources } from "../../data/queries"
import { getDataOrigin } from "../../data/repository"
import type { DataSource } from "../../domain/models"
import { Icon, Skeleton, StatePanel } from "../../shared/ui"

const sourceGroups = [
  { id: "observations", title: "Observation archives", description: "The live explorer queries NISAR GCOV and OPERA Sentinel-1 acquisition records. These directory entries explain the missions; open the explorer for exact granule IDs, dates and public browse links.", ids: ["nisar", "sentinel-1-asf"] },
  { id: "context", title: "Independent context", description: "Different instruments answer different questions. Elevation, ocean state, weather and modeled population can support a review, but these datasets are not live analytical overlays in the current explorer.", ids: ["altimetry-argo", "icesat-2", "nasa-dem", "worldpop", "era5"] },
  { id: "processing", title: "Derived processing", description: "This reference describes intended processing products, not available live measurement products. The explorer computes uncalibrated preview differences; the separate offline bundles are documented in Methodology.", ids: ["earth-observation-derived"] },
  { id: "authority", title: "Responsible authority records", description: "Only the responsible authority can issue an operational warning. GroundLine uses a demonstration workflow; a listed authority source does not imply a partnership or a connected warning service.", ids: ["local-authority"] },
]

export function DataSourcesPage() {
  const sourcesQuery = useDataSources()
  const fixtureData = getDataOrigin() === "fixture"
  const otherSources = sourcesQuery.data?.filter((source) => !sourceGroups.some((group) => group.ids.includes(source.id))) ?? []

  return (
    <main id="main-content" className="editorial-page sources-page">
      <header className="editorial-hero"><div><span className="section-kicker">Data sources / Evidence directory</span><h1>Know the source.<br /><em>Know its role.</em></h1><p>A radar observation, an ocean record and an authority notice are not interchangeable evidence. Start with what each source can actually support.</p></div><aside className="editorial-hero__note"><span className="eyebrow">Provenance first</span><strong>Mission reference, not a live feed.</strong><p>Coverage, cadence and limitations below come from the typed source record, not from a new archive query.</p></aside></header>
      <div className="editorial-body">
        <div className="source-scope" role="note" aria-label="Directory scope"><Icon name="book" size={22} /><div><strong>{fixtureData ? "Reference / fixture metadata" : "Configured repository metadata"}</strong><p>{fixtureData ? "This directory uses reference and fixture records. It is separate from the live acquisition catalogue in Explore." : "These records come from the configured repository API. They are separate from the live acquisition catalogue in Explore."} A source listing does not mean its products are downloaded or rendered here.</p></div></div>
        <nav className="source-index" aria-label="Source roles">{sourceGroups.map((group, index) => <a key={group.id} href={`#${group.id}`}><span>0{index + 1}</span>{group.title}<Icon name="arrow" size={15} /></a>)}</nav>
        {sourcesQuery.isLoading ? <Skeleton lines={8} /> : sourcesQuery.isError ? <StatePanel title="Directory unavailable" message="Source metadata could not be loaded. Try again later, or inspect the acquisition sources in Explore." icon="alert" /> : (
          <>
            {sourceGroups.map((group, index) => <section key={group.id} id={group.id} className="source-group" aria-labelledby={`source-${group.id}`}><header><span className="step-number">0{index + 1} / Source role</span><h2 id={`source-${group.id}`}>{group.title}</h2><p>{group.description}</p></header><div>{sourcesQuery.data?.filter((source) => group.ids.includes(source.id)).map((source) => <SourceEntry key={source.id} source={source} />)}{!sourcesQuery.data?.some((source) => group.ids.includes(source.id)) && <p>No records for this role are available from the repository.</p>}</div></section>)}
            {otherSources.length > 0 && <section className="source-group" aria-labelledby="other-sources"><header><h2 id="other-sources">Other source records</h2><p>These repository records have not been assigned an editorial role.</p></header><div>{otherSources.map((source) => <SourceEntry key={source.id} source={source} />)}</div></section>}
          </>
        )}
        <div className="editorial-endnote"><p>Need the exact observation? The explorer keeps acquisition IDs and provider links beside the selected pair.</p><Link className="text-link" to="/explore">Inspect live acquisitions <Icon name="arrow" size={16} /></Link></div>
      </div>
    </main>
  )
}

function SourceEntry({ source }: { source: DataSource }) {
  return (
    <article className="source-entry">
      <span className="eyebrow">{source.provider}</span>
      <h3><Link to={`/data-sources/${encodeURIComponent(source.id)}`}>{source.name}<Icon name="arrow" size={20} /></Link></h3>
      <p>{source.role}</p><span className="source-entry__technology">{source.technology}</span>
      <details><summary>Coverage, citation &amp; limitations</summary><dl className="metadata-list"><div><dt>Coverage</dt><dd>{source.coverage}</dd></div><div><dt>Cadence</dt><dd>{source.updateCadence}</dd></div><div><dt>Citation</dt><dd>{source.citation}</dd></div></dl><ul>{source.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><a className="text-link" href={source.accessUrl} target="_blank" rel="noreferrer">Authoritative source <Icon name="external" size={15} /></a></details>
    </article>
  )
}
