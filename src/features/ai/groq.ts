// Shared Groq client. All AI calls (Argus chat + computed summary) pass through here so the
// free tier is protected with a response cache, in-flight de-duplication and a small throttle.
//
// Security note: VITE_ values are embedded in the client bundle. That is acceptable for a
// local demo, but a public deployment should proxy these calls through the Worker.

export type GroqContent = string | Array<Record<string, unknown>>
export type GroqMessage = { role: "system" | "user" | "assistant"; content: GroqContent }

export type GroqRequest = {
  messages: GroqMessage[]
  system?: string
  model?: string
  json?: boolean
  temperature?: number
  maxTokens?: number
  cacheKey?: string
  cacheTtlMs?: number
  signal?: AbortSignal
}

const DEFAULT_MODEL = "llama-3.3-70b-versatile"
const DEFAULT_TTL = 1000 * 60 * 60 * 6
const MIN_GAP_MS = 1100
const PREFIX = "eartheyes:groq:"

const memory = new Map<string, { text: string; expires: number }>()
let lastCallAt = 0
let blockedUntil = 0
let chain: Promise<unknown> = Promise.resolve()

export function groqApiKey(): string | undefined {
  return import.meta.env.VITE_GROQ_API_KEY as string | undefined
}

export function groqModel(): string {
  return (import.meta.env.VITE_GROQ_MODEL as string | undefined) || DEFAULT_MODEL
}

export function groqVisionModel(): string | undefined {
  return import.meta.env.VITE_GROQ_VISION_MODEL as string | undefined
}

export function groqConfigured(): boolean {
  return Boolean(groqApiKey())
}

export function groqCacheKey(value: unknown): string {
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

function sleep(ms: number) {
  return new Promise((resolve) => window.setTimeout(resolve, ms))
}

function schedule<T>(work: () => Promise<T>): Promise<T> {
  const run = chain.then(async () => {
    const wait = Math.max(blockedUntil - Date.now(), MIN_GAP_MS - (Date.now() - lastCallAt))
    if (wait > 0) await sleep(wait)
    lastCallAt = Date.now()
    return work()
  })
  chain = run.then(() => undefined, () => undefined)
  return run
}

/**
 * Returns the model text, or null when Groq is not configured / unavailable / rate limited.
 * Callers must always keep a deterministic fallback; AI is never the only answer.
 */
export async function askGroq(request: GroqRequest): Promise<{ text: string; cached: boolean } | null> {
  const apiKey = groqApiKey()
  if (!apiKey) return null

  const model = request.model || groqModel()
  const cacheKey = request.cacheKey || (request.messages.length === 1 && typeof request.messages[0].content === "string"
    ? groqCacheKey(`${model}|${request.system ?? ""}|${request.messages[0].content}`)
    : undefined)
  if (cacheKey) {
    const cached = readCache(cacheKey)
    if (cached) return { text: cached, cached: true }
  }

  const messages: GroqMessage[] = request.system ? [{ role: "system", content: request.system }, ...request.messages] : request.messages
  const signal = request.signal
    ? AbortSignal.any([request.signal, AbortSignal.timeout(15_000)])
    : AbortSignal.timeout(15_000)

  try {
    return await schedule(async () => {
      if (blockedUntil > Date.now()) return null
      const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
        method: "POST",
        signal,
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${apiKey}` },
        body: JSON.stringify({
          model,
          temperature: request.temperature ?? 0.2,
          max_tokens: request.maxTokens ?? 400,
          ...(request.json ? { response_format: { type: "json_object" } } : {}),
          messages,
        }),
      })
      if (response.status === 429) {
        // Back off politely instead of burning the remaining free-tier quota.
        blockedUntil = Date.now() + 30_000
        return null
      }
      if (!response.ok) return null
      const data = await response.json()
      const text = data?.choices?.[0]?.message?.content
      if (typeof text !== "string" || !text.trim()) return null
      if (cacheKey) writeCache(cacheKey, text, request.cacheTtlMs ?? DEFAULT_TTL)
      return { text, cached: false }
    })
  } catch (error) {
    if (signal.aborted && request.signal?.aborted) throw error
    return null
  }
}
