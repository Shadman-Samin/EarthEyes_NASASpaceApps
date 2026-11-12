import { Link } from "react-router-dom"
import { Icon } from "../../shared/ui"

const steps = [
  { title: "Query the archive", detail: "A geographic bounding box, product family and date window are sent to the catalogue API. It retrieves acquisition metadata and asset links from the provider, not the full protected radar raster.", output: "Output / Acquisition IDs, dates, footprints and browse links" },
  { title: "Choose a comparable footprint", detail: "Records are grouped by product and acquisition footprint. The default group has the most distinct acquisition dates; the earliest and latest usable previews in the loaded records become the suggested pair. Product, orbit and polarization metadata still need inspection. Grouping is not proof of image registration.", output: "Output / One selected footprint and two dated records" },
  { title: "Normalize preview dimensions", detail: "The browser loads the two previews into Canvas. Each output dimension is the smaller of the corresponding image dimensions, capped at 1600 px. This resizes display images; it does not calibrate radar values or align ground features.", output: "Output / Two equally sized RGB pixel arrays" },
  { title: "Compare luminance", detail: "Each RGB pixel is converted to luminance. An absolute difference greater than 26 on the 0-255 display scale counts as visibly changed. Fully transparent pixels in either image are excluded. Later pixels are classified as brighter or darker according to the sign of the difference.", output: "Output / Visual difference image and changed pixel counts" },
  { title: "Summarize the selected pair", detail: "Changed, brighter and darker shares use the number of compared, non-transparent pixels as their denominator. The UI rounds these shares to whole percentages and shows the acquisition timeline and metadata alongside them.", output: "Output / Screening statistics, not ground-area estimates" },
  { title: "Explain the facts, with a fallback", detail: "When configured, Groq receives acquisition metadata and computed facts. Without a supported vision model it does not receive the images. Optional vision configuration can include previews; unavailable or failed requests fall back to facts-only generation or a deterministic template.", output: "Output / Exploratory narrative with its source and limitations" },
]

export function MethodologyPage() {
  return (
    <main id="main-content" className="editorial-page methodology-page">
      <header className="editorial-hero">
        <div><span className="section-kicker">Methodology / Read the fine print</span><h1>What the pixels<br /><em>can tell you.</em></h1><p>A reproducible description of the live explorer, from a catalogue request to a visual difference. No hidden step turns a preview into a scientific measurement.</p></div>
        <aside className="editorial-hero__note"><span className="eyebrow">Current implementation</span><strong>Browse-image screening</strong><p>The map shows acquisition footprints. Preview images are uncalibrated and unregistered; their pixel percentages are exploratory.</p></aside>
      </header>
      <div className="editorial-body method-layout">
        <nav className="method-index" aria-label="Methodology sections"><span className="eyebrow">In this method</span><a href="#live-pipeline">01 / Live pipeline</a><a href="#pixel-statistics">02 / Reading a percentage</a><a href="#offline-workflow">03 / Offline workflow</a><a href="#scientific-boundary">04 / Scientific boundary</a></nav>
        <div>
          <section id="live-pipeline" className="method-section" aria-label="Current live pipeline">
            <span className="section-kicker">01 / Current live pipeline</span><h2>What runs, and what comes out.</h2>
            <ol className="method-steps">{steps.map((step, index) => <li key={step.title}><span className="step-number">0{index + 1}</span><div><h3>{step.title}</h3><p>{step.detail}</p><span className="method-steps__output">{step.output}</span></div></li>)}</ol>
          </section>
          <section id="pixel-statistics" className="method-section" aria-label="What the percentages mean">
            <span className="section-kicker">02 / Reading a percentage</span><h2>A share of the preview.<br /><em>Not a share of the land.</em></h2>
            <div className="difference-formula"><span className="eyebrow">Display-pixel calculation</span><code>L = 0.2126 R + 0.7152 G + 0.0722 B</code><code>|L_later - L_earlier| &gt; 26</code><p>Changed share = changed pixels / compared non-transparent pixels.</p></div>
            <p>These are visual screening statistics, not georeferenced measurements. A changed share is not an area in square kilometres, a water-depth estimate, a glacier speed, or a probability of hazard.</p>
            <p>Different image stretches, resampling, viewing geometry and unregistered features can all change the result. Moisture, roughness and seasonal surface conditions can change radar brightness without permanent land or ice loss.</p>
          </section>
          <section id="offline-workflow" className="method-section method-offline" aria-label="Calibrated offline workflow">
            <span className="section-kicker">03 / Separate research workflow</span><h2>Calibrated data lives<br />on a different path.</h2>
            <p>The repository retains precomputed NISAR GCOV bundles for Kuakata and Jakobshavn. The offline Python tools read selected HDF5 windows and derive gamma-0 backscatter differences, thresholded water or surface-change summaries, and clusters.</p>
            <p>This calibrated offline workflow is reproducible but <strong>not connected to the explorer UI</strong>. Its rasters, thresholds and statistics are not the browse comparison described above. The NISAR calibration and interpretations remain provisional.</p>
            <a className="text-link" href="https://github.com/Shadman-Samin/EarthEyes_NASASpaceApps/tree/development/tools/analysis" target="_blank" rel="noreferrer">Inspect the offline pipeline <Icon name="external" size={16} /></a>
          </section>
          <section id="scientific-boundary" className="method-section" aria-labelledby="boundary-title">
            <span className="section-kicker">04 / Scientific boundary</span><h2 id="boundary-title">Three conclusions this view cannot make.</h2>
            <dl className="boundary-list"><div><dt>Coasts</dt><dd>SAR is not a sea-level gauge. Shoreline appearance alone cannot attribute change to sea-level rise; tide, surge, sediment and land motion need independent evidence.</dd></div><div><dt>Ice</dt><dd>Amplitude or browse brightness change is not velocity, displacement or mass loss. Those require suitable source products, processing and validation.</dd></div><div><dt>Glacial lakes</dt><dd>A visible change is not a glacial lake outburst flood forecast. Field evidence, analyst review and responsible authority approval must precede a public warning.</dd></div></dl>
            <div className="editorial-endnote"><p>Inspect the source and the assumptions before using a visual pattern to support an explanation.</p><Link className="text-link" to="/explore">Open the explorer <Icon name="arrow" size={16} /></Link></div>
          </section>
        </div>
      </div>
    </main>
  )
}
