import { Link, useParams } from "react-router-dom"
import { usePlaces } from "../../data/queries"
import { DataBadge, Icon, Skeleton, StatePanel } from "../../shared/ui"

const storyCopy: Record<string, { title: string; lead: string; question: string }> = {
  "kuakata-changing-coast": { title: "A changing edge at Kuakata", lead: "A shoreline can move between two radar acquisitions. The difficult question is why.", question: "Where does observed surface change end and causal interpretation begin?" },
  "barishal-water-land": { title: "Water and land around Barishal", lead: "Surface water, river stage, rain, settlement exposure, and local reports belong in one review, but not in one undifferentiated metric.", question: "How can a map support local review without becoming an unverified warning?" },
  "jakobshavn-ice-in-motion": { title: "Jakobshavn: ice in motion", lead: "Repeat SAR acquisitions can support displacement and velocity products through cloud and darkness.", question: "Which changes persist after geometry, alignment, and surface-condition checks?" },
  "imja-lake-review": { title: "Imja Tsho: from change to review", lead: "Mapped lake-area change can prioritize investigation. It does not determine downstream consequence by itself.", question: "What evidence must exist before a review candidate reaches an authority?" },
}

export function StoryPage() {
  const { storySlug = "" } = useParams()
  const placesQuery = usePlaces("")
  const place = placesQuery.data?.find((candidate) => candidate.storySlug === storySlug)
  const story = storyCopy[storySlug]
  if (placesQuery.isLoading) return <main id="main-content" className="content-page"><Skeleton lines={7} /></main>
  if (placesQuery.isError) return <main id="main-content" className="content-page"><StatePanel title="Story unavailable" message="The place catalogue could not be loaded." icon="alert" /></main>
  if (!place || !story) return <main id="main-content" className="content-page"><StatePanel title="Story not found" message="This guided investigation is unavailable." icon="book" /></main>
  return (
    <main id="main-content" className="story-page">
      <header><span className="section-kicker">Guided investigation / {place.country}</span><h1>{story.title}</h1><p>{story.lead}</p><Link className="button button--primary button--medium" to={`/explore/${place.id}?module=${place.moduleIds[0]}&mode=swipe`}>Open workspace <Icon name="arrow" size={16} /></Link></header>
      <section className="story-question"><span>Field question</span><h2>{story.question}</h2></section>
      <section className="story-steps"><article><DataBadge value="observed" /><h2>Start with acquisition facts</h2><p>Check platform, instrument, orbit, polarization, processing level, resolution, overlap, and alignment before comparing visual patterns.</p></article><article><DataBadge value="derived" /><h2>Inspect change products</h2><p>Use derived boundaries, displacement, water, or velocity only inside their valid mask and with the listed uncertainty.</p></article><article><DataBadge value="context" /><h2>Cross-check independent context</h2><p>Terrain, tide, temperature, weather, elevation, settlements, and authority records answer different questions from SAR.</p></article></section>
      <blockquote>“Observe first. Explain carefully. Warn only after validation.”<cite>EarthEyes evidence principle</cite></blockquote>
    </main>
  )
}
