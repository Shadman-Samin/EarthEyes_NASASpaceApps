import { Link } from "react-router-dom"
import { Icon } from "../../shared/ui"
import { getDataOrigin } from "../../data/repository"

export function AboutPage() {
  const fixtureData = getDataOrigin() === "fixture"
  return (
    <main id="main-content" className="content-page">
      <header className="content-hero"><div><span className="section-kicker">About EarthEyes</span><h1>A field atlas for a changing planet.</h1><p>EarthEyes is a NASA Space Apps research prototype for exploring how repeat SAR observations can support transparent environmental investigation and carefully governed last-mile communication.</p></div><aside><span className="section-kicker section-kicker--light">Prototype state</span><strong>Backend-ready, not operational.</strong><p>{fixtureData ? "The current build uses validated typed fixtures." : "The current build uses a configured API, but remains a research interface."} It must not be used for navigation, evacuation, or safety decisions.</p></aside></header>
      <section className="about-grid"><article><Icon name="globe" size={25} /><h2>Mission</h2><p>Make complex Earth-observation evidence understandable without flattening uncertainty or overstating causality.</p></article><article><Icon name="layers" size={25} /><h2>Challenge</h2><p>Connect SAR observations, derived products, independent context, and local knowledge inside one reproducible investigation.</p></article><article><Icon name="shield" size={25} /><h2>Boundary</h2><p>Automated change detection can prioritize review. Responsible authorities remain the source of public warnings.</p></article></section>
      <section className="prototype-contract"><div><span className="section-kicker">Current contract</span><h2>What works now</h2></div><ul><li>Routed, shareable investigation state</li><li>MapLibre global-to-local map foundation</li><li>Typed observations, layers, measurements, events, sources, and alerts</li><li>Five comparison modes with compatibility checks</li><li>Coastal, ice, and GLOF communication models</li><li>{fixtureData ? "Fixture repository replaceable by an HTTP API adapter" : "Configured HTTP API validated at the interface boundary"}</li></ul></section>
      <div className="content-cta"><div><strong>Inspect the prototype as evidence, not a feed.</strong><p>Every sample state is visibly labeled.</p></div><Link className="button button--primary button--medium" to="/explore">Open explorer <Icon name="arrow" size={16} /></Link></div>
    </main>
  )
}
