import { useEffect } from "react"
import { useLocation } from "react-router-dom"

const routeNames: Array<[RegExp, string]> = [
  [/^\/$/, "EarthEyes field atlas"],
  [/^\/explore/, "EarthEyes explorer"],
  [/^\/stories/, "EarthEyes guided investigation"],
  [/^\/methodology/, "EarthEyes methodology"],
  [/^\/data-sources/, "EarthEyes data sources"],
  [/^\/groundline/, "GroundLine warning case study"],
  [/^\/about/, "About EarthEyes"],
]

export function RouteAnnouncer() {
  const location = useLocation()
  const routeName = routeNames.find(([pattern]) => pattern.test(location.pathname))?.[1] ?? "EarthEyes page"
  const routeDetail = decodeURIComponent(location.pathname.split("/").filter(Boolean).at(-1) ?? "")
    .replace(/-/g, " ")
  const announcement = routeDetail && !["explore", "methodology", "data sources", "groundline", "about"].includes(routeDetail)
    ? `${routeName}: ${routeDetail}`
    : routeName

  useEffect(() => {
    document.title = `${routeName} | EarthEyes`
    const frame = requestAnimationFrame(() => {
      document.getElementById("route-content")?.focus({ preventScroll: true })
      if (!location.pathname.startsWith("/explore")) window.scrollTo({ top: 0, behavior: "auto" })
    })
    return () => cancelAnimationFrame(frame)
  }, [location.pathname, routeName])

  return <div className="sr-only" aria-live="polite" aria-atomic="true">{announcement}</div>
}
