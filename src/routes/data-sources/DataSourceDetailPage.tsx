import { Link, useParams } from "react-router-dom"
import { useDataSource } from "../../data/queries"
import { Icon, Skeleton, StatePanel } from "../../shared/ui"
import { getDataOrigin } from "../../data/repository"

export function DataSourceDetailPage() {
  const { sourceId = "" } = useParams()
  const sourceQuery = useDataSource(sourceId)
  const fixtureData = getDataOrigin() === "fixture"
  const source = sourceQuery.data
  return (
    <main id="main-content" className="editorial-page source-detail">
      <div className="editorial-section source-detail__return"><Link className="back-link" to="/data-sources"><Icon name="arrow" size={16} /> All data sources</Link></div>
      {sourceQuery.isLoading ? <div className="editorial-body"><h1>Loading source record</h1><Skeleton lines={8} /></div> : sourceQuery.isError || !source ? <div className="editorial-body"><h1>Source not found</h1><StatePanel title="Record unavailable" message="This source record could not be loaded. Return to the directory to choose another source." icon="book" /></div> : (
        <>
          <header className="editorial-hero source-detail__hero"><div><span className="section-kicker">{source.provider} / Source record</span><h1>{source.name}</h1><p>{source.role}</p></div><a href={source.accessUrl} target="_blank" rel="noreferrer" className="button button--primary button--medium">Open authoritative source <Icon name="external" size={17} /></a></header>
          <div className="editorial-body">
            <div className="source-scope" role="note" aria-label="Source record scope"><Icon name="info" size={21} /><p>{fixtureData ? "Reference / fixture metadata." : "Configured repository metadata."} This is a source relationship, not an acquired product or an acquisition record. Verify the actual product, version and acquisition at the provider before interpretation.</p></div>
            <div className="source-record">
              <section aria-labelledby="source-metadata-title"><span className="section-kicker">01 / Provenance</span><h2 id="source-metadata-title">The source record</h2><dl className="metadata-list"><div><dt>Provider</dt><dd>{source.provider}</dd></div><div><dt>Technology</dt><dd>{source.technology}</dd></div><div><dt>Role</dt><dd>{source.role}</dd></div><div><dt>Coverage</dt><dd>{source.coverage}</dd></div><div><dt>Update cadence</dt><dd>{source.updateCadence}</dd></div><div><dt>Citation</dt><dd>{source.citation}</dd></div></dl></section>
              <section className="source-record__limits" aria-labelledby="source-limits-title"><span className="section-kicker">02 / Interpretation boundary</span><h2 id="source-limits-title">Known limitations</h2><ul>{source.limitations.map((limitation) => <li key={limitation}>{limitation}</li>)}</ul><p>Missing release, license or freshness information is not inferred. Consult the authoritative source for those details.</p><Link className="text-link" to="/methodology">Read the methodology <Icon name="arrow" size={16} /></Link></section>
            </div>
            <div className="editorial-endnote"><p>A mission citation is a starting point. A scientific claim needs the particular source product and its processing history.</p><Link className="text-link" to="/explore">Open the explorer <Icon name="arrow" size={16} /></Link></div>
          </div>
        </>
      )}
    </main>
  )
}
