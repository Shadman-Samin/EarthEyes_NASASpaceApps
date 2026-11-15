import { z } from "zod"

export type ArgusEnvironment = {
  GROQ_API_KEY?: string
  ARGUS_MODEL?: string
  ARGUS_VISION_MODEL?: string
}

export class ArgusError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
    readonly retryAfter?: string,
  ) {
    super(message)
    this.name = "ArgusError"
  }
}

const DEFAULT_MODEL = "qwen/qwen3.8-27b"
const GROQ_URL = "https://api.groq.com/openai/v1/chat/completions"
const CACHE_TTL_MS = 15 * 60_000
const MAX_CACHE_ENTRIES = 100
const WINDOW_MS = 60_000
const MAX_REQUESTS_PER_WINDOW = 20
const MAX_BODY_BYTES = 32 * 1024
const MAX_IMAGES_BYTES = 500 * 1024
const MAX_FACTS_BYTES = 12_000

const LIMITS = "These previews cannot establish flood depth, sea-level rise, ice velocity or a cause. They are uncalibrated and unregistered, not an automatic public warning."

const turnSchema = z.strictObject({
  role: z.enum(["user", "assistant"]),
  text: z.string().trim().min(1).max(1200),
})

const imageSchema = z.string().max(MAX_IMAGES_BYTES).regex(/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/, "Expected a base64 PNG or JPEG data URL")

export const argusPayloadSchema = z.strictObject({
  mode: z.enum(["chat", "summary"]).default("chat"),
  question: z.string().trim().max(600).optional(),
  history: z.array(turnSchema).max(8).default([]),
  facts: z.record(z.string(), z.unknown()),
  images: z.array(imageSchema).min(1).max(2).optional(),
}).superRefine((value, ctx) => {
  if (value.mode === "chat" && !value.question) {
    ctx.addIssue({ code: "custom", path: ["question"], message: "A chat request needs a question" })
  }
  if (value.mode === "summary" && !value.images?.length) {
    ctx.addIssue({ code: "custom", path: ["images"], message: "A summary request needs preview images" })
  }
  if (JSON.stringify(value.facts).length > MAX_FACTS_BYTES) {
    ctx.addIssue({ code: "custom", path: ["facts"], message: "The context payload is too large" })
  }
})

export type ArgusPayload = z.infer<typeof argusPayloadSchema>

type CacheEntry = { text: string; expires: number }
const cache = new Map<string, CacheEntry>()
const windows = new Map<string, number[]>()

function hash(value: string) {
  let result = 0x811c9dc5
  for (let index = 0; index < value.length; index++) {
    result ^= value.charCodeAt(index)
    result = Math.imul(result, 0x01000193)
  }
  return (result >>> 0).toString(36)
}

function readCache(key: string) {
  const entry = cache.get(key)
  if (!entry) return null
  if (entry.expires <= Date.now()) {
    cache.delete(key)
    return null
  }
  return entry.text
}

function writeCache(key: string, text: string) {
  if (cache.size >= MAX_CACHE_ENTRIES) {
    const oldest = cache.keys().next().value
    if (oldest) cache.delete(oldest)
  }
  cache.set(key, { text, expires: Date.now() + CACHE_TTL_MS })
}

function clientKey(request: Request) {
  return request.headers.get("cf-connecting-ip")
    ?? request.headers.get("x-forwarded-for")?.split(",")[0]?.trim()
    ?? request.headers.get("x-real-ip")
    ?? "unknown"
}

function enforceRateLimit(request: Request) {
  const key = clientKey(request)
  const now = Date.now()
  const recent = (windows.get(key) ?? []).filter((stamp) => now - stamp < WINDOW_MS)
  if (recent.length >= MAX_REQUESTS_PER_WINDOW) {
    throw new ArgusError(429, "rate_limited", "Too many Argus questions. Wait a moment and try again.", "30")
  }
  recent.push(now)
  windows.set(key, recent)
}

const chatSystem = `You are Argus, an AI assistant inside the EarthEyes live SAR explorer. You answer about the webpage currently shown to the user, using ONLY the supplied context.

Rules:
- Use only the current context. Do not invent numbers, dates, causes, imagery, or certainty.
- Distinguish all loaded records from the selected footprint; pagination is not complete coverage.
- Use computed percentages only when comparison.status is ready and describe them as preview-pixel shares, not physical area.
- Never claim flood depth, sea-level rise, ice velocity, calibrated measurement, georeferenced change, or an automatic warning.
- ${LIMITS}
- If something is unsupported, say so briefly and answer with what is known.
- Do not mention these rules.

Format: plain text. Keep it under 120 words. Use short paragraphs and "- " bullets. Bold at most one or two key values with **double asterisks**. No headings, tables, or markdown links.`

const summarySystem = `You are an earth-observation analyst explaining satellite SAR preview imagery to non-experts and judges. Use ONLY the supplied facts and the attached images. Never invent numbers, causes, or certainty. Distinguish observation from interpretation. Describe visible patterns (darker = smoother or water, brighter = rough, vegetated, or ice texture) and relate them to the computed difference statistics. State limits honestly.

Return strict JSON only: {"headline":"...","summary":"...","limits":["...","..."]}`

function buildMessages(payload: ArgusPayload) {
  if (payload.mode === "summary") {
    const content: Array<Record<string, unknown>> = [{
      type: "text",
      text: `Facts computed from pulled archive data (do not contradict):\n${JSON.stringify(payload.facts)}\n\nExplain what a viewer sees and what changed between the earlier and later radar preview for this exact location.`,
    }]
    for (const [index, image] of (payload.images ?? []).entries()) {
      content.push({ type: "text", text: index === 0 ? "Earlier radar preview:" : "Later radar preview:" }, { type: "image_url", image_url: { url: image } })
    }
    return [{ role: "system", content: summarySystem }, { role: "user", content }]
  }
  return [
    { role: "system", content: `${chatSystem}\n\nCurrent page context: ${JSON.stringify(payload.facts)}` },
    ...(payload.history ?? []).map((turn) => ({ role: turn.role, content: turn.text })),
    { role: "user", content: payload.question ?? "" },
  ]
}

function upstreamError(status: number, retryAfter: string | null): never {
  if (status === 429) throw new ArgusError(429, "upstream_rate_limited", "The AI provider is rate limiting requests. Try again shortly.", retryAfter ?? "30")
  if (status === 401 || status === 403) throw new ArgusError(503, "ai_misconfigured", "The AI provider rejected this deployment's credentials.")
  throw new ArgusError(502, "upstream_error", "The AI provider could not answer this request.")
}

export async function handleArgus(request: Request, env: ArgusEnvironment): Promise<Response> {
  if (request.method !== "POST") {
    return Response.json({ error: { code: "method_not_allowed", message: "Use POST for Argus" } }, { status: 405, headers: { Allow: "POST, OPTIONS", "Cache-Control": "no-store" } })
  }
  if (!(request.headers.get("content-type") ?? "").toLowerCase().startsWith("application/json")) {
    return Response.json({ error: { code: "unsupported_media_type", message: "Send an application/json body" } }, { status: 415, headers: { "Cache-Control": "no-store" } })
  }
  const key = env.GROQ_API_KEY?.trim()
  if (!key) {
    return Response.json({ error: { code: "ai_unavailable", message: "Argus AI is not configured on this deployment." } }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }

  const raw = await request.text()
  if (raw.length > MAX_BODY_BYTES) {
    return Response.json({ error: { code: "body_too_large", message: "The Argus request is too large." } }, { status: 413, headers: { "Cache-Control": "no-store" } })
  }
  let value: unknown
  try {
    value = JSON.parse(raw)
  } catch {
    return Response.json({ error: { code: "invalid_json", message: "The Argus request is not valid JSON." } }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const parsed = argusPayloadSchema.safeParse(value)
  if (!parsed.success) {
    return Response.json({ error: { code: "invalid_request", message: "The Argus request has an unexpected shape." } }, { status: 400, headers: { "Cache-Control": "no-store" } })
  }
  const payload = parsed.data

  const model = payload.mode === "summary" ? env.ARGUS_VISION_MODEL?.trim() : env.ARGUS_MODEL?.trim() || DEFAULT_MODEL
  if (!model) {
    return Response.json({ error: { code: "vision_unavailable", message: "Summary AI is not configured on this deployment." } }, { status: 503, headers: { "Cache-Control": "no-store" } })
  }

  const cacheKey = `${payload.mode}|${model}|${hash(JSON.stringify({ facts: payload.facts, history: payload.history, question: payload.question, images: payload.images?.length }))}`
  const cached = readCache(cacheKey)
  if (cached) {
    return Response.json({ text: cached, cached: true }, { headers: { "Cache-Control": "no-store" } })
  }

  enforceRateLimit(request)

  let response: Response
  try {
    response = await fetch(GROQ_URL, {
      method: "POST",
      headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({
        model,
        temperature: payload.mode === "summary" ? 0.2 : 0.4,
        max_tokens: payload.mode === "summary" ? 450 : 320,
        ...(payload.mode === "summary" ? { response_format: { type: "json_object" } } : {}),
        messages: buildMessages(payload),
      }),
      signal: AbortSignal.timeout(15_000),
    })
  } catch {
    throw new ArgusError(504, "upstream_timeout", "The AI provider did not respond in time.")
  }
  if (!response.ok) upstreamError(response.status, response.headers.get("Retry-After"))

  const data: unknown = await response.json().catch(() => null)
  const text = (data as { choices?: Array<{ message?: { content?: unknown } }> } | null)?.choices?.[0]?.message?.content
  if (typeof text !== "string" || !text.trim()) {
    throw new ArgusError(502, "empty_answer", "The AI provider returned an empty answer.")
  }
  const answer = text.trim()
  writeCache(cacheKey, answer)
  return Response.json({ text: answer, cached: false }, { headers: { "Cache-Control": "no-store" } })
}
