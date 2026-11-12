import { Link, useParams } from "react-router-dom"
import { usePlaces } from "../../data/queries"
import { Icon, Skeleton, StatePanel } from "../../shared/ui"

const storyCopy: Record<string, {
  title: string
  lead: string
  question: string
  inspect: string
  evidence: Array<{ title: string; detail: string; sourceId: string; sourceLabel: string }>
  limit: string
}> = {
  "kuakata-changing-coast": {
    title: "Kuakata: reading the water's edge",
    lead: "At a low-lying Bay of Bengal coast, water and land can look different between acquisitions without revealing a single cause.",
    question: "Does the visible difference persist after checking tide and surface conditions?",
    inspect: "Pull acquisitions for the Kuakata bounds. Keep the footprint, product family and polarization consistent; compare the dated previews and note where brightness changes near the coast. Record the source IDs before proposing an explanation.",
    evidence: [
      { title: "Tide, surge and local water level", detail: "Match tide-gauge and surge records to the actual acquisition times. Regional altimetry is independent sea-level context, not a substitute for a coastal water-level observation.", sourceId: "altimetry-argo", sourceLabel: "Ocean and sea-level context" },
      { title: "Rain, wind and sediment conditions", detail: "Check weather and independent imagery. Wind-driven roughness, wet soil and sediment changes can alter radar brightness and the apparent water edge.", sourceId: "era5", sourceLabel: "Weather-context limitations" },
    ],
    limit: "A preview difference does not measure shoreline retreat, land loss or water depth. Even a validated shoreline shift would not, by itself, show that sea-level rise caused it.",
  },
  "barishal-water-land": {
    title: "Barishal: water in a river landscape",
    lead: "Rivers, seasonal water and settlements make a useful investigation, but an image comparison is not a flood bulletin.",
    question: "Is the apparent water change seasonal, weather-related, or something that needs local review?",
    inspect: "Search the Barishal bounds for a repeat footprint. Compare previews across the available dates, inspect the acquisition timeline for gaps, and distinguish an observed brightness pattern from an assumed inundation boundary.",
    evidence: [
      { title: "River gauges and local reports", detail: "Compare river gauge levels and dated field reports with the acquisition times. Only current guidance from the responsible authority can inform public action; GroundLine is not that service.", sourceId: "local-authority", sourceLabel: "Responsible authority records" },
      { title: "Rainfall and exposure", detail: "Rainfall timing and catchment conditions help interpret water patterns. Modeled population grids can inform a later exposure assessment, but cannot tell who is present or who needs evacuation now.", sourceId: "worldpop", sourceLabel: "Population-context limitations" },
    ],
    limit: "The preview cannot establish flood depth, affected population or safe routes. A visual change is not a forecast, a verified flood extent or an instruction to evacuate.",
  },
  "jakobshavn-ice-in-motion": {
    title: "Jakobshavn: brightness is not speed",
    lead: "A Greenland glacier can change its radar appearance as surface conditions and acquisition geometry change. Ice motion is a different measurement.",
    question: "What would distinguish a surface-brightness change from actual ice movement?",
    inspect: "Pull acquisitions over the Jakobshavn bounds and inspect dates, orbit information and HH/HV preview selection. Compare the same footprint and examine the brighter/darker shares as visual signals, not displacement vectors.",
    evidence: [
      { title: "Validated velocity and front positions", detail: "A velocity estimate needs suitable repeat observations, co-registration or other appropriate processing, quality masks and uncertainty. A calving-front change needs a georeferenced boundary checked against independent imagery.", sourceId: "nisar", sourceLabel: "NISAR observation limits" },
      { title: "Elevation and surface conditions", detail: "ICESat-2 can provide independent elevation context where tracks and quality permit. Temperature and melt-season conditions matter, but neither a short temperature record nor a brightness pattern establishes long-term mass loss.", sourceId: "icesat-2", sourceLabel: "ICESat-2 sampling limits" },
    ],
    limit: "A browse preview difference is not glacier velocity, ice-front displacement or ice-mass loss. It cannot establish a long-term trend or attribute a change to a single climatic driver.",
  },
  "imja-lake-review": {
    title: "Imja Tsho: from a signal to a review",
    lead: "A Himalayan glacial lake is a setting for asking what evidence a hazard review requires, not for generating an automatic warning.",
    question: "What must be checked before a lake-change candidate reaches a responsible authority?",
    inspect: "Search the Imja Tsho bounds and inspect available acquisition footprints and dates. Check for terrain shadow, layover and incomplete coverage before interpreting any apparent change near the lake. No lake-area measurement is supplied by the browse difference.",
    evidence: [
      { title: "Lake, dam and terrain observations", detail: "A review needs validated lake boundaries, dam geometry and condition, lake depth where available, and terrain evidence. A static elevation model alone does not resolve dam stability or an outburst mechanism.", sourceId: "nasa-dem", sourceLabel: "Terrain-data limitations" },
      { title: "Field corroboration and authority review", detail: "Potential downstream consequences need appropriate modeling, field evidence and local assessment. An authority must evaluate the evidence before any public SMS or voice message; a review candidate is never a warning.", sourceId: "local-authority", sourceLabel: "Authority-record requirements" },
    ],
    limit: "The preview cannot predict a glacial lake outburst flood, its timing or a downstream inundation area. EarthEyes does not issue operational warnings or evacuation advice.",
  },
}

export function StoryPage() {
  const { storySlug = "" } = useParams()
  const placesQuery = usePlaces("")
  const place = placesQuery.data?.find((candidate) => candidate.storySlug === storySlug)
  const story = storyCopy[storySlug]
  if (placesQuery.isLoading) return <main id="main-content" className="editorial-page content-page"><h1>Loading field notes</h1><Skeleton lines={7} /></main>
  if (placesQuery.isError || !place || !story) return <main id="main-content" className="editorial-page content-page"><h1>Field notes unavailable</h1><StatePanel title="Story not found" message="This reference investigation could not be loaded." icon="book" /><Link className="text-link" to="/">Return to Home <Icon name="arrow" size={16} /></Link></main>
  return (
    <main id="main-content" className="editorial-page story-page">
      <header className="editorial-hero"><div><span className="section-kicker">Field notes / {place.country}</span><h1>{story.title}</h1><p>{story.lead}</p><Link className="button button--primary button--medium" to={`/explore/${place.id}?module=${place.moduleIds[0]}&mode=swipe`}>Open workspace <Icon name="arrow" size={17} /></Link></div><aside className="editorial-hero__note"><span className="eyebrow">A guide to investigation</span><strong>Questions, not reported findings.</strong><p>These notes frame a reference place. Available records depend on the selected bounds, dates and provider coverage.</p></aside></header>
      <div className="editorial-body">
        <section className="story-question" aria-labelledby="story-question-title"><span className="section-kicker section-kicker--light">The field question</span><h2 id="story-question-title">{story.question}</h2></section>
        <section className="story-reading" aria-labelledby="story-inspect-title"><header><span className="step-number">01 / In the current explorer</span><h2 id="story-inspect-title">What to inspect</h2></header><div><p>{story.inspect}</p><Link className="text-link" to="/methodology">Understand the preview method <Icon name="arrow" size={16} /></Link></div></section>
        <section className="story-reading" aria-label="Evidence still needed"><header><span className="step-number">02 / Beyond the preview</span><h2>Evidence still needed</h2></header><div className="story-evidence">{story.evidence.map((item) => <article key={item.title}><h3>{item.title}</h3><p>{item.detail}</p><Link className="text-link" to={`/data-sources/${item.sourceId}`}>{item.sourceLabel} <Icon name="arrow" size={16} /></Link></article>)}</div></section>
        <section className="story-limit" aria-label="What cannot be concluded"><Icon name="shield" size={26} /><div><span className="section-kicker">03 / Interpretation boundary</span><h2>What cannot be concluded</h2><p>{story.limit}</p></div></section>
        <div className="editorial-endnote"><Link className="text-link" to="/">All reference investigations <Icon name="arrow" size={16} /></Link>{place.moduleIds.includes("glof") && <Link className="text-link" to="/groundline">Inspect GroundLine's review gates <Icon name="arrow" size={16} /></Link>}</div>
      </div>
    </main>
  )
}
