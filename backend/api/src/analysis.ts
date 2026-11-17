import { analysisIndexSchema, analysisQuerySchema, matchesAnalysis, type AnalysisQuery, type AnalysisResult } from "../../../src/domain/analysis.js"
import index from "./analysis-index.json" with { type: "json" }
import { parseCatalogueQuery } from "./query.js"

const published = analysisIndexSchema.safeParse(index)

export function parseAnalysisQuery(params: URLSearchParams): AnalysisQuery {
  if (params.has("limit") || params.has("cursor") || params.getAll("polarization").length > 1) throw new Error("Unexpected analysis query")
  const catalogue = new URLSearchParams(params)
  catalogue.delete("polarization")
  const { product, bbox, start, end } = parseCatalogueQuery(catalogue)
  return analysisQuerySchema.parse({ product, bbox, start, end, ...(params.has("polarization") ? { polarization: params.get("polarization") } : {}) })
}

export function lookupAnalysis(query: AnalysisQuery): AnalysisResult {
  if (!published.success) throw new Error("Published analysis index is invalid")
  const match = published.data.entries.find((entry) => matchesAnalysis(entry, query))
  return match ? { status: "analysis_available", manifest: match }
    : { status: "analysis_unavailable", reason: "No published analysis exactly matches these bounds, dates, product and polarization. Browse previews remain available; no processing job has been started." }
}

export function analysisAnswer(result: AnalysisResult, question: string): string {
  if (result.status === "analysis_unavailable") return result.reason
  const bundle = result.manifest
  const q = question.toLowerCase()
  const limits = "Exploratory result, not ground-truth validated. It cannot establish depth, tide, ice velocity, cause or a public warning."
  if (/depth|velocity|warning|evacuat|sea.?level|cause/.test(q)) return limits
  if (/\b(?:dates?|when|epochs?|polarizations?|orbits?)\b/.test(q)) {
    return `${bundle.label}: first epoch ${bundle.epochs.first.dates.join(", ")}; last epoch ${bundle.epochs.last.dates.join(", ")}. ${bundle.polarization} polarization, track ${bundle.provenance.series.relative_orbit}, frame ${bundle.provenance.series.frame}. ${limits}`
  }
  const references = bundle.validation.references.map((check) => `${check.source}: ${check.compared_dates}/${check.attempted_dates} dates compared`).join("; ") || "Independent reference checks not completed"
  if (/validat|reference|source|uncertain|method|reliab|calibrat/.test(q)) {
    return `Source: ${bundle.provenance.collection}, ${bundle.source_maturity} maturity. Source calibration does not validate this derived result. ${references}. Threshold sweeps are sensitivity ranges, not confidence intervals. No independent-look gain is assumed from compositing. ${limits}`
  }
  const format = (number: number) => number.toLocaleString("en-US", { maximumFractionDigits: 3 })
  const claims = bundle.claims.map((claim) => `- ${claim.label}: ${format(claim.value)} ${claim.unit}.${claim.sensitivity ? ` Sensitivity ${format(claim.sensitivity.low)} to ${format(claim.sensitivity.high)} ${claim.unit}, not a confidence interval.` : ""}`)
  return `${bundle.label}, ${bundle.dates[0].date} to ${bundle.dates.at(-1)!.date}:\n${claims.join("\n")}\nZero retained area is not proof of no change. ${limits}`
}
