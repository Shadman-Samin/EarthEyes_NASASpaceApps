import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import type { ComparisonMode, Observation } from "../../domain/models"
import { formatDateTime } from "../../shared/formatting"
import { prefersLowBandwidth } from "../../shared/network"
import { DataBadge, Icon, QualityBadge, Skeleton, StatePanel } from "../../shared/ui"
import { getCompatibility, sameFamily } from "./compatibility"
import { browseDifference, describeBrowseDifference, type DifferenceResult } from "./difference"
import { getDataOrigin } from "../../data/repository"
import "./live-comparison.css"

const browseDisclaimer = "Official SAR browse preview; not a calibrated raster or validated change measurement."

type PreviewOptions = {
  fixtureData: boolean
  failedUrls: string[]
  onError: (url: string) => void
}

function PreviewImage({ observation, preview, className, opacity, decorative }: {
  observation: Observation
  preview: PreviewOptions
  className?: string
  opacity?: number
  decorative?: boolean
}) {
  const src = observation.imageUrl
  if (!src || preview.failedUrls.includes(src)) return null
  return (
    <img
      src={src}
      alt={decorative ? "" : `${preview.fixtureData ? "Fixture" : "SAR browse"} preview for ${formatDateTime(observation.acquiredAt)}`}
      aria-hidden={decorative || undefined}
      className={className}
      style={opacity === undefined ? undefined : { opacity }}
      onError={() => preview.onError(src)}
    />
  )
}

function ObservationLabel({ observation, side }: { observation: Observation; side: string }) {
  return (
    <div className="comparison-label">
      <span>{side}</span>
      <strong>{formatDateTime(observation.acquiredAt)}</strong>
      <small>{observation.platform} / {observation.polarization}</small>
    </div>
  )
}

function FixtureTexture({ side }: { side: "left" | "right" }) {
  return <div className={`low-data-texture low-data-texture--${side}`} aria-hidden="true" />
}

function JellySwipe({ left, right, lowBandwidth, preview }: { left: Observation; right: Observation; lowBandwidth: boolean; preview: PreviewOptions }) {
  const [position, setPosition] = useState(0.55)
  const [bend, setBend] = useState(0)
  const [held, setHeld] = useState(false)
  const [size, setSize] = useState({ width: 0, height: 0 })
  const stageRef = useRef<HTMLDivElement>(null)
  const sizeRef = useRef({ width: 0, height: 0 })
  const current = useRef(0.55)
  const target = useRef<number | null>(null)
  const ends = useRef({ x: 0.55, velocity: 0 })
  const frame = useRef(0)
  const drag = useRef<{ velocity: number; time: number; last: number } | null>(null)
  const reducedMotion = useRef(false)
  const clamp = (value: number) => Math.min(1, Math.max(0, value))

  useEffect(() => {
    reducedMotion.current = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    const stage = stageRef.current
    if (!stage) return
    const observer = new ResizeObserver(([entry]) => {
      const nextSize = { width: entry.contentRect.width, height: entry.contentRect.height }
      sizeRef.current = nextSize
      setSize(nextSize)
    })
    observer.observe(stage)
    return () => {
      observer.disconnect()
      cancelAnimationFrame(frame.current)
    }
  }, [])

  const animate = () => {
    if (frame.current) return
    let previous = performance.now()
    const step = (time: number) => {
      const delta = Math.min(0.033, (time - previous) / 1000)
      previous = time
      if (target.current !== null) {
        const easing = reducedMotion.current ? 1 : 1 - Math.pow(0.0004, delta)
        current.current += (target.current - current.current) * easing
        if (Math.abs(target.current - current.current) < 0.0005) {
          current.current = target.current
          target.current = null
        }
      }
      if (reducedMotion.current) {
        ends.current.x = current.current
        ends.current.velocity = 0
      } else {
        ends.current.velocity += ((current.current - ends.current.x) * 620 - ends.current.velocity * 44) * delta
        ends.current.x += ends.current.velocity * delta
      }
      setPosition(current.current)
      setBend(Math.min(9, Math.max(-9, (current.current - ends.current.x) * sizeRef.current.width * 0.5)))
      const still = target.current === null && Math.abs(current.current - ends.current.x) < 0.0006 && Math.abs(ends.current.velocity) < 0.002
      if (still) {
        ends.current.x = current.current
        ends.current.velocity = 0
        setBend(0)
        frame.current = 0
        return
      }
      frame.current = requestAnimationFrame(step)
    }
    frame.current = requestAnimationFrame(step)
  }

  const glide = (value: number) => {
    target.current = clamp(value)
    animate()
  }
  const place = (value: number) => {
    target.current = null
    current.current = clamp(value)
    setPosition(current.current)
    animate()
  }
  const pointerPosition = (clientX: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    return rect ? clamp((clientX - rect.left) / rect.width) : current.current
  }
  const keyDown = (event: KeyboardEvent<HTMLDivElement>) => {
    const base = target.current ?? current.current
    if (["ArrowLeft", "ArrowDown"].includes(event.key)) {
      event.preventDefault()
      glide(base - 0.1)
    } else if (["ArrowRight", "ArrowUp"].includes(event.key)) {
      event.preventDefault()
      glide(base + 0.1)
    } else if (event.key === "Home" || event.key === "End") {
      event.preventDefault()
      glide(event.key === "Home" ? 0 : 1)
    }
  }

  const x = position * size.width
  const edge = x - bend
  const middleY = size.height / 2
  const curve = size.width ? `M ${edge} 0 Q ${x + bend} ${middleY} ${edge} ${size.height}` : ""
  const clipPath = size.width
    ? `path("M 0 0 L ${edge} 0 Q ${x + bend} ${middleY} ${edge} ${size.height} L 0 ${size.height} Z")`
    : undefined

  return (
    <div
      ref={stageRef}
      className="jelly-swipe"
      data-held={held || undefined}
      role="slider"
      tabIndex={0}
      aria-label="Observation comparison divider"
      aria-valuemin={0}
      aria-valuemax={100}
      aria-valuenow={Math.round(position * 100)}
      aria-valuetext={`${Math.round(position * 100)} percent earlier observation visible`}
      onKeyDown={keyDown}
      onPointerDown={(event) => {
        event.currentTarget.setPointerCapture(event.pointerId)
        const value = pointerPosition(event.clientX)
        drag.current = { velocity: 0, time: performance.now(), last: value }
        setHeld(true)
        glide(value)
      }}
      onPointerMove={(event) => {
        if (!drag.current) return
        const value = pointerPosition(event.clientX)
        const now = performance.now()
        drag.current.velocity = (value - drag.current.last) / Math.max(1, now - drag.current.time)
        drag.current.time = now
        drag.current.last = value
        place(value)
      }}
      onPointerUp={(event) => {
        const released = drag.current
        drag.current = null
        setHeld(false)
        if (event.currentTarget.hasPointerCapture(event.pointerId)) event.currentTarget.releasePointerCapture(event.pointerId)
        if (released && Math.abs(released.velocity) > 0.0025) glide(released.velocity > 0 ? 1 : 0)
      }}
      onPointerCancel={() => {
        drag.current = null
        setHeld(false)
      }}
    >
      {lowBandwidth ? <FixtureTexture side="right" /> : <PreviewImage observation={right} preview={preview} decorative={preview.fixtureData} className="comparison-image comparison-image--right" />}
      <div className="comparison-tint comparison-tint--right" />
      <div className="jelly-swipe__left" style={{ clipPath }} aria-hidden={preview.fixtureData || undefined}>
        {lowBandwidth ? <FixtureTexture side="left" /> : <PreviewImage observation={left} preview={preview} decorative={preview.fixtureData} className="comparison-image comparison-image--left" />}
        <div className="comparison-tint comparison-tint--left" />
      </div>
      {size.width > 0 && <svg className="jelly-swipe__line" width={size.width} height={size.height}><path d={curve} /></svg>}
      <span className="jelly-swipe__grip" style={{ left: x }} aria-hidden="true"><Icon name="compare" size={18} /></span>
      <ObservationLabel observation={left} side="Earlier" />
      <div className="comparison-label comparison-label--right"><span>Later</span><strong>{formatDateTime(right.acquiredAt)}</strong><small>{right.platform} / {right.polarization}</small></div>
    </div>
  )
}

function ObservationImage({ observation, label, lowBandwidth, preview }: { observation: Observation; label?: string; lowBandwidth: boolean; preview: PreviewOptions }) {
  return (
    <figure className="observation-image">
      {lowBandwidth ? <FixtureTexture side={label === "Earlier" ? "left" : "right"} /> : <PreviewImage observation={observation} preview={preview} />}
      <figcaption>
        {label && <span>{label}</span>}
        <strong>{formatDateTime(observation.acquiredAt)}</strong>
        <small>{observation.platform} / {observation.instrument}</small>
      </figcaption>
    </figure>
  )
}

function ObservationDetails({ observation, fixtureData }: { observation: Observation; fixtureData: boolean }) {  return (
    <>
      <dl className="observation-details">
        <div><dt>Observation ID</dt><dd>{observation.id}</dd></div>
        <div><dt>Source</dt><dd>{!fixtureData && observation.sourceUrl ? <a href={observation.sourceUrl} target="_blank" rel="noopener noreferrer">{observation.sourceId} official source</a> : observation.sourceId}</dd></div>
        <div><dt>Orbit</dt><dd>{observation.orbitDirection ?? "Not reported"} / {observation.relativeOrbit ?? "Not reported"}</dd></div>
        <div><dt>Polarization</dt><dd>{observation.polarization}</dd></div>
        <div><dt>Processing</dt><dd>{observation.processingLevel}</dd></div>
        <div><dt>Resolution</dt><dd>{observation.resolutionM == null ? "Not reported" : `${observation.resolutionM} m`}</dd></div>
        <div><dt>Overlap</dt><dd>{observation.coverageOverlap == null ? "Not computed" : `${observation.coverageOverlap}%`}</dd></div>
        <div><dt>Alignment</dt><dd>{observation.alignmentQuality ?? "Not computed"}</dd></div>
      </dl>
      <ul className="observation-limitations" aria-label="Known observation limitations">
        {observation.knownLimitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
      </ul>
    </>
  )
}

const differenceDisclaimer = "Exploratory pixel difference of official browse renders. Not calibrated, not georeferenced, not a change measurement."

function loadBrowseImage(src: string) {
  return new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image()
    image.crossOrigin = "anonymous"
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error("The browse image could not be loaded for difference processing."))
    image.src = src
  })
}

function readPixels(image: HTMLImageElement, width: number, height: number) {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const context = canvas.getContext("2d", { willReadFrequently: true })
  if (!context) throw new Error("Canvas rendering is unavailable in this browser.")
  context.drawImage(image, 0, 0, width, height)
  return context.getImageData(0, 0, width, height)
}

function LiveDifference({ left, right }: { left: Observation; right: Observation }) {
  const [result, setResult] = useState<DifferenceResult | null>(null)
  const [failed, setFailed] = useState(false)
  const canvasRef = useRef<HTMLCanvasElement>(null)

  useEffect(() => {
    let cancelled = false
    Promise.all([loadBrowseImage(left.imageUrl!), loadBrowseImage(right.imageUrl!)])
      .then(([earlier, later]) => {
        if (cancelled) return
        const size = { width: Math.min(earlier.naturalWidth, later.naturalWidth, 2400), height: Math.min(earlier.naturalHeight, later.naturalHeight, 2400) }
        if (!size.width || !size.height) throw new Error("The browse renders are empty.")
        setResult(browseDifference(readPixels(earlier, size.width, size.height), readPixels(later, size.width, size.height)))
      })
      .catch(() => {
        if (!cancelled) setFailed(true)
      })
    return () => { cancelled = true }
  }, [left.imageUrl, right.imageUrl])

  useEffect(() => {
    if (!result || !canvasRef.current) return
    canvasRef.current.getContext("2d")?.putImageData(new ImageData(result.pixels, result.width, result.height), 0, 0)
  }, [result])

  if (failed) {
    return <StatePanel title="Difference preview unavailable" message="The browse renders could not be loaded for pixel processing. Use Swipe, Side by side, Single, or Fade instead; no substitute image is shown." icon="alert" />
  }
  if (!result) return <div className="live-difference live-difference--loading"><Skeleton lines={5} /></div>
  const summary = describeBrowseDifference(result)
  return (
    <div className="live-difference">
      <div className="live-difference__summary">
        <strong>{summary.headline}</strong>
        <p>{summary.detail}</p>
      </div>
      <canvas ref={canvasRef} role="img" aria-label={`Exploratory pixel difference between ${formatDateTime(left.acquiredAt)} and ${formatDateTime(right.acquiredAt)} browse renders`} />
      <div className="difference-view__legend"><DataBadge value="derived" /> {differenceDisclaimer} Warmer: later brighter. Teal: later darker.</div>
    </div>
  )
}

export function ComparisonViewer({
  mode,
  left,
  right,
  dataOrigin = getDataOrigin(),
}: {
  mode: ComparisonMode
  left?: Observation
  right?: Observation
  dataOrigin?: "fixture" | "live"
}) {
  const [fade, setFade] = useState(50)
  const [failedUrls, setFailedUrls] = useState<string[]>([])
  const compatibility = getCompatibility(left, right)
  const lowBandwidth = prefersLowBandwidth()
  const fixtureData = dataOrigin === "fixture"

  if (mode === "difference" && !fixtureData) {
    if (!left || !right) {
      return <StatePanel title="Exploratory difference unavailable" message="Choose two available acquisitions to preview a difference." icon="alert" />
    }
    if (!sameFamily(left, right)) {
      return <StatePanel title="Exploratory difference unavailable" message="Difference preview needs both sides from the same platform, polarization, and processing with imagery loaded. Switch polarization or pick another pair." icon="alert" />
    }
  }
  if (!right || (mode !== "single" && !left)) {
    return <StatePanel title="Observation unavailable" message="Choose an available acquisition from the timeline." icon="calendar" />
  }
  if (mode !== "single" && compatibility.level === "incompatible") {
    return <StatePanel title="Comparison blocked" message={compatibility.message} icon="alert" />
  }
  if (mode === "difference" && fixtureData && compatibility.level !== "compatible") {
    return <StatePanel title="Difference view blocked" message={`${compatibility.message} Choose a compatible pair before calculating a derived difference.`} icon="alert" />
  }

  const preview: PreviewOptions = {
    fixtureData,
    failedUrls,
    onError: (url) => setFailedUrls((urls) => urls.includes(url) ? urls : [...urls, url]),
  }
  const displayedObservations = left && mode !== "single" ? [left, right] : [right]

  return (
    <section className="comparison-viewer" data-origin={dataOrigin} aria-label={`${mode} observation view`}>
      <header className="comparison-viewer__header">
        <div>
          <span className="section-kicker">Observation workspace</span>
          <h2>{mode === "side-by-side" ? (fixtureData ? "Synchronized scenes" : "SAR browse previews") : mode === "difference" ? (fixtureData ? "Derived difference view" : "Exploratory difference") : mode === "single" ? "Single observation" : mode === "fade" ? "Overlay fade" : "Jelly swipe comparison"}</h2>
        </div>
        <div className={`compatibility compatibility--${compatibility.level}`}>
          <Icon name={compatibility.level === "compatible" ? "check" : "alert"} size={15} />
          <span>{compatibility.level}</span>
        </div>
      </header>

      {mode !== "single" && <p className={`compatibility-note compatibility-note--${compatibility.level}`}>{compatibility.message}</p>}
      {!fixtureData && <p className="fixture-note"><Icon name="info" size={14} /> {browseDisclaimer}</p>}

      {/* Keep image failures outside the clipped swipe and transparent fade layers. */}
      {displayedObservations.filter((observation) => !observation.imageUrl || failedUrls.includes(observation.imageUrl)).map((observation) => (
        <p className="compatibility-note compatibility-note--review" role="status" key={observation.id}>
          {formatDateTime(observation.acquiredAt)}: <strong>{observation.imageUrl ? "Image failed to load." : "Image unavailable."}</strong> {observation.imageUrl ? "The source browse image could not be loaded. No substitute imagery is shown." : "No preview image was reported for this observation."}
        </p>
      ))}

      <div className="comparison-viewer__stage">
        {lowBandwidth && !fixtureData ? (
          <StatePanel title="Real imagery paused" message="Low-bandwidth mode pauses public browse images. Disable data saving to load them; no synthetic imagery is substituted." />
        ) : (
          <>
            {mode === "swipe" && left && <JellySwipe left={left} right={right} lowBandwidth={lowBandwidth} preview={preview} />}
            {mode === "side-by-side" && left && (
              <div className="side-by-side"><ObservationImage observation={left} label="Earlier" lowBandwidth={lowBandwidth} preview={preview} /><ObservationImage observation={right} label="Later" lowBandwidth={lowBandwidth} preview={preview} /></div>
            )}
            {mode === "single" && <ObservationImage observation={right} label="Selected observation" lowBandwidth={lowBandwidth} preview={preview} />}
            {mode === "difference" && left && (fixtureData ? (
              <div className="difference-view">
                {lowBandwidth ? <><FixtureTexture side="left" /><FixtureTexture side="right" /></> : <><PreviewImage observation={left} preview={preview} decorative /><PreviewImage observation={right} preview={preview} decorative /></>}
                <div className="difference-view__legend"><DataBadge value="derived" /> Pixel-difference preview / fixture imagery</div>
              </div>
            ) : <LiveDifference key={`${left.id}|${right.id}|${left.imageUrl}|${right.imageUrl}`} left={left} right={right!} />)}
            {mode === "fade" && left && (
              <div className="fade-view">
                {lowBandwidth ? <><FixtureTexture side="left" /><div style={{ opacity: fade / 100 }}><FixtureTexture side="right" /></div></> : <><PreviewImage observation={left} preview={preview} decorative={fixtureData} /><PreviewImage observation={right} preview={preview} decorative={fixtureData} opacity={fade / 100} /></>}
                <label><span>Later observation opacity</span><input type="range" min="0" max="100" value={fade} onChange={(event) => setFade(Number(event.target.value))} aria-valuetext={`${fade}% later observation`} /></label>
              </div>
            )}
          </>
        )}
      </div>

      <div className="comparison-viewer__metadata">
        {left && mode !== "single" && <article><div><strong>Earlier observation</strong><DataBadge value={left.classification} /><QualityBadge value={left.quality} /></div><ObservationDetails observation={left} fixtureData={fixtureData} /></article>}
        <article><div><strong>{mode === "single" ? "Observation" : "Later observation"}</strong><DataBadge value={right.classification} /><QualityBadge value={right.quality} /></div><ObservationDetails observation={right} fixtureData={fixtureData} /></article>
      </div>
      {fixtureData && <p className="fixture-note"><Icon name="info" size={14} /> {lowBandwidth ? "Low-bandwidth mode replaces remote fixture imagery with lightweight textures. " : "Imagery is a visual fixture, not a loaded satellite product. "}Metadata, compatibility checks, and limitations remain attached.</p>}
    </section>
  )
}
