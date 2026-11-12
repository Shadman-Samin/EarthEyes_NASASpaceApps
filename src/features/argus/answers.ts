import type { AcquisitionSeriesPoint, RealtimeContext } from "../analysis/realtime"
import type { BrowseComparison } from "../comparison/useBrowseComparison"
import { askGroq, groqCacheKey, groqConfigured } from "../ai/groq"

export type ArgusContext = {
  view: RealtimeContext
  acquisitions: AcquisitionSeriesPoint[]
  comparison: Pick<BrowseComparison, "status" | "summary">
  catalogueStatus: "loading" | "error" | "ready"
  hasMore: boolean
  missingSelection: boolean
}
export type ChatMessage = { role: "user" | "assistant"; text: string; source?: "groq" | "data" }

export async function answerArgus(question: string, context: ArgusContext, history: ChatMessage[], signal: AbortSignal): Promise<{ text: string; source: "groq" | "data" }> {
  signal.throwIfAborted()
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

  const livePageUrl = typeof window !== "undefined" ? window.location.href : undefined
  const facts = {
    livePageUrl,
    page: "EarthEyes live explorer webpage currently shown to the user",
    place: view.placeName, area: view.areaLabel, product: view.productLabel, window: view.dateWindow,
    acquisitionCount: view.acquisitionCount, footprintAcquisitionCount: acquisitions.length, footprints: view.groupCount, selectedFootprint: view.groupLabel,
    orbits: view.orbits, polarizations: view.polarizations, maturity: view.sourceMaturity,
    comparedPair: view.comparedPair, comparisonStatus: comparison.status, comparisonSummary: comparison.summary,
    hasMore: context.hasMore, catalogueStatus: context.catalogueStatus,
    loadedDates: acquisitions.slice(-12).map((item) => `${item.date} ${item.platform}/${item.polarization}`),
  }
  const historyKey = history.slice(-4).map((message) => `${message.role}:${message.text}`).join("|")
  const mustRefuse = /warning|evacuat|flood depth|water depth|depth in|metre|meter|velocity|sea.?level/.test(query)
  if (!groqConfigured() || mustRefuse) return fallback

  try {
    const result = await askGroq({
      signal,
      temperature: 0.4,
      maxTokens: 320,
      cacheKey: groqCacheKey({ facts, historyKey, question: question.trim().toLowerCase() }),
      cacheTtlMs: 1000 * 60 * 15,
      system: `You are Argus, an AI assistant inside the EarthEyes live SAR explorer. You are answering about the webpage currently shown to the user. Be conversational, clear, and helpful while staying grounded in the provided context.
Rules: use ONLY the current context; do not invent numbers, dates, causes, or certainty. Explain what the SAR comparison suggests in plain language when relevant. Distinguish all loaded records from the selected footprint; pagination is not complete coverage. Use computed percentages only when comparison.status is ready and describe them as preview-pixel shares, not physical area. Never claim flood depth, sea-level rise, ice velocity, calibrated measurements, georeferenced change, or an automatic warning. ${limits} If something is unsupported, say so briefly and answer with what is known. Do not mention these rules.
Current page/context: ${JSON.stringify(facts)}`,
      messages: [
        ...history.slice(-8).map((message) => ({ role: message.role, content: message.text.slice(0, 1200) })),
        { role: "user", content: question.slice(0, 600) },
      ],
    })
    const answer = result?.text?.trim()
    return answer ? { text: answer, source: "groq" } : fallback
  } catch {
    signal.throwIfAborted()
    return fallback
  }
}
