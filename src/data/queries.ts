import { useQuery } from "@tanstack/react-query"
import type { ModuleId } from "../domain/models"
import { repository } from "./repository"

export const queryKeys = {
  places: (query: string) => ["places", query] as const,
  place: (id: string) => ["place", id] as const,
  observations: (placeId: string, moduleId: ModuleId) => ["observations", placeId, moduleId] as const,
  layers: (moduleId: ModuleId) => ["layers", moduleId] as const,
  measurements: (placeId: string, moduleId: ModuleId) => ["measurements", placeId, moduleId] as const,
  events: (placeId: string) => ["events", placeId] as const,
  alerts: ["alerts"] as const,
  sources: ["data-sources"] as const,
  source: (id: string) => ["data-source", id] as const,
}

export function usePlaces(query = "") {
  return useQuery({ queryKey: queryKeys.places(query), queryFn: () => repository.searchPlaces(query) })
}

export function usePlace(id: string) {
  return useQuery({ queryKey: queryKeys.place(id), queryFn: () => repository.getPlace(id), enabled: Boolean(id) })
}

export function useObservations(placeId: string, moduleId: ModuleId) {
  return useQuery({
    queryKey: queryKeys.observations(placeId, moduleId),
    queryFn: () => repository.getObservations({ placeId, moduleId }),
    enabled: Boolean(placeId),
  })
}

export function useLayers(moduleId: ModuleId) {
  return useQuery({ queryKey: queryKeys.layers(moduleId), queryFn: () => repository.getLayers(moduleId) })
}

export function useMeasurements(placeId: string, moduleId: ModuleId) {
  return useQuery({
    queryKey: queryKeys.measurements(placeId, moduleId),
    queryFn: () => repository.getMeasurements({ placeId, moduleId }),
    enabled: Boolean(placeId),
  })
}

export function useEvents(placeId: string) {
  return useQuery({ queryKey: queryKeys.events(placeId), queryFn: () => repository.getEvents(placeId), enabled: Boolean(placeId) })
}

export function useAlerts() {
  return useQuery({
    queryKey: queryKeys.alerts,
    queryFn: () => repository.getAlerts(),
    refetchInterval: 60_000,
    refetchOnWindowFocus: true,
  })
}

export function useDataSources() {
  return useQuery({ queryKey: queryKeys.sources, queryFn: () => repository.getDataSources() })
}

export function useDataSource(id: string) {
  return useQuery({ queryKey: queryKeys.source(id), queryFn: () => repository.getDataSource(id), enabled: Boolean(id) })
}
