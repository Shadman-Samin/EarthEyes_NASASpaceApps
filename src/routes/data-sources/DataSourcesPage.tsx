import { Link } from "react-router-dom"
import { useDataSources } from "../../data/queries"
import { Icon, Skeleton, StatePanel } from "../../shared/ui"
import { getDataOrigin } from "../../data/repository"

export function DataSourcesPage() {
  const sourcesQuery = useDataSources()
  const fixtureData = getDataOrigin() === "fixture"
  return (
    <main id="main-content" className="content-page">
      <header className="content-hero"><div><span className="section-kicker">Data sources / Catalogue</span><h1>Open observations, carefully interpreted.</h1><p>Inspect the mission, measurement, role, coverage, update pattern, citation, and limitations intended to sit beside each EarthEyes view.</p></div><aside><Icon name="book" size={24} /><strong>Source before signal.</strong><p>A layer without acquisition, provenance, and quality metadata is not ready for interpretation.</p></aside></header>
      {sourcesQuery.isLoading ? <Skeleton lines={8} /> : sourcesQuery.isError ? <StatePanel title="Catalogue unavailable" message="Source metadata could not be loaded." icon="alert" /> : (
        <section className="source-catalogue" aria-label="Data source catalogue">
          {sourcesQuery.data?.map((source) => (
            <Link key={source.id} to={`/data-sources/${source.id}`} className="source-card">
              <div><span className="source-card__icon"><Icon name="timeline" size={19} /></span><span><small>{source.provider}</small><strong>{source.name}</strong></span></div>
              <p>{source.role}</p>
              <dl><div><dt>Technology</dt><dd>{source.technology}</dd></div><div><dt>Coverage</dt><dd>{source.coverage}</dd></div></dl>
              <span className="source-card__link">Open metadata <Icon name="arrow" size={14} /></span>
            </Link>
          ))}
        </section>
      )}
      <section className="source-definition"><div><span className="section-kicker">Product boundary</span><h2>{fixtureData ? "Fixture metadata is not mission data." : "Connected metadata still requires product verification."}</h2></div><p>{fixtureData ? "The current repository validates the shape and communication of future products. Imagery and values are representative interface fixtures until authoritative STAC items, raster tiles, processing outputs, and citations are connected." : "The configured API supplies these records. Users must still verify exact source products, processing outputs, citations, quality, and update times before interpretation."}</p></section>
    </main>
  )
}
