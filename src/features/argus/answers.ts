import type { AcquisitionSeriesPoint, RealtimeContext } from "../analysis/realtime"
import type { BrowseComparison } from "../comparison/useBrowseComparison"
import { askArgusAI, type ArgusTurn } from "../ai/groq"
import type { AnalysisQuery } from "../../domain/analysis"

export type ArgusContext = {
  analysisQuery?: AnalysisQuery
  view: RealtimeContext
  acquisitions: AcquisitionSeriesPoint[]
  comparison: Pick<BrowseComparison, "status" | "summary">
  catalogueStatus: "loading" | "error" | "ready"
  hasMore: boolean
  missingSelection: boolean
  display: {
    moduleId: string
    moduleTitle: string
    comparisonMode: string
    view: "map" | "compare"
    polarization: string | null
    productId: string
    activeLayers: string[]
    previewsWithImages: number
    previewsMissing: number
  }
  page: { path: string; title: string }
}
export type ChatMessage = { role: "user" | "assistant"; text: string; source?: "groq" | "data" | "degraded" }

export async function answerArgus(question: string, context: ArgusContext, history: ChatMessage[], signal: AbortSignal): Promise<{ text: string; source: "groq" | "data" | "degraded" }> {
  signal.throwIfAborted()
  if (context.analysisQuery) {
    const result = await askArgusAI({ mode: "chat", question: question.trim().slice(0, 600), facts: {}, analysisQuery: context.analysisQuery }, signal)
    return result ? { text: result.text, source: result.source }
      : { text: "The published-analysis service could not answer. The evidence panel still shows the last loaded bundle; I will not substitute preview percentages for its measurements.", source: "degraded" }
  }
  const { view, comparison, acquisitions } = context
  const pair = view.comparedPair
  const limits = "These previews cannot establish flood depth, sea-level rise, ice velocity or a cause. They are uncalibrated and unregistered, not an automatic public warning."
  const unavailable = context.catalogueStatus === "loading" ? "The catalogue is still loading. Wait for the current acquisitions before interpreting change."
    : context.catalogueStatus === "error" ? "The latest catalogue request failed. Reload the current area before interpreting its results."
      : context.missingSelection ? "The requested selection is not loaded. Load more records or choose an available pair; I will not analyze a substitute."
        : null
  if (unavailable) return { text: unavailable, source: "data" }

  const diff = comparison.status === "ready" ? comparison.summary : null
  const change = !pair || pair.leftId === pair.rightId ? "Choose two different acquisitions for a comparison."
    : diff ? `${diff.changedPct}% of compared preview pixels changed: ${diff.brighterPct}% brighter and ${diff.darkerPct}% darker. These are display-pixel shares, not physical ground change.`
      : comparison.status === "loading" ? "The selected previews are still being compared; no change percentage is ready."
        : "No computed comparison is available for this pair. Missing previews or a failed calculation do not mean zero change."
  const summary = `${view.placeName}: ${view.acquisitionCount} acquisitions loaded across ${view.groupCount} footprints; ${acquisitions.length} in the selected footprint.${context.hasMore ? " More records are available; this is not complete archive coverage." : " These counts describe loaded records, not guaranteed archive coverage."}`
  const query = question.toLowerCase()
  const deterministic = () => {
    if (/warning|evacuat|flood depth|water depth|depth in|metre|meter|velocity|sea.?level/.test(query)) return limits
    if (/date|when|time|polar|orbit/.test(query)) return `${pair ? `Selected dates: ${pair.from} to ${pair.to}.` : "No comparison pair is selected."} Polarization in this footprint: ${[...new Set(acquisitions.map((item) => item.polarization))].join(", ") || "not reported"}. Orbit direction: ${[...new Set(acquisitions.map((item) => item.orbit))].join(", ") || "not reported"}.`
    if (/source|provider|product/.test(query)) return `${view.productLabel}; maturity: ${view.sourceMaturity}. ${view.sourceUrl ? `Provider record: ${view.sourceUrl}` : "No provider record is loaded."}`
    return `${summary} ${change}`
  }
  const fallback = { text: deterministic(), source: "data" as const }

  const mustRefuse = /warning|evacuat|flood depth|water depth|depth in|metre|meter|velocity|sea.?level/.test(query)
  if (mustRefuse) return fallback

  const livePageUrl = typeof window !== "undefined" ? window.location.href : undefined
  const facts = {
    livePageUrl,
    page: { ...context.page, description: "EarthEyes live SAR explorer webpage currently shown to the user" },
    display: context.display,
    view: {
      place: view.placeName, area: view.areaLabel, bounds: view.bounds, product: view.productLabel, window: view.dateWindow,
      productId: context.display.productId,
      acquisitionCount: view.acquisitionCount, footprintAcquisitionCount: acquisitions.length, footprints: view.groupCount, selectedFootprint: view.groupLabel,
      orbits: view.orbits, polarizations: view.polarizations, maturity: view.sourceMaturity, comparedPair: view.comparedPair,
    },
    comparison: { status: comparison.status, summary: comparison.summary },
    catalogue: { status: context.catalogueStatus, hasMore: context.hasMore, missingSelection: context.missingSelection },
    loadedDates: acquisitions.slice(-12).map((item) => `${item.date} ${item.platform}/${item.polarization}`),
  }
  const historyTurns: ArgusTurn[] = history.slice(-8).map((message) => ({ role: message.role, text: message.text.slice(0, 1200) }))

  try {
    const result = await askArgusAI({ mode: "chat", question: question.trim().slice(0, 600), history: historyTurns, facts }, signal)
    return result ? { text: result.text, source: "groq" } : { text: deterministic(), source: "degraded" }
  } catch {
    signal.throwIfAborted()
    return { text: deterministic(), source: "degraded" }
  }
}
