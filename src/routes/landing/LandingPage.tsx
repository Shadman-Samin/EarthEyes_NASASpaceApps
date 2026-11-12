import { Link } from "react-router-dom"
import { moduleList } from "../../domain/module-registry"
import { useDataSources, usePlaces } from "../../data/queries"
import { Icon, Skeleton, StatePanel } from "../../shared/ui"

export function LandingPage() {
  const placesQuery = usePlaces("")
  const sourcesQuery = useDataSources()
  const featuredIds = new Set(["kuakata-bangladesh", "barishal-bangladesh", "jakobshavn-glacier"])
  const featured = placesQuery.data?.filter((place) => featuredIds.has(place.id)) ?? []

  return (
    <main id="main-content" className="landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__copy">
          <span className="section-kicker">DANCING WITH THE SARS · NASA SPACE APPS</span>
          <h1 id="landing-title">See what radar <em>reveals.</em></h1>
          <p>Real satellite radar (SAR) images, explained in plain language. Pick any area worldwide and get a real-time visual analysis of the pulled data — with clear numbers, visuals, and honest limits.</p>
          <div className="landing-hero__actions">
            <Link className="button button--primary button--medium" to="/explore/kuakata-bangladesh?module=coastal&view=map">See coastal change (Kuakata) <Icon name="arrow" size={17} /></Link>
            <Link className="button button--secondary button--medium" to="/explore/jakobshavn-glacier?module=ice&view=map">See ice change (Greenland) <Icon name="arrow" size={17} /></Link>
          </div>
          <dl className="landing-hero__facts">
            <div><dt>Interpreted</dt><dd>Real-time visual analysis &amp; plain summaries</dd></div>
            <div><dt>Real data</dt><dd>NASA NISAR / Sentinel-1 acquisitions</dd></div>
            <div><dt>Any area</dt><dd>Search and compare worldwide</dd></div>
          </dl>
        </div>
        <Link className="atlas-preview" to="/explore/jakobshavn-glacier?module=ice&mode=side-by-side&view=compare">
          <div className="atlas-preview__globe" aria-hidden="true">
            <span className="atlas-preview__orbit" /><span className="atlas-preview__orbit atlas-preview__orbit--two" />
            <i className="atlas-preview__point atlas-preview__point--greenland" /><i className="atlas-preview__point atlas-preview__point--bangladesh" />
          </div>
          <div className="atlas-preview__header"><span><span className="live-dot" /> Global to local</span><Icon name="arrow" size={17} /></div>
          <div className="atlas-preview__card"><small>Featured investigation</small><strong>Jakobshavn Glacier</strong><span>Velocity / boundary / elevation</span></div>
          <div className="atlas-preview__scale"><i /><span>Radar evidence</span><i /><span>Context</span></div>
        </Link>
      </section>

      <section className="landing-section" aria-labelledby="modules-title">
        <header className="landing-section__header"><div><span className="section-kicker">Environmental lenses</span><h2 id="modules-title">Choose the phenomenon, not a generic dashboard.</h2></div><p>Inspect real source imagery through each lens. Visual change is computed live from pulled previews (exploratory); calibrated georeferenced measurements stay unavailable until the required processing and validation are complete.</p></header>
        <div className="module-cards">
          {moduleList.filter((module) => module.id !== "glof").map((module) => (
            <Link key={module.id} to={module.id === "coastal" ? "/explore/kuakata-bangladesh?module=coastal" : "/explore/jakobshavn-glacier?module=ice"} className={`module-card module-card--${module.id}`}>
              <div><span className="module-card__number">0{module.id === "coastal" ? 1 : 2}</span><Icon name={module.id === "coastal" ? "water" : "ice"} size={25} /></div>
              <h3>{module.title}</h3><p>{module.description}</p><span className="module-card__action">Enter module <Icon name="arrow" size={15} /></span>
            </Link>
          ))}
        </div>
      </section>

      <section className="landing-section investigations" aria-labelledby="investigations-title">
        <header className="landing-section__header"><div><span className="section-kicker">Reference places</span><h2 id="investigations-title">Begin with a place.</h2></div><Link className="text-link" to="/explore">Explore any map area <Icon name="arrow" size={15} /></Link></header>
        {placesQuery.isLoading ? <Skeleton lines={4} /> : placesQuery.isError ? <StatePanel compact title="Investigations unavailable" message="The place catalogue could not be loaded." icon="alert" /> : (
          <div className="investigation-grid">
            {featured.map((place, index) => (
              <Link key={place.id} className="investigation-card" to={`/explore/${place.id}?module=${place.moduleIds[0]}&mode=swipe`}>
                <span>0{index + 1} / {place.kind}</span><h3>{place.name}</h3><p>{place.description}</p><div><small>{place.country}</small><Icon name="arrow" size={17} /></div>
              </Link>
            ))}
          </div>
        )}
      </section>

      <section className="landing-section journey" aria-labelledby="journey-title">
        <header><span className="section-kicker">One-minute path</span><h2 id="journey-title">Find place. Compare dates. Understand evidence.</h2></header>
        <ol>
          <li><span>01</span><Icon name="search" size={21} /><h3>Find a place</h3><p>Search a coast, glacier, lake, district, or curated investigation.</p></li>
          <li><span>02</span><Icon name="compare" size={21} /><h3>Compare dates</h3><p>Choose compatible acquisitions and a view that fits the question.</p></li>
          <li><span>03</span><Icon name="shield" size={21} /><h3>Read the limits</h3><p>Keep observations, derived values, context, and claims visibly separate.</p></li>
        </ol>
      </section>

      <section className="groundline-preview" aria-labelledby="groundline-preview-title">
        <div><span className="section-kicker section-kicker--light">GroundLine / Last mile</span><h2 id="groundline-preview-title">Evidence is only useful when verified guidance reaches people.</h2><p>Explore an SMS and voice delivery case study where automated detection stops before public warning approval.</p><Link className="button button--signal button--medium" to="/groundline">Open GroundLine <Icon name="arrow" size={17} /></Link></div>
        <div className="groundline-preview__message"><span>Authority-issued demo</span><strong>Higher river water is expected in the selected demo area.</strong><p>Follow instructions from your local authority. This record is not live.</p><small>SMS / voice / no smartphone required</small></div>
      </section>

      <section className="trust-strip" aria-label="Scientific trust principles">
        <div><Icon name="book" size={20} /><span><strong>Trace every value</strong><small>Source, date, processing, citation</small></span></div>
        <div><Icon name="layers" size={20} /><span><strong>Name the state</strong><small>Observed, derived, modeled, context</small></span></div>
        <div><Icon name="shield" size={20} /><span><strong>Never automate warnings</strong><small>Analyst and authority gates remain</small></span></div>
      </section>

      <section className="source-strip" aria-labelledby="source-strip-title">
        <div><span className="section-kicker">Designed around open evidence</span><h2 id="source-strip-title">Source catalogue</h2></div>
        <div>{sourcesQuery.isError ? <StatePanel compact title="Source catalogue unavailable" message="Source records could not be loaded." icon="alert" /> : sourcesQuery.data?.slice(0, 5).map((source) => <Link key={source.id} to={`/data-sources/${source.id}`}><strong>{source.name}</strong><span>{source.technology}</span></Link>)}</div>
      </section>

      <section className="landing-final-cta">
        <div><span className="section-kicker section-kicker--light">Worldwide archive discovery</span><h2>Start with the acquisition, not the claim.</h2></div>
        <Link className="button button--signal button--medium" to="/explore">Launch EarthEyes <Icon name="arrow" size={17} /></Link>
      </section>
    </main>
  )
}
