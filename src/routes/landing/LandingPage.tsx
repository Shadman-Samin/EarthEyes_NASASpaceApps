import { Link } from "react-router-dom"
import { usePlaces } from "../../data/queries"
import { KUAKATA_PILOT_URL } from "../../shared/links"
import { Icon, Skeleton, StatePanel } from "../../shared/ui"
import { prefersLowBandwidth } from "../../shared/network"
import { useMediaQuery } from "../../shared/useMediaQuery"

const questions: Record<string, string> = {
  "kuakata-bangladesh": "A coast, two dates. Could tide or surface roughness explain the difference?",
  "barishal-bangladesh": "A river landscape. What would you need to distinguish seasonal water from flooding?",
  "jakobshavn-glacier": "An ice surface. What changes in brightness, and why is that not a velocity measurement?",
}

export function LandingPage() {
  const placesQuery = usePlaces("")
  const featured = placesQuery.data?.filter((place) => questions[place.id]) ?? []
  const reducedMotion = useMediaQuery("(prefers-reduced-motion: reduce)")
  const videoEnabled = !reducedMotion && !prefersLowBandwidth()
  const poster = `${import.meta.env.BASE_URL}orbit-hero.jpg`

  return (
    <main id="main-content" className="editorial-page landing-page">
      <section className="landing-hero" aria-labelledby="landing-title">
        <div className="landing-hero__media" aria-hidden="true">
          {videoEnabled ? <video src={`${import.meta.env.BASE_URL}orbit-hero.mp4`} poster={poster} autoPlay muted loop playsInline preload="metadata" tabIndex={-1} aria-hidden="true" /> : <img src={poster} alt="" width={1280} height={720} fetchPriority="high" />}
        </div>
        <div className="landing-hero__copy">
          <span className="section-kicker">NASA Space Apps / Dancing with the SARs</span>
          <h1 id="landing-title">Read the radar.<br /><em>Question the change.</em></h1>
          <p>Inspect real satellite radar acquisitions and official browse previews. Or open the published Kuakata study to see a calibrated-source analysis with its epochs, sensitivity and reference checks kept in view.</p>
          <div className="landing-hero__actions">
            <Link className="button button--signal button--medium" to="/explore">Open the explorer <Icon name="arrow" size={18} /></Link>
            <Link className="text-link" to={KUAKATA_PILOT_URL}>Inspect the Kuakata study <Icon name="arrow" size={17} /></Link>
            <a className="text-link" href="#walkthrough"><Icon name="play" size={17} /> Watch the walkthrough</a>
          </div>
          <p className="landing-hero__note">Kuakata: precomputed NISAR HV / Live archive: browse previews<br />Exploratory results, not a validated change measurement.</p>
        </div>
        <div className="landing-hero__aside"><span>NISAR / orbital view</span><p>Mission visualisation, not live imagery. The explorer's evidence comes from the archive.</p></div>
      </section>

      <section className="pilot-band editorial-section" aria-label="Published Kuakata study">
        <div className="pilot-band__copy">
          <span className="section-kicker">Published study / NISAR HV gamma0</span>
          <h2>Kuakata,<br /><em>read across ten dates.</em></h2>
          <p>A bounded coastal pilot with fixed three-date epochs on one common valid footprint. The explorer shows the derived water and brightness evidence, its sensitivity range, and per-date independent reference coverage.</p>
          <div className="pilot-band__actions">
            <Link className="button button--signal button--medium" to={KUAKATA_PILOT_URL}>Inspect the evidence <Icon name="arrow" size={17} /></Link>
            <Link className="text-link" to="/methodology">Read the method <Icon name="arrow" size={16} /></Link>
          </div>
        </div>
        <dl className="pilot-band__facts">
          <div><dt>Archive</dt><dd>Ten NISAR GCOV acquisitions<br /><small>18 June — 16 October 2026</small></dd></div>
          <div><dt>Question</dt><dd>Did the water candidate area and brightness differ between fixed epochs?</dd></div>
          <div><dt>Status</dt><dd>Exploratory derived · provisional source<br /><small>Not a validated flood claim or operational warning</small></dd></div>
          <div><dt>Check</dt><dd>Cross-sensor class agreement is corroboration, not ground truth.</dd></div>
        </dl>
      </section>

      <section id="walkthrough" className="walkthrough editorial-section" aria-labelledby="walkthrough-title">
        <div className="walkthrough__copy"><span className="section-kicker">01 / Project walkthrough</span><h2 id="walkthrough-title">See the investigation<br /><em>take shape.</em></h2><p>A guided look at EarthEyes. Use the live workspace to inspect the selected acquisitions, their source records, and the limits of a visual comparison.</p><a className="text-link" href="https://www.youtube.com/watch?v=vzeL2bBZ5Sk" target="_blank" rel="noreferrer">Watch on YouTube <Icon name="external" size={16} /></a></div>
        <figure className="walkthrough__player">
          <iframe src="https://www.youtube.com/embed/vzeL2bBZ5Sk?si=z0kcsW6NWYHp3Sgq" title="EarthEyes project walkthrough" loading="lazy" referrerPolicy="strict-origin-when-cross-origin" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share" allowFullScreen />
          <figcaption>Project video / YouTube loads third-party content. If playback is unavailable, use the direct link.</figcaption>
        </figure>
      </section>

      <section className="home-workflow editorial-section" aria-labelledby="workflow-title">
        <header className="section-heading"><div><span className="section-kicker">02 / In the workspace</span><h2 id="workflow-title">From a place<br />to a better question.</h2></div><p>Synthetic aperture radar (SAR) records microwave signals returned from the surface. Brightness depends on geometry and surface conditions, not just environmental change.</p></header>
        <ol className="home-workflow__steps">
          <li><span className="step-number">01</span><h3>Bound your area.</h3><p>Pan the map and choose <strong>Search this map area</strong>, or enter geographic bounds. Name search offers four reference places, not a worldwide geocoder. Coverage varies by archive.</p></li>
          <li><span className="step-number">02</span><h3>Compare a footprint.</h3><p>Pull NISAR GCOV or OPERA Sentinel-1 records. The explorer groups matching footprints and selects the earliest and latest usable previews from loaded records.</p></li>
          <li><span className="step-number">03</span><h3>Read, then cross-check.</h3><p>Inspect the visual difference, brighter/darker pixel shares and acquisition timeline. A facts-grounded narrative helps explain the result; it does not establish its cause.</p></li>
        </ol>
        <Link className="text-link" to="/methodology">How the comparison is computed <Icon name="arrow" size={16} /></Link>
      </section>

      <section className="field-index editorial-section" aria-labelledby="investigations-title">
        <header className="section-heading"><div><span className="section-kicker">03 / Reference investigations</span><h2 id="investigations-title">Different places.<br /><em>Different questions.</em></h2></div><p>These starting points frame coastal and ice investigations. They are not pre-verified findings or promises of imagery for every date.</p></header>
        {placesQuery.isLoading ? <Skeleton lines={4} /> : placesQuery.isError ? <StatePanel compact title="Investigations unavailable" message="The reference-place catalogue could not be loaded. You can still open the explorer." icon="alert" /> : (
          <div className="field-index__entries">{featured.map((place, index) => (
            <article key={place.id} className="field-index__entry">
              <span className="step-number">0{index + 1}</span>
              <div><span className="eyebrow">{place.country} / {place.kind}</span><h3>{place.name}</h3></div>
              <p>{questions[place.id]}</p>
              <div className="field-index__links"><Link className="text-link" to={`/explore/${place.id}?module=${place.moduleIds[0]}`} aria-label={`Explore ${place.name}`}>Explore <Icon name="arrow" size={16} /></Link><Link className="text-link" to={`/stories/${place.storySlug}`} aria-label={`Field notes for ${place.name}`}>Field notes <Icon name="book" size={16} /></Link></div>
            </article>
          ))}</div>
        )}
      </section>

      <section className="home-groundline editorial-section" aria-labelledby="groundline-preview-title">
        <div><span className="section-kicker">04 / GroundLine demonstration</span><h2 id="groundline-preview-title">A signal is not<br /><em>a public warning.</em></h2></div>
        <div><p>GroundLine demonstrates the step that a change map cannot take on its own: analyst review, supporting evidence and responsible authority approval before any SMS or voice notice.</p><p className="home-groundline__boundary"><Icon name="shield" size={19} /> Interface simulation only. No messages are sent.</p><Link className="text-link" to="/groundline">Inspect the safety workflow <Icon name="arrow" size={16} /></Link></div>
      </section>

      <section className="home-sources editorial-section" aria-labelledby="home-sources-title">
        <div><span className="section-kicker">Trace the observation</span><h2 id="home-sources-title">Start at the source.</h2><p>The explorer links to actual acquisition records. Our source directory separately explains mission roles and independent context.</p></div>
        <nav aria-label="Observation sources"><a href="https://nisar.jpl.nasa.gov/" target="_blank" rel="noreferrer"><span>NASA / ISRO</span><strong>NISAR mission</strong><Icon name="external" size={18} /></a><a href="https://search.asf.alaska.edu/" target="_blank" rel="noreferrer"><span>ASF DAAC</span><strong>SAR archive</strong><Icon name="external" size={18} /></a><Link className="text-link" to="/data-sources">Read the source directory <Icon name="arrow" size={16} /></Link></nav>
      </section>
    </main>
  )
}
