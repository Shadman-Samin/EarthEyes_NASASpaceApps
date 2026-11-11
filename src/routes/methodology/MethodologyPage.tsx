import { Link } from "react-router-dom"
import { DataBadge, Icon } from "../../shared/ui"

const steps = [
  ["01", "Acquire observations", "Group scenes by footprint, orbit, acquisition time, polarization, processing level, and usable coverage."],
  ["02", "Calibrate and align", "Correct geometry and terrain effects before co-registering compatible observations."],
  ["03", "Detect change", "Estimate displacement or surface change while retaining masks, quality, and uncertainty."],
  ["04", "Cross-check context", "Compare terrain, tide, weather, season, and independent observations before interpretation."],
  ["05", "Review meaning", "Keep measured signals separate from analyst interpretation and modeled consequence."],
  ["06", "Communicate carefully", "Public hazard messages require supporting evidence and responsible authority approval."],
]

export function MethodologyPage() {
  return (
    <main id="main-content" className="content-page">
      <header className="content-hero"><div><span className="section-kicker">Methodology / Evidence path</span><h1>From radar echoes to defensible evidence.</h1><p>EarthEyes preserves the chain from source observation to public meaning, with every state transition and limitation visible.</p></div><aside><DataBadge value="observed" /><strong>Measurements before explanations.</strong><p>A vivid map is never a substitute for provenance, compatible acquisitions, and uncertainty.</p></aside></header>
      <ol className="method-grid">{steps.map(([number, title, description]) => <li key={number}><span>{number}</span><Icon name={number === "06" ? "shield" : "timeline"} size={20} /><h2>{title}</h2><p>{description}</p></li>)}</ol>
      <section className="method-principles"><article><span className="section-kicker">Coastal communication</span><h2>SAR and sea level are not the same measurement.</h2><p>SAR can indicate shoreline-position or surface-water change. Altimetry, tide, surge, weather, and vertical land motion provide separate context. A shoreline shift does not prove sea-level rise caused it.</p></article><article><span className="section-kicker">GLOF safety boundary</span><h2>A candidate is not a warning.</h2><ol><li>Automated threshold</li><li>Analyst review</li><li>Supporting evidence</li><li>Authority approval</li><li>Public SMS / voice</li></ol></article></section>
      <section className="classification-table"><header><span className="section-kicker">Trust model</span><h2>Every object declares what it is.</h2></header><div>{(["observed", "derived", "modeled", "context", "interpretation", "authority-alert"] as const).map((value) => <article key={value}><DataBadge value={value} /><p>{value === "observed" ? "A source observation or directly mapped signal." : value === "derived" ? "Calculated from one or more observations." : value === "modeled" ? "A simulation or screening result with assumptions." : value === "context" ? "Independent information used to interpret a signal." : value === "interpretation" ? "An analyst explanation that remains reviewable." : "A message issued by a responsible authority."}</p></article>)}</div></section>
      <div className="content-cta"><div><strong>Apply the evidence path</strong><p>Open a place with the methodology beside the map.</p></div><Link className="button button--primary button--medium" to="/explore/kuakata-bangladesh?module=coastal">Open explorer <Icon name="arrow" size={16} /></Link></div>
    </main>
  )
}
