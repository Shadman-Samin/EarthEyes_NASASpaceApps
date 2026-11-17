// Argus AI transport. Requests go to the same-origin /api/argus proxy so no API key
// ships in the client bundle. Responses are cached to protect the shared quota.
import type { AnalysisQuery } from "../../domain/analysis"

export type ArgusTurn = { role: "user" | "assistant"; text: string }

export type ArgusAiPayload = {
  mode: "chat" | "summary"
  facts: Record<string, unknown>
  question?: string
  history?: ArgusTurn[]
  images?: string[]
  analysisQuery?: AnalysisQuery
}

const CHAT_TTL_MS = 1000 * 60 * 15
const SUMMARY_TTL_MS = 1000 * 60 * 60
const PREFIX = "eartheyes:argus:"
const TIMEOUT_MS = 20_000

const memory = new Map<string, { text: string; expires: number }>()

export function argusSummaryEnabled(): boolean {
  return Boolean(import.meta.env.VITE_GROQ_VISION_MODEL)
}

export function argusEndpoint(): string {
  const configured = import.meta.env.VITE_CATALOGUE_API_BASE_URL as string | undefined
  if (configured) {
    try {
      return `${new URL(configured).origin}/api/argus`
    } catch {
      // Fall through to the same-origin path.
    }
  }
  return `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api/argus`
}

export function argusCacheKey(value: unknown): string {
  const text = typeof value === "string" ? value : JSON.stringify(value)
  let hash = 0x811c9dc5
  for (let index = 0; index < text.length; index++) {
    hash ^= text.charCodeAt(index)
    hash = Math.imul(hash, 0x01000193)
  }
  return `${PREFIX}${(hash >>> 0).toString(36)}`
}

function readCache(key: string): string | null {
  const now = Date.now()
  const local = memory.get(key)
  if (local && local.expires > now) return local.text
  if (local) memory.delete(key)
  try {
    const raw = window.localStorage.getItem(key)
    if (!raw) return null
    const parsed = JSON.parse(raw) as { text?: string; expires?: number }
    if (typeof parsed.text === "string" && typeof parsed.expires === "number" && parsed.expires > now) {
      memory.set(key, { text: parsed.text, expires: parsed.expires })
      return parsed.text
    }
    window.localStorage.removeItem(key)
  } catch {
    // Storage can be unavailable; the cache is an optimisation, never a requirement.
  }
  return null
}

function writeCache(key: string, text: string, ttl: number) {
  const entry = { text, expires: Date.now() + ttl }
  memory.set(key, entry)
  try {
    window.localStorage.setItem(key, JSON.stringify(entry))
  } catch {
    // Ignore quota or privacy-mode failures.
  }
}

/**
 * Returns the model text, or null when the proxy is unavailable, rate limited, or failing.
 * Callers must always keep a deterministic fallback; AI is never the only answer.
 */
export async function askArgusAI(payload: ArgusAiPayload, signal?: AbortSignal): Promise<{ text: string; cached: boolean; source: "groq" | "data" } | null> {
  const cacheKey = argusCacheKey({ mode: payload.mode, facts: payload.facts, question: payload.question, history: payload.history, images: payload.images?.length })
  const cached = payload.analysisQuery ? null : readCache(cacheKey)
  if (cached) return { text: cached, cached: true, source: "groq" }

  try {
    const response = await fetch(argusEndpoint(), {
      method: "POST",
      credentials: "omit",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify(payload),
      signal: signal ? AbortSignal.any([signal, AbortSignal.timeout(TIMEOUT_MS)]) : AbortSignal.timeout(TIMEOUT_MS),
    })
    if (!response.ok) return null
    const data: unknown = await response.json().catch(() => null)
    const text = (data as { text?: unknown } | null)?.text
    if (typeof text !== "string" || !text.trim()) return null
    const answer = text.trim()
    const source = (data as { source?: string }).source === "data" ? "data" : "groq"
    if (!payload.analysisQuery) writeCache(cacheKey, answer, payload.mode === "summary" ? SUMMARY_TTL_MS : CHAT_TTL_MS)
    return { text: answer, cached: false, source }
  } catch (error) {
    if (signal?.aborted) throw error
    return null
  }
}
