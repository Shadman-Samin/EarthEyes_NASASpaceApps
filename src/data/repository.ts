import {
  alertsSchema,
  dataSourceSchema,
  dataSourcesSchema,
  eventsSchema,
  layersSchema,
  measurementsSchema,
  observationsSchema,
  placeSchema,
  placesSchema,
  type Alert,
  type DataSource,
  type EventContext,
  type LayerDefinition,
  type Measurement,
  type ModuleId,
  type Observation,
  type Place,
} from "../domain/models"
import {
  alerts,
  dataSources,
  events,
  layers,
  measurements,
  observations,
  places,
} from "../mocks/fixtures"

export type ObservationQuery = { placeId: string; moduleId: ModuleId }

export interface EarthEyesRepository {
  searchPlaces(query: string): Promise<Place[]>
  getPlace(id: string): Promise<Place | null>
  getObservations(query: ObservationQuery): Promise<Observation[]>
  getLayers(moduleId: ModuleId): Promise<LayerDefinition[]>
  getMeasurements(query: ObservationQuery): Promise<Measurement[]>
  getEvents(placeId: string): Promise<EventContext[]>
  getAlerts(): Promise<Alert[]>
  getDataSources(): Promise<DataSource[]>
  getDataSource(id: string): Promise<DataSource | null>
}

const pause = async () => {
  if (import.meta.env.MODE === "test") return
  await new Promise((resolve) => window.setTimeout(resolve, 90))
}

export class FixtureEarthEyesRepository implements EarthEyesRepository {
  async searchPlaces(query: string) {
    await pause()
    const needle = query.trim().toLowerCase()
    if (!needle) return placesSchema.parse(places)
    return placesSchema.parse(
      places.filter((place) =>
        [place.name, place.country, place.kind, place.description]
          .join(" ")
          .toLowerCase()
          .includes(needle),
      ),
    )
  }

  async getPlace(id: string) {
    await pause()
    const place = places.find((candidate) => candidate.id === id)
    return place ? placeSchema.parse(place) : null
  }

  async getObservations(query: ObservationQuery) {
    await pause()
    return observationsSchema.parse(
      observations
        .filter(
          (observation) =>
            observation.placeId === query.placeId &&
            observation.moduleId === query.moduleId,
        )
        .sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt)),
    )
  }

  async getLayers(moduleId: ModuleId) {
    await pause()
    return layersSchema.parse(layers.filter((layer) => layer.moduleId === moduleId))
  }

  async getMeasurements(query: ObservationQuery) {
    await pause()
    return measurementsSchema.parse(
      measurements.filter(
        (measurement) =>
          measurement.placeId === query.placeId &&
          measurement.moduleId === query.moduleId,
      ),
    )
  }

  async getEvents(placeId: string) {
    await pause()
    return eventsSchema.parse(events.filter((event) => event.placeId === placeId))
  }

  async getAlerts() {
    await pause()
    return alertsSchema.parse(alerts)
  }

  async getDataSources() {
    await pause()
    return dataSourcesSchema.parse(dataSources)
  }

  async getDataSource(id: string) {
    await pause()
    const source = dataSources.find((candidate) => candidate.id === id)
    return source ? dataSourceSchema.parse(source) : null
  }
}

export class HttpEarthEyesRepository implements EarthEyesRepository {
  private readonly baseUrl: string

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/+$/, "")
  }

  private async request(path: string) {
    const response = await fetch(`${this.baseUrl}${path}`)
    if (!response.ok) throw new Error(`EarthEyes API request failed (${response.status})`)
    return response.json() as Promise<unknown>
  }

  async searchPlaces(query: string) {
    return placesSchema.parse(await this.request(`/places/search?q=${encodeURIComponent(query)}`))
  }

  async getPlace(id: string) {
    const value = await this.request(`/places/${encodeURIComponent(id)}`)
    return value === null ? null : placeSchema.parse(value)
  }

  async getObservations(query: ObservationQuery) {
    return observationsSchema.parse(
      await this.request(`/observations?placeId=${encodeURIComponent(query.placeId)}&module=${query.moduleId}`),
    ).sort((a, b) => a.acquiredAt.localeCompare(b.acquiredAt))
  }

  async getLayers(moduleId: ModuleId) {
    return layersSchema.parse(await this.request(`/layers?module=${moduleId}`))
  }

  async getMeasurements(query: ObservationQuery) {
    return measurementsSchema.parse(
      await this.request(`/metrics?placeId=${encodeURIComponent(query.placeId)}&module=${query.moduleId}`),
    )
  }

  async getEvents(placeId: string) {
    return eventsSchema.parse(await this.request(`/events?placeId=${encodeURIComponent(placeId)}`))
  }

  async getAlerts() {
    return alertsSchema.parse(await this.request("/alerts"))
  }

  async getDataSources() {
    return dataSourcesSchema.parse(await this.request("/data-sources"))
  }

  async getDataSource(id: string) {
    const value = await this.request(`/data-sources/${encodeURIComponent(id)}`)
    return value === null ? null : dataSourceSchema.parse(value)
  }
}

const apiBaseUrl = import.meta.env.VITE_API_BASE_URL as string | undefined
const configuredDataOrigin = import.meta.env.VITE_DATA_ORIGIN as string | undefined
const fixtureApiBaseUrl = `${import.meta.env.BASE_URL.replace(/\/$/, "")}/api`

let dataOrigin: "fixture" | "live" = apiBaseUrl && configuredDataOrigin === "live" ? "live" : "fixture"
let activeRepository: EarthEyesRepository = import.meta.env.MODE === "test"
  ? new HttpEarthEyesRepository("http://localhost/api")
  : apiBaseUrl
    ? new HttpEarthEyesRepository(apiBaseUrl)
    : new HttpEarthEyesRepository(fixtureApiBaseUrl)

export const getDataOrigin = () => dataOrigin

export function activateFixtureRepository() {
  activeRepository = new FixtureEarthEyesRepository()
  dataOrigin = "fixture"
}

export const repository: EarthEyesRepository = {
  searchPlaces: (query) => activeRepository.searchPlaces(query),
  getPlace: (id) => activeRepository.getPlace(id),
  getObservations: (query) => activeRepository.getObservations(query),
  getLayers: (moduleId) => activeRepository.getLayers(moduleId),
  getMeasurements: (query) => activeRepository.getMeasurements(query),
  getEvents: (placeId) => activeRepository.getEvents(placeId),
  getAlerts: () => activeRepository.getAlerts(),
  getDataSources: () => activeRepository.getDataSources(),
  getDataSource: (id) => activeRepository.getDataSource(id),
}
