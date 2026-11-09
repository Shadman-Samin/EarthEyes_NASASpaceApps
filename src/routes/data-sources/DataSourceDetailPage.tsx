import { Link, useParams } from "react-router-dom"
import { useDataSource } from "../../data/queries"
import { Icon, Skeleton, StatePanel } from "../../shared/ui"
import { getDataOrigin } from "../../data/repository"

export function DataSourceDetailPage() {
  const { sourceId = "" } = useParams()
  const sourceQuery = useDataSource(sourceId)
  if (sourceQuery.isLoading) return <main id="main-content" className="content-page"><Skeleton lines={8} /></main>
  if (sourceQuery.isError || !sourceQuery.data) return <main id="main-content" className="content-page"><StatePanel title="Source not found" message="This source record is unavailable." icon="book" /></main>
  const source = sourceQuery.data
  const fixtureData = getDataOrigin() === "fixture"
  return (
    <main id="main-content" className="content-page source-detail">
      <Link className="back-link" to="/data-sources"><Icon name="arrow" size={15} /> All data sources</Link>
      <header><span className="section-kicker">{source.provider} / Source record</span><h1>{source.name}</h1><p>{source.role}</p><a href={source.accessUrl} target="_blank" rel="noreferrer" className="button button--primary button--medium">Open authoritative source <Icon name="external" size={16} /></a></header>
      <div className="source-detail__grid"><section><h2>Source metadata</h2><dl><div><dt>Provider</dt><dd>{source.provider}</dd></div><div><dt>Technology</dt><dd>{source.technology}</dd></div><div><dt>Coverage</dt><dd>{source.coverage}</dd></div><div><dt>Update cadence</dt><dd>{source.updateCadence}</dd></div><div><dt>Citation</dt><dd>{source.citation}</dd></div></dl></section><section><h2>Known limitations</h2><ul>{source.limitations.map((limitation) => <li key={limitation}><Icon name="alert" size={16} />{limitation}</li>)}</ul><div className="fixture-note"><Icon name="info" size={15} /> {fixtureData ? "EarthEyes fixture records demonstrate this source relationship; they do not claim to be downloaded products." : "This source relationship was supplied by the configured API; verify the cited product before interpretation."}</div></section></div>
      <div className="content-cta"><div><strong>See source metadata in context</strong><p>Open an investigation and inspect the Sources evidence tab.</p></div><Link className="button button--primary button--medium" to="/explore">Open explorer <Icon name="arrow" size={16} /></Link></div>
    </main>
  )
}
