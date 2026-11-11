import * as Dialog from "@radix-ui/react-dialog"
import { useCallback, useEffect, useRef, useState, type PointerEvent as ReactPointerEvent } from "react"
import { Link, useLocation } from "react-router-dom"
import { moduleIdSchema, type ModuleId } from "../../domain/models"
import { moduleRegistry } from "../../domain/module-registry"
import { useDataSources, useLayers, useMeasurements, useObservations, usePlace } from "../../data/queries"
import { getDataOrigin } from "../../data/repository"
import { Button, Icon } from "../../shared/ui"
import { useMediaQuery } from "../../shared/useMediaQuery"

type PanelState = "floating" | "docked-left" | "docked-right" | "expanded"
type Message = { role: "argus" | "user"; text: string; sourceId?: string }
type Position = { x: number; y: number }
type Size = { width: number; height: number }

const actions = [
  "Explain this layer",
  "Explain this value",
  "Show uncertainty",
  "Show source",
  "Why is this not proof?",
] as const

const readStored = <T,>(key: string, fallback: T): T => {
  try {
    const value = localStorage.getItem(key)
    return value ? JSON.parse(value) as T : fallback
  } catch {
    return fallback
  }
}

const store = (key: string, value: unknown) => {
  try {
    localStorage.setItem(key, JSON.stringify(value))
  } catch {
    // Storage can be unavailable in private or restricted browser contexts.
  }
}

function useArgusContext() {
  const location = useLocation()
  const liveExplorer = location.pathname.startsWith("/explore")
  const match = location.pathname.match(/^\/explore\/([^/]+)/)
  const placeId = match?.[1] ?? (location.pathname === "/explore" ? "kuakata-bangladesh" : "")
  const params = new URLSearchParams(location.search)
  const parsedModule = moduleIdSchema.safeParse(params.get("module"))
  const requestedModule: ModuleId = parsedModule.success ? parsedModule.data : "coastal"
  const placeQuery = usePlace(placeId)
  const moduleId: ModuleId = placeQuery.data?.moduleIds.includes(requestedModule)
    ? requestedModule
    : placeQuery.data?.moduleIds[0] ?? requestedModule
  const measurementsQuery = useMeasurements(liveExplorer ? "" : placeId, moduleId)
  const layersQuery = useLayers(moduleId)
  const observationsQuery = useObservations(liveExplorer ? "" : placeId, moduleId)
  const sourcesQuery = useDataSources()
  const requestedLayers = params.get("layers")?.split(",").filter(Boolean) ?? []
  const availableLayerIds = new Set(layersQuery.data?.map((layer) => layer.id) ?? [])
  const activeLayers = requestedLayers.length
    ? requestedLayers.filter((id) => id !== "none" && availableLayerIds.has(id))
    : layersQuery.data?.filter((layer) => layer.defaultEnabled).map((layer) => layer.id) ?? []
  const availableObservationIds = new Set(observationsQuery.data?.map((observation) => observation.id) ?? [])
  const requestedLeft = params.get("left")
  const requestedRight = params.get("right")
  const resolvedLeft = requestedLeft && availableObservationIds.has(requestedLeft)
    ? requestedLeft
    : observationsQuery.data?.at(-2)?.id ?? observationsQuery.data?.[0]?.id
  const resolvedRight = requestedRight && availableObservationIds.has(requestedRight)
    ? requestedRight
    : observationsQuery.data?.at(-1)?.id ?? observationsQuery.data?.[0]?.id
  const observationIds = [...new Set([resolvedLeft, resolvedRight].filter(Boolean) as string[])]
  return {
    place: params.has("bbox") ? undefined : placeQuery.data,
    dataOrigin: liveExplorer ? "live" : getDataOrigin(),
    moduleId,
    observationIds,
    layers: liveExplorer ? requestedLayers.filter((id) => ["acquisition-footprint", "sar-preview"].includes(id)) : activeLayers,
    measurements: liveExplorer ? [] : measurementsQuery.data ?? [],
    observations: observationsQuery.data?.filter((observation) => observationIds.includes(observation.id)) ?? [],
    sources: sourcesQuery.data ?? [],
  }
}

function ArgusContent({ onClose, onMinimize, panelState, onPanelState, onReset }: {
  onClose: () => void
  onMinimize: () => void
  panelState: PanelState
  onPanelState: (state: PanelState) => void
  onReset: () => void
}) {
  const context = useArgusContext()
  const [messages, setMessages] = useState<Message[]>([
    { role: "argus", text: `I am Argus, a scripted evidence guide. I can explain the current ${context.dataOrigin} context and general limits, but I do not analyse the displayed images or provide operational warning advice.` },
  ])

  const answer = (action: typeof actions[number]) => {
    const measurement = context.measurements.length === 1 ? context.measurements[0] : undefined
    const sourceIds = [...new Set(context.observations.map((observation) => observation.sourceId))]
    const sourceId = sourceIds[0]
    const responses: Record<typeof actions[number], string> = {
      "Explain this layer": context.layers.length
        ? `The active layer IDs are ${context.layers.join(", ")}. In ${moduleRegistry[context.moduleId].title}, each layer should be read according to its observed, derived, modeled, or context label.`
        : `No analytical layer is encoded in the URL yet. Open Controls to select a ${moduleRegistry[context.moduleId].title} layer and its provenance will remain visible.`,
      "Explain this value": measurement
        ? `${measurement.label} is shown as ${measurement.value} ${measurement.unit}. It is ${measurement.classification}, ${measurement.quality}, and covers ${measurement.spatialArea}. Data origin: ${getDataOrigin()}.`
        : context.measurements.length > 1
          ? `No individual value is selected. The evidence drawer contains ${context.measurements.map((item) => item.label).join(", ")}; choose a card and open its provenance rather than treating the first metric as selected.`
          : "No measurement is loaded for this route. Argus will not invent a replacement value.",
      "Show uncertainty": measurement
        ? `${measurement.label}: ${measurement.uncertainty}. Effective dates: ${measurement.effectiveDateRange}. Processing: ${measurement.processingVersion}.`
        : context.measurements.length > 1
          ? `No individual value is selected. Available uncertainty records are: ${context.measurements.map((item) => `${item.label}: ${item.uncertainty}`).join("; ")}.`
          : "No uncertainty record is available for this context. Absence is reported rather than replaced with a sample estimate.",
      "Show source": measurement
        ? `The record cites ${measurement.sourceProducts.join(", ")} and records: ${measurement.citation}. Open the Sources tab for authoritative catalogue links.`
        : sourceIds.length
          ? `The selected observations reference ${sourceIds.join(", ")}. Open the Sources tab for the matching catalogue records and limitations.`
          : context.dataOrigin === "live" ? "Open Evidence > Sources for the selected acquisition's provider records. Argus does not interpret the displayed SAR images." : "Open the data-source catalogue for mission roles and limitations. No route-specific product is currently selected.",
      "Why is this not proof?": moduleRegistry[context.moduleId].cannotProve,
    }
    setMessages((current) => [...current, { role: "user", text: action }, { role: "argus", text: responses[action], sourceId }])
  }

  return (
    <>
      <header className="argus__header" data-drag-handle>
        <span className="argus__mark"><Icon name="chat" size={18} /></span>
        <div><strong>Argus evidence guide</strong><small>Scripted / contextual / cited</small></div>
        <div className="argus__window-actions">
          <button type="button" onClick={onReset} aria-label="Reset Argus position"><Icon name="reset" size={14} /></button>
          <button type="button" onClick={onMinimize} aria-label="Minimize Argus"><Icon name="minus" size={14} /></button>
          <button type="button" onClick={onClose} aria-label="Close Argus"><Icon name="close" size={15} /></button>
        </div>
      </header>
      <div className="argus__dock-controls" aria-label="Argus panel position">
        <button type="button" aria-pressed={panelState === "docked-left"} onClick={() => onPanelState("docked-left")}><Icon name="dock" size={13} /> Left</button>
        <button type="button" aria-pressed={panelState === "floating"} onClick={() => onPanelState("floating")}><Icon name="compare" size={13} /> Float</button>
        <button type="button" aria-pressed={panelState === "docked-right"} onClick={() => onPanelState("docked-right")}><Icon name="dock" size={13} /> Right</button>
        <button type="button" aria-pressed={panelState === "expanded"} onClick={() => onPanelState("expanded")}><Icon name="plus" size={13} /> Expand</button>
      </div>
      <div className="argus__context">
        <span>{context.place?.name ?? "General guidance"}</span>
        <span>{moduleRegistry[context.moduleId].title}</span>
        {context.observationIds.length > 0 && <span>{context.observationIds.length} observations</span>}
      </div>
      <div className="argus__messages" role="log" aria-live="polite">
        {messages.map((message, index) => (
          <div key={`${message.role}-${index}`} className={`argus__message argus__message--${message.role}`}>
            <p>{message.text}</p>
            {message.sourceId && <small>Context source: {message.sourceId}</small>}
          </div>
        ))}
      </div>
      <div className="argus__actions">
        <span>Guided actions</span>
        {actions.map((action) => <button key={action} type="button" onClick={() => answer(action)}>{action}<Icon name="arrow" size={13} /></button>)}
        <Link to="/methodology">Open methodology <Icon name="external" size={13} /></Link>
      </div>
      <footer className="argus__footer"><Icon name="shield" size={13} /> Argus never issues operational warning advice.</footer>
    </>
  )
}

export function Argus() {
  const desktop = useMediaQuery("(min-width: 720px)")
  const location = useLocation()
  const [open, setOpen] = useState(false)
  const [minimized, setMinimized] = useState(false)
  const [panelState, setPanelState] = useState<PanelState>(() => readStored("eartheyes.argus.state", "floating"))
  const [position, setPosition] = useState<Position>(() => readStored("eartheyes.argus.position", { x: Math.max(16, window.innerWidth - 450), y: 96 }))
  const [size, setSize] = useState<Size>(() => readStored("eartheyes.argus.size", { width: 410, height: 610 }))
  const panelRef = useRef<HTMLElement>(null)
  const dragRef = useRef<{ pointerX: number; pointerY: number; startX: number; startY: number } | null>(null)

  const clamp = useCallback((next: Position, panelSize = size): Position => ({
    x: Math.min(Math.max(12, next.x), Math.max(12, window.innerWidth - panelSize.width - 12)),
    y: Math.min(Math.max(76, next.y), Math.max(76, window.innerHeight - panelSize.height - 72)),
  }), [size])

  useEffect(() => {
    store("eartheyes.argus.state", panelState)
  }, [panelState])
  useEffect(() => {
    store("eartheyes.argus.position", position)
  }, [position])
  useEffect(() => {
    store("eartheyes.argus.size", size)
  }, [size])
  useEffect(() => {
    const resize = () => setPosition((current) => clamp(current))
    window.addEventListener("resize", resize)
    return () => window.removeEventListener("resize", resize)
  }, [clamp])
  useEffect(() => {
    const panel = panelRef.current
    if (!panel || panelState !== "floating") return
    const observer = new ResizeObserver(([entry]) => {
      const next = { width: Math.round(entry.contentRect.width), height: Math.round(entry.contentRect.height) }
      if (next.width >= 330 && next.height >= 420) setSize(next)
    })
    observer.observe(panel)
    return () => observer.disconnect()
  }, [open, panelState])

  const pointerDown = (event: ReactPointerEvent<HTMLElement>) => {
    if (panelState !== "floating" || !(event.target as HTMLElement).closest("[data-drag-handle]")) return
    if ((event.target as HTMLElement).closest("button")) return
    event.currentTarget.setPointerCapture(event.pointerId)
    dragRef.current = { pointerX: event.clientX, pointerY: event.clientY, startX: position.x, startY: position.y }
  }
  const pointerMove = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current || !panelRef.current) return
    const next = clamp({ x: dragRef.current.startX + event.clientX - dragRef.current.pointerX, y: dragRef.current.startY + event.clientY - dragRef.current.pointerY })
    panelRef.current.style.transform = `translate3d(${next.x}px, ${next.y}px, 0)`
  }
  const pointerUp = (event: ReactPointerEvent<HTMLElement>) => {
    if (!dragRef.current) return
    const raw = clamp({ x: dragRef.current.startX + event.clientX - dragRef.current.pointerX, y: dragRef.current.startY + event.clientY - dragRef.current.pointerY })
    const snapped = { ...raw }
    if (raw.x < 34) snapped.x = 12
    if (window.innerWidth - (raw.x + size.width) < 34) snapped.x = window.innerWidth - size.width - 12
    if (raw.y < 92) snapped.y = 76
    setPosition(snapped)
    dragRef.current = null
  }

  const reset = () => {
    setPanelState("floating")
    setSize({ width: 410, height: 610 })
    setPosition(clamp({ x: window.innerWidth - 438, y: 96 }, { width: 410, height: 610 }))
  }

  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => document.querySelector<HTMLButtonElement>(".argus-launcher")?.focus())
  }

  const openPanel = () => {
    setOpen(true)
    setMinimized(false)
    requestAnimationFrame(() => panelRef.current?.focus())
  }

  const launcher = (
    <Button className="argus-launcher" onClick={openPanel} aria-label="Ask Argus evidence guide" aria-expanded={open} aria-controls="argus-panel">
      <span><Icon name="chat" size={18} /></span><span><strong>Ask Argus</strong><small>Evidence guide</small></span>
    </Button>
  )

  if (!desktop) {
    return (
      <Dialog.Root open={open} onOpenChange={setOpen}>
        <Dialog.Trigger asChild>{launcher}</Dialog.Trigger>
        <Dialog.Portal>
          <Dialog.Overlay className="dialog-overlay" />
          <Dialog.Content id="argus-panel" className="argus argus--mobile" aria-describedby="argus-description">
            <Dialog.Title className="sr-only">Argus evidence guide</Dialog.Title>
            <Dialog.Description id="argus-description" className="sr-only">Scripted contextual explanations for EarthEyes evidence.</Dialog.Description>
            <ArgusContent key={`${location.pathname}${location.search}`} onClose={() => setOpen(false)} onMinimize={() => setOpen(false)} panelState="floating" onPanelState={() => undefined} onReset={() => undefined} />
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    )
  }

  return (
    <>
      {!open && launcher}
      {open && minimized && (
        <button className="argus-minimized" type="button" onClick={() => setMinimized(false)}><Icon name="chat" size={16} /><span>Argus / {panelState}</span><Icon name="plus" size={14} /></button>
      )}
      {open && !minimized && (
        <aside
          ref={panelRef}
          id="argus-panel"
          className={`argus argus--desktop argus--${panelState}`}
          style={panelState === "floating" ? { width: size.width, height: size.height, transform: `translate3d(${position.x}px, ${position.y}px, 0)` } : undefined}
          aria-label="Argus evidence guide"
          tabIndex={-1}
          onPointerDown={pointerDown}
          onPointerMove={pointerMove}
          onPointerUp={pointerUp}
          onPointerCancel={() => { dragRef.current = null }}
        >
          <ArgusContent key={`${location.pathname}${location.search}`} onClose={close} onMinimize={() => setMinimized(true)} panelState={panelState} onPanelState={setPanelState} onReset={reset} />
        </aside>
      )}
    </>
  )
}
