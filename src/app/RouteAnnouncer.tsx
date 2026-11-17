import { useEffect } from "react"
import { useLocation } from "react-router-dom"

const routes: Array<[RegExp, string, string]> = [
  [/^\/$/, "EarthEyes | A field atlas for a changing planet", "A map-first field atlas for comparing radar observations, published calibrated-source evidence, and their limits."],
  [/^\/explore/, "EarthEyes explorer", "Inspect live radar archive records, browse previews and the published Kuakata analysis."],
  [/^\/stories/, "EarthEyes guided investigation", "A guided Earth-observation investigation with evidence still needed and conclusions it cannot support."],
  [/^\/methodology/, "EarthEyes methodology", "How EarthEyes separates live preview comparison from calibrated-source analysis, and what neither can establish."],
  [/^\/data-sources/, "EarthEyes data sources", "Mission, archive, derived-processing and independent-context sources used across EarthEyes."],
  [/^\/groundline/, "GroundLine warning case study", "A demonstration of analyst review and responsible authority approval before a public warning."],
  [/^\/about/, "About EarthEyes", "The purpose, current state and scientific boundaries of the EarthEyes research prototype."],
]

function safeDecode(value: string) {
  try {
    return decodeURIComponent(value)
  } catch {
    return value
  }
}

export function RouteAnnouncer() {
  const location = useLocation()
  const route = routes.find(([pattern]) => pattern.test(location.pathname))
  const routeName = route?.[1] ?? "EarthEyes page"
  const description = route?.[2] ?? "EarthEyes field atlas."
  const detail = safeDecode(location.pathname.split("/").filter(Boolean).at(-1) ?? "")
    .replace(/-/g, " ")
  const hasDetail = detail && !["explore", "methodology", "data sources", "groundline", "about"].includes(detail)
  const documentTitle = location.pathname === "/" ? routeName : hasDetail ? `${routeName}: ${detail} | EarthEyes` : `${routeName} | EarthEyes`
  const announcement = hasDetail ? `${routeName}: ${detail}` : routeName

  useEffect(() => {
    document.title = documentTitle
    document.querySelector('meta[name="description"]')?.setAttribute("content", description)
    const frame = requestAnimationFrame(() => {
      const target = location.hash ? document.getElementById(safeDecode(location.hash.slice(1))) : null
      if (target) target.scrollIntoView({ block: "start" })
      else if (!location.pathname.startsWith("/explore")) window.scrollTo({ top: 0, behavior: "auto" })
      document.getElementById("route-content")?.focus({ preventScroll: true })
    })
    return () => cancelAnimationFrame(frame)
  }, [description, documentTitle, location.hash, location.pathname])

  return <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
}
