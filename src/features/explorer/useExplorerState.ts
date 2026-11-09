import { useCallback } from "react"
import { useNavigate, useSearchParams } from "react-router-dom"
import {
  comparisonModeSchema,
  moduleIdSchema,
  type ComparisonMode,
  type LayerDefinition,
  type ModuleId,
  type Observation,
  type Place,
} from "../../domain/models"

const unique = (values: string[]) => [...new Set(values)]

export function useExplorerState({
  place,
  observations,
  layers,
}: {
  place: Place
  observations: Observation[]
  layers: LayerDefinition[]
}) {
  const navigate = useNavigate()
  const [searchParams, setSearchParams] = useSearchParams()

  const requestedModule = moduleIdSchema.safeParse(searchParams.get("module"))
  const moduleId: ModuleId =
    requestedModule.success && place.moduleIds.includes(requestedModule.data)
      ? requestedModule.data
      : place.moduleIds[0]

  const requestedMode = comparisonModeSchema.safeParse(searchParams.get("mode"))
  const mode: ComparisonMode = requestedMode.success ? requestedMode.data : "swipe"
  const view: "map" | "compare" = searchParams.get("view") === "compare" ? "compare" : "map"

  const observationIds = new Set(observations.map((observation) => observation.id))
  const requestedLeft = searchParams.get("left")
  const requestedRight = searchParams.get("right")
  const leftId = requestedLeft && observationIds.has(requestedLeft)
    ? requestedLeft
    : observations.at(-2)?.id ?? observations[0]?.id ?? ""
  const rightId = requestedRight && observationIds.has(requestedRight)
    ? requestedRight
    : observations.at(-1)?.id ?? observations[0]?.id ?? ""

  const availableLayerIds = new Set(layers.map((layer) => layer.id))
  const requestedLayers = searchParams.get("layers")?.split(",").filter(Boolean) ?? []
  const defaultLayers = layers.filter((layer) => layer.defaultEnabled).map((layer) => layer.id)
  const activeLayers = unique(
    (requestedLayers.length ? requestedLayers : defaultLayers).filter((id) => availableLayerIds.has(id)),
  )

  const patchParams = useCallback(
    (patch: Record<string, string | null>, replace = false) => {
      setSearchParams(
        (current) => {
          const next = new URLSearchParams(current)
          Object.entries(patch).forEach(([key, value]) => {
            if (value === null || value === "") next.delete(key)
            else next.set(key, value)
          })
          return next
        },
        { replace },
      )
    },
    [setSearchParams],
  )

  const setModule = useCallback(
    (nextModule: ModuleId) => {
      const moduleLayers = layers.filter((layer) => layer.moduleId === nextModule && layer.defaultEnabled)
      patchParams({
        module: nextModule,
        left: null,
        right: null,
        layers: moduleLayers.map((layer) => layer.id).join(",") || null,
      })
    },
    [layers, patchParams],
  )

  const setPlace = useCallback(
    (nextPlace: Place) => {
      const nextModule = nextPlace.moduleIds.includes(moduleId) ? moduleId : nextPlace.moduleIds[0]
      navigate(`/explore/${nextPlace.id}?module=${nextModule}&mode=${mode}&view=${view}`)
    },
    [mode, moduleId, navigate, view],
  )

  const setMode = useCallback((nextMode: ComparisonMode) => patchParams({ mode: nextMode }), [patchParams])
  const setView = useCallback((nextView: "map" | "compare") => patchParams({ view: nextView }), [patchParams])
  const setPair = useCallback(
    (nextLeftId: string, nextRightId: string) => patchParams({ left: nextLeftId, right: nextRightId }),
    [patchParams],
  )
  const selectObservation = useCallback((id: string, replace = false) => patchParams({ right: id }, replace), [patchParams])
  const toggleLayer = useCallback(
    (id: string) => {
      const next = activeLayers.includes(id)
        ? activeLayers.filter((layerId) => layerId !== id)
        : [...activeLayers, id]
      patchParams({ layers: next.join(",") || "none" })
    },
    [activeLayers, patchParams],
  )

  return {
    moduleId,
    mode,
    view,
    leftId,
    rightId,
    activeLayers: activeLayers.filter((id) => id !== "none"),
    setModule,
    setPlace,
    setMode,
    setView,
    setPair,
    selectObservation,
    toggleLayer,
  }
}
