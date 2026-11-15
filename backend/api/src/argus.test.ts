import { afterEach, describe, expect, it, vi } from "vitest"
import { handleArgus } from "./argus"
import worker from "./index"

const key = "test-key"
const baseFacts = { place: "Kuakata", comparison: { status: "ready" } }

function post(body: unknown, headers: Record<string, string> = {}) {
  return new Request("https://api.test/api/argus", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: typeof body === "string" ? body : JSON.stringify(body),
  })
}

function upstream(text = "Answer from the model") {
  const fetch = vi.fn(async () => Response.json({ choices: [{ message: { content: text } }] }))
  vi.stubGlobal("fetch", fetch)
  return fetch
}

afterEach(() => { vi.unstubAllGlobals() })

describe("Argus proxy boundary", () => {
  it("refuses to run without a server-side key", async () => {
    const response = await handleArgus(post({ question: "What changed?", facts: baseFacts }), {})
    expect(response.status).toBe(503)
    expect((await response.json() as { error: { code: string } }).error.code).toBe("ai_unavailable")
  })

  it("only accepts JSON POST bodies", async () => {
    expect((await handleArgus(new Request("https://api.test/api/argus"), { GROQ_API_KEY: key })).status).toBe(405)
    expect((await handleArgus(new Request("https://api.test/api/argus", { method: "POST" }), { GROQ_API_KEY: key })).status).toBe(415)
    expect((await handleArgus(post("{not json"), { GROQ_API_KEY: key })).status).toBe(400)
    expect((await handleArgus(post({ question: "", facts: baseFacts }), { GROQ_API_KEY: key })).status).toBe(400)
    expect((await handleArgus(post({ question: "Hi", facts: baseFacts, extra: true }), { GROQ_API_KEY: key })).status).toBe(400)
  })

  it("rejects oversized context and invalid images", async () => {
    const oversized = { blob: "x".repeat(13_000) }
    expect((await handleArgus(post({ question: "Hi", facts: oversized }), { GROQ_API_KEY: key })).status).toBe(400)
    expect((await handleArgus(post({ mode: "summary", facts: baseFacts, images: ["javascript:alert(1)"] }), { GROQ_API_KEY: key })).status).toBe(400)
  })

  it("forwards bounded chat context and returns the answer", async () => {
    const fetch = upstream("12% of preview pixels changed.")
    const response = await handleArgus(post({
      question: "What changed?",
      history: [{ role: "user", text: "Earlier question" }, { role: "assistant", text: "Earlier answer" }],
      facts: baseFacts,
    }), { GROQ_API_KEY: key, ARGUS_MODEL: "qwen/qwen3.8-27b" })

    expect(response.status).toBe(200)
    expect(await response.json()).toMatchObject({ text: "12% of preview pixels changed.", cached: false })
    const [url, init] = fetch.mock.calls[0] as unknown as [string, RequestInit]
    expect(url).toBe("https://api.groq.com/openai/v1/chat/completions")
    expect(init.headers).toMatchObject({ Authorization: `Bearer ${key}` })
    const payload = JSON.parse(String(init.body))
    expect(payload.model).toBe("qwen/qwen3.8-27b")
    expect(payload.messages[0].content).toContain("Kuakata")
    expect(payload.messages.at(-1).content).toBe("What changed?")
  })

  it("serves repeat questions from cache without spending quota", async () => {
    const fetch = upstream("Cached answer")
    const body = { question: "Repeat this exact question", facts: { place: "Cache test" } }
    expect((await handleArgus(post(body), { GROQ_API_KEY: key })).status).toBe(200)
    expect((await handleArgus(post(body), { GROQ_API_KEY: key })).status).toBe(200)
    expect(fetch).toHaveBeenCalledTimes(1)
  })

  it("requires a vision model for summary requests", async () => {
    upstream("{\"headline\":\"h\",\"summary\":\"s\",\"limits\":[]}")
    const body = { mode: "summary", facts: baseFacts, images: ["data:image/jpeg;base64,AAAA"] }
    expect((await handleArgus(post(body), { GROQ_API_KEY: key })).status).toBe(503)
    expect((await handleArgus(post(body), { GROQ_API_KEY: key, ARGUS_VISION_MODEL: "vision-test" })).status).toBe(200)
  })

  it("falls back to process.env when the host passes no bindings", async () => {
    const fetch = upstream("Answer from process env")
    const previous = process.env.GROQ_API_KEY
    process.env.GROQ_API_KEY = key
    try {
      const response = await worker.fetch(post({ question: "Host env question", facts: { place: "Env" } }), {})
      expect(response.status).toBe(200)
      expect(fetch).toHaveBeenCalledTimes(1)
    } finally {
      if (previous === undefined) delete process.env.GROQ_API_KEY
      else process.env.GROQ_API_KEY = previous
    }
  })

  it("passes upstream rate limits through with a retry hint", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("slow down", { status: 429, headers: { "Retry-After": "12" } })))
    const response = await worker.fetch(post({ question: "Rate limit me", facts: baseFacts }), { GROQ_API_KEY: key })
    expect(response.status).toBe(429)
    expect(response.headers.get("Retry-After")).toBe("12")
  })

  it("reports credential rejection as a configuration problem", async () => {
    vi.stubGlobal("fetch", vi.fn(async () => new Response("nope", { status: 401 })))
    const response = await worker.fetch(post({ question: "Bad key", facts: baseFacts }), { GROQ_API_KEY: key })
    expect(response.status).toBe(503)
    expect((await response.json() as { error: { code: string } }).error.code).toBe("ai_misconfigured")
  })

  it("throttles per client after the per-minute budget", async () => {
    const fetch = upstream()
    const headers = { "x-forwarded-for": "203.0.113.9" }
    let lastStatus = 0
    for (let index = 0; index < 21; index++) {
      const response = await worker.fetch(post({ question: `Question ${index}`, facts: { index } }, headers), { GROQ_API_KEY: key })
      lastStatus = response.status
    }
    expect(lastStatus).toBe(429)
    expect(fetch).toHaveBeenCalledTimes(20)
  })
})
