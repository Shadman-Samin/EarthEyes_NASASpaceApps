import { useEffect, useState } from "react"
import type { Observation } from "../../domain/models"
import { browseDifference, describeBrowseDifference, type DifferenceResult } from "./difference"

export type BrowseComparison = {
  status: "idle" | "loading" | "ready" | "error" | "unavailable"
  result: DifferenceResult | null
  summary: { headline: string; detail: string; changedPct: number; brighterPct: number; darkerPct: number } | null
  earlierUrl?: string
  laterUrl?: string
  error?: string
}

function loadImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("image load failed"))
    image.src = src
  })
}

function pixelsOf(image: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("no canvas")
  ctx.drawImage(image, 0, 0, width, height)
  return ctx.getImageData(0, 0, width, height)
}

const cache = new Map<string, DifferenceResult>()

function toSummary(res: DifferenceResult) {
  const desc = describeBrowseDifference(res)
  return { ...desc, changedPct: Math.round(res.changedShare * 100), brighterPct: Math.round(res.brighterShare * 100), darkerPct: Math.round(res.darkerShare * 100) }
}

export function useBrowseComparison(left?: Observation, right?: Observation): BrowseComparison {
  const key = left && right ? `${left.id}|${right.id}|${left.imageUrl}|${right.imageUrl}` : ""
  const [asyncState, setAsyncState] = useState<{ key: string; state: BrowseComparison } | null>(null)

  let base: BrowseComparison
  if (!left || !right) {
    base = { status: "idle", result: null, summary: null }
  } else if (!left.imageUrl || !right.imageUrl) {
    base = { status: "unavailable", result: null, summary: null, earlierUrl: left.imageUrl ?? undefined, laterUrl: right.imageUrl ?? undefined, error: "Preview images unavailable for this pair." }
  } else {
    const cached = cache.get(key)
    if (cached) {
      base = { status: "ready", result: cached, summary: toSummary(cached), earlierUrl: left.imageUrl, laterUrl: right.imageUrl }
    } else if (asyncState?.key === key) {
      base = asyncState.state
    } else {
      base = { status: "loading", result: null, summary: null, earlierUrl: left.imageUrl, laterUrl: right.imageUrl }
    }
  }

  useEffect(() => {
    if (!left?.imageUrl || !right?.imageUrl) return
    if (cache.get(key)) return
    let cancelled = false
    Promise.all([loadImage(left.imageUrl), loadImage(right.imageUrl)])
      .then(([a, b]) => {
        if (cancelled) return
        const w = Math.min(a.naturalWidth, b.naturalWidth, 1600)
        const h = Math.min(a.naturalHeight, b.naturalHeight, 1600)
        if (!w || !h) throw new Error("empty")
        const res = browseDifference(pixelsOf(a, w, h), pixelsOf(b, w, h))
        cache.set(key, res)
        setAsyncState({ key, state: { status: "ready", result: res, summary: toSummary(res), earlierUrl: left.imageUrl ?? undefined, laterUrl: right.imageUrl ?? undefined } })
      })
      .catch(() => {
        if (!cancelled) setAsyncState({ key, state: { status: "error", result: null, summary: null, earlierUrl: left.imageUrl ?? undefined, laterUrl: right.imageUrl ?? undefined, error: "Could not analyze the pulled preview images." } })
      })
    return () => { cancelled = true }
  }, [key, left, right])

  return base
}
