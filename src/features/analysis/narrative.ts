import type { RealtimeContext } from "./realtime"

export type Narrative = { headline: string; summary: string; limits: string[]; source: "groq-vision" | "groq" | "template" }

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
    return { headline: `${ctx.acquisitionCount} radar acquisitions over ${ctx.placeName}`, summary: `Loaded ${ctx.acquisitionCount} real acquisitions for ${ctx.areaLabel}${ctx.dateWindow ? ` (${ctx.dateWindow.start}–${ctx.dateWindow.end})` : ""}. Select or wait for two previews to analyze visual change.`, limits: ["At least two acquisitions with images are needed for a visual comparison."], source: "template" }
  }
  if (diff) {
    return {
      headline: `${ctx.placeName}: ~${diff.changedPct}% of preview shows change (${pair.from} → ${pair.to})`,
      summary: `${diff.headline}. ${diff.detail} Computed in real time by comparing pulled radar preview images over ${ctx.areaLabel} (${ctx.productLabel}). ${ctx.acquisitionCount} acquisitions in this footprint.`,
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
  const apiKey = import.meta.env.VITE_GROQ_API_KEY as string | undefined
  const base = template(ctx, diff)
  if (!apiKey) return base
  const facts = {
    place: ctx.placeName,
    area: ctx.areaLabel,
    bounds: ctx.bounds,
    product: ctx.productLabel,
    window: ctx.dateWindow,
    acquisitions: ctx.acquisitionCount,
    footprints: ctx.groupCount,
    orbits: ctx.orbits,
    polarizations: ctx.polarizations,
    maturity: ctx.sourceMaturity,
    compared: ctx.comparedPair,
    computedDiff: diff ?? null,
  }
  const system = 'You are an earth-observation analyst explaining satellite SAR imagery to non-experts and judges. Use ONLY the provided facts and what you can see in the images. Never invent numbers, causes, or certainty. Be specific to this place and dates. Distinguish observation from interpretation. Keep it short (3-6 sentences). Output strict JSON: {"headline":"...","summary":"...","limits":["...","..."]}.'
  const userText = `Facts (computed in real time from pulled archive data, do not contradict):\n${JSON.stringify(facts, null, 2)}\n\nExplain what a viewer sees and what changed between the earlier and later radar preview for this exact location. If images are provided, describe visible patterns (darker=smoother/water, brighter=rough/vegetation/ice texture) and relate them to the computed diff stats. Be relevant to this place and dates. State limits honestly.`
  const textModel = (import.meta.env.VITE_GROQ_MODEL as string | undefined) || "qwen/qwen3.8-27b"
  const visionModel = import.meta.env.VITE_GROQ_VISION_MODEL as string | undefined

  const request = async (model: string, content: string | Array<Record<string, unknown>>) => {
    const res = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
      body: JSON.stringify({ model, messages: [{ role: "system", content: system }, { role: "user", content }], temperature: 0.2, max_tokens: 450, response_format: { type: "json_object" } }),
    })
    if (!res.ok) throw new Error(String(res.status))
    const data = await res.json()
    const raw = data?.choices?.[0]?.message?.content
    const parsed = typeof raw === "string" ? JSON.parse(raw) : raw
    if (!parsed?.headline || !parsed?.summary) throw new Error("invalid narrative")
    return {
      headline: String(parsed.headline),
      summary: String(parsed.summary),
      limits: Array.isArray(parsed.limits) && parsed.limits.length ? parsed.limits.map(String) : base.limits,
    }
  }

  if (visionModel && earlierImageUrl && laterImageUrl) {
    try {
      const [a, b] = await Promise.all([toDataUrlFromImageUrl(earlierImageUrl), toDataUrlFromImageUrl(laterImageUrl)])
      const content: Array<Record<string, unknown>> = [{ type: "text", text: userText }]
      if (a) content.push({ type: "text", text: "Earlier radar preview:" }, { type: "image_url", image_url: { url: a } })
      if (b) content.push({ type: "text", text: "Later radar preview:" }, { type: "image_url", image_url: { url: b } })
      if (content.length > 1) return { ...(await request(visionModel, content)), source: "groq-vision" }
    } catch {
      // Fall through to a facts-only request with the text model.
    }
  }

  try {
    return { ...(await request(textModel, userText)), source: "groq" }
  } catch {
    return base
  }
}
