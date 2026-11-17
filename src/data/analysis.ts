import { analysisResultSchema, matchesAnalysis, type AnalysisQuery } from "../domain/analysis"

export async function fetchAnalysis(query: AnalysisQuery, signal: AbortSignal) {
  const configured = import.meta.env.VITE_CATALOGUE_API_BASE_URL as string | undefined
  const endpoint = configured ? configured.replace(/\/api\/catalog\/?$/, "/api/analysis")
    : `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/analysis`
  const params = new URLSearchParams({ product: query.product, bbox: query.bbox.join(","), start: query.start, end: query.end,
    ...(query.polarization ? { polarization: query.polarization } : {}) })
  const response = await fetch(`${endpoint}?${params}`, { credentials: "omit", headers: { Accept: "application/json" },
    signal: AbortSignal.any([signal, AbortSignal.timeout(20_000)]) })
  if (!response.ok) throw new Error("The published analysis service is unavailable. Browse previews remain separate.")
  const parsed = analysisResultSchema.safeParse(await response.json().catch(() => null))
  if (!parsed.success) throw new Error("The analysis service did not return a valid published bundle.")
  if (parsed.data.status === "analysis_available" && !matchesAnalysis(parsed.data.manifest, query)) {
    throw new Error("The returned analysis does not match the requested scope.")
  }
  return parsed.data
}
