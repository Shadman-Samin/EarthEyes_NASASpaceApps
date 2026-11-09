import { http, HttpResponse } from "msw"
import { moduleList } from "../domain/module-registry"
import { alerts, dataSources, events, layers, measurements, observations, places } from "./fixtures"

const search = (query: string) => {
  const needle = query.trim().toLowerCase()
  if (!needle) return places
  return places.filter((place) => [place.name, place.country, place.kind, place.description].join(" ").toLowerCase().includes(needle))
}

export const handlers = [
  http.get("*/api/places/search", ({ request }) => HttpResponse.json(search(new URL(request.url).searchParams.get("q") ?? ""))),
  http.get("*/api/places/:id", ({ params }) => HttpResponse.json(places.find((place) => place.id === params.id) ?? null)),
  http.get("*/api/modules", () => HttpResponse.json(moduleList)),
  http.get("*/api/observations", ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json(observations.filter((observation) => observation.placeId === url.searchParams.get("placeId") && observation.moduleId === url.searchParams.get("module")))
  }),
  http.get("*/api/observations/:id", ({ params }) => HttpResponse.json(observations.find((observation) => observation.id === params.id) ?? null)),
  http.get("*/api/comparisons", ({ request }) => {
    const url = new URL(request.url)
    const left = observations.find((observation) => observation.id === url.searchParams.get("left"))
    const right = observations.find((observation) => observation.id === url.searchParams.get("right"))
    return HttpResponse.json({ left, right })
  }),
  http.get("*/api/timelines", ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json(observations.filter((observation) => observation.placeId === url.searchParams.get("placeId")))
  }),
  http.get("*/api/layers", ({ request }) => HttpResponse.json(layers.filter((layer) => layer.moduleId === new URL(request.url).searchParams.get("module")))),
  http.get("*/api/metrics", ({ request }) => {
    const url = new URL(request.url)
    return HttpResponse.json(measurements.filter((measurement) => measurement.placeId === url.searchParams.get("placeId") && measurement.moduleId === url.searchParams.get("module")))
  }),
  http.get("*/api/events", ({ request }) => HttpResponse.json(events.filter((event) => event.placeId === new URL(request.url).searchParams.get("placeId")))),
  http.get("*/api/alerts", () => HttpResponse.json(alerts)),
  http.get("*/api/data-sources", () => HttpResponse.json(dataSources)),
  http.get("*/api/data-sources/:id", ({ params }) => HttpResponse.json(dataSources.find((source) => source.id === params.id) ?? null)),
  http.post("*/api/subscriptions", async ({ request }) => {
    const body = await request.json()
    return HttpResponse.json({ id: "demo-subscription", state: "otp-required", received: body }, { status: 202 })
  }),
]
