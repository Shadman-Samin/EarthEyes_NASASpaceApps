import type { RealtimeContext } from "./realtime"
import { argusSummaryEnabled, askArgusAI } from "../ai/groq"

export type Narrative = { headline: string; summary: string; limits: string[]; source: "groq-vision" | "template" }

function toDataUrlFromImageUrl(url: string): Promise<string | null> {
  return new Promise((resolve) => {
    const img = new Image()
    img.crossOrigin = "anonymous"
    img.onload = () => {
      try {
        const max = 768
        const scale = Math.min(1, max / Math.max(img.naturalWidth, img.naturalHeight))
        const w = Math.max(1, Math.round(img.naturalWidth * scale))
        const h = Math.max(1, Math.round(img.naturalHeight * scale))
        const c = document.createElement("canvas")
        c.width = w
        c.height = h
        const ctx = c.getContext("2d")
        if (!ctx) return resolve(null)
        ctx.drawImage(img, 0, 0, w, h)
        resolve(c.toDataURL("image/jpeg", 0.7))
      } catch {
        resolve(null)
      }
    }
    img.onerror = () => resolve(null)
    img.src = url
  })
}

function template(ctx: RealtimeContext, diff?: { changedPct: number; brighterPct: number; darkerPct: number; headline: string; detail: string } | null): Narrative {
  const pair = ctx.comparedPair
  if (!pair) {
    if (!ctx.acquisitionCount) {
      return { headline: `No acquisitions for ${ctx.placeName}`, summary: `No radar records found for ${ctx.areaLabel} in this window. Try a wider date range or a different area.`, limits: ["No imagery available to analyze."], source: "template" }
    }
    return { headline: `${ctx.footprintAcquisitionCount} radar acquisitions over ${ctx.placeName}`, summary: `Loaded ${ctx.footprintAcquisitionCount} acquisition dates in the selected footprint (${ctx.acquisitionCount} records across ${ctx.groupCount} footprints) for ${ctx.areaLabel}${ctx.dateWindow ? ` (${ctx.dateWindow.start}–${ctx.dateWindow.end})` : ""}. Select or wait for two previews to analyze visual change.`, limits: ["At least two acquisitions with images are needed for a visual comparison."], source: "template" }
  }
  if (diff) {
    return {
      headline: `${ctx.placeName}: ~${diff.changedPct}% of preview shows change (${pair.from} → ${pair.to})`,
      summary: `${diff.headline}. ${diff.detail} Computed in real time by comparing pulled radar preview images over ${ctx.areaLabel} (${ctx.productLabel}). ${ctx.footprintAcquisitionCount} acquisition dates in this footprint; ${ctx.acquisitionCount} records loaded across ${ctx.groupCount} footprints.`,
      limits: ["Exploratory: based on browse preview images, not a calibrated or georeferenced measurement.", "Brightness change can reflect water, moisture, roughness, season, or imaging conditions — not only permanent change.", "Not a hazard warning."],
      source: "template",
    }
  }
  return { headline: `Comparing ${pair.from} → ${pair.to} over ${ctx.placeName}`, summary: `Analyzing real pulled radar previews for ${ctx.areaLabel}.`, limits: ["Exploratory preview comparison."], source: "template" }
}

export async function generateNarrative(opts: {
  ctx: RealtimeContext
  diff?: { changedPct: number; brighterPct: number; darkerPct: number; headline: string; detail: string } | null
  earlierImageUrl?: string
  laterImageUrl?: string
}): Promise<Narrative> {
  const { ctx, diff, earlierImageUrl, laterImageUrl } = opts
  const base = template(ctx, diff)
  // Keep the shared text model for user-triggered Argus chat; summaries need a vision model.
  if (!argusSummaryEnabled() || !earlierImageUrl || !laterImageUrl) return base

  const facts = {
    place: ctx.placeName,
    area: ctx.areaLabel,
    bounds: ctx.bounds,
    product: ctx.productLabel,
    window: ctx.dateWindow,
    recordsLoaded: ctx.acquisitionCount,
    acquisitionDatesInFootprint: ctx.footprintAcquisitionCount,
    footprints: ctx.groupCount,
    orbits: ctx.orbits,
    polarizations: ctx.polarizations,
    maturity: ctx.sourceMaturity,
    comparedPair: ctx.comparedPair,
    computedDiff: diff ?? null,
  }

  try {
    const [earlier, later] = await Promise.all([toDataUrlFromImageUrl(earlierImageUrl), toDataUrlFromImageUrl(laterImageUrl)])
    const images = [earlier, later].filter((image): image is string => Boolean(image))
    if (!images.length) return base
    const result = await askArgusAI({ mode: "summary", facts, images })
    if (!result) return base
    const parsed = JSON.parse(result.text) as { headline?: unknown; summary?: unknown; limits?: unknown }
    if (typeof parsed?.headline !== "string" || typeof parsed?.summary !== "string") return base
    const limits = Array.isArray(parsed.limits) && parsed.limits.length ? parsed.limits.map(String) : base.limits
    return { headline: parsed.headline, summary: parsed.summary, limits, source: "groq-vision" }
  } catch {
    return base
  }
}
