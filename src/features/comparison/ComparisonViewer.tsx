import { useEffect, useRef, useState, type KeyboardEvent } from "react"
import type { ComparisonMode, Observation } from "../../domain/models"
import { formatDateTime } from "../../shared/formatting"
import { prefersLowBandwidth } from "../../shared/network"
import { DataBadge, Icon, QualityBadge, StatePanel } from "../../shared/ui"
import { getCompatibility } from "./compatibility"
import { getDataOrigin } from "../../data/repository"

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

function JellySwipe({ left, right, lowBandwidth }: { left: Observation; right: Observation; lowBandwidth: boolean }) {
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
      {lowBandwidth ? <FixtureTexture side="right" /> : <img src={right.imageUrl} alt="" aria-hidden="true" className="comparison-image comparison-image--right" />}
      <div className="comparison-tint comparison-tint--right" />
      <div className="jelly-swipe__left" style={{ clipPath }} aria-hidden="true">
        {lowBandwidth ? <FixtureTexture side="left" /> : <img src={left.imageUrl} alt="" className="comparison-image comparison-image--left" />}
        <div className="comparison-tint comparison-tint--left" />
      </div>
      {size.width > 0 && <svg className="jelly-swipe__line" width={size.width} height={size.height}><path d={curve} /></svg>}
      <span className="jelly-swipe__grip" style={{ left: x }} aria-hidden="true"><Icon name="compare" size={18} /></span>
      <ObservationLabel observation={left} side="Earlier" />
      <div className="comparison-label comparison-label--right"><span>Later</span><strong>{formatDateTime(right.acquiredAt)}</strong><small>{right.platform} / {right.polarization}</small></div>
    </div>
  )
}

function ObservationImage({ observation, label, lowBandwidth, fixtureData }: { observation: Observation; label?: string; lowBandwidth: boolean; fixtureData: boolean }) {
  return (
    <figure className="observation-image">
      {lowBandwidth ? <FixtureTexture side={label === "Earlier" ? "left" : "right"} /> : <img src={observation.imageUrl} alt={`${fixtureData ? "Fixture" : "Observation"} preview for ${formatDateTime(observation.acquiredAt)}`} />}
      <figcaption>
        {label && <span>{label}</span>}
        <strong>{formatDateTime(observation.acquiredAt)}</strong>
        <small>{observation.platform} / {observation.instrument}</small>
      </figcaption>
    </figure>
  )
}

function ObservationDetails({ observation }: { observation: Observation }) {
  return (
    <>
      <dl className="observation-details">
        <div><dt>Observation ID</dt><dd>{observation.id}</dd></div>
        <div><dt>Source</dt><dd>{observation.sourceId}</dd></div>
        <div><dt>Orbit</dt><dd>{observation.orbitDirection} / {observation.relativeOrbit}</dd></div>
        <div><dt>Polarization</dt><dd>{observation.polarization}</dd></div>
        <div><dt>Processing</dt><dd>{observation.processingLevel}</dd></div>
        <div><dt>Resolution</dt><dd>{observation.resolutionM} m</dd></div>
        <div><dt>Overlap</dt><dd>{observation.coverageOverlap}%</dd></div>
        <div><dt>Alignment</dt><dd>{observation.alignmentQuality}</dd></div>
      </dl>
      <ul className="observation-limitations" aria-label="Known observation limitations">
        {observation.knownLimitations.map((limitation) => <li key={limitation}>{limitation}</li>)}
      </ul>
    </>
  )
}

export function ComparisonViewer({
  mode,
  left,
  right,
}: {
  mode: ComparisonMode
  left?: Observation
  right?: Observation
}) {
  const [fade, setFade] = useState(50)
  const compatibility = getCompatibility(left, right)
  const lowBandwidth = prefersLowBandwidth()
  const fixtureData = getDataOrigin() === "fixture"

  if (!right || (mode !== "single" && !left)) {
    return <StatePanel title="Observation unavailable" message="Choose an available acquisition from the timeline." icon="calendar" />
  }
  if (mode !== "single" && compatibility.level === "incompatible") {
    return <StatePanel title="Comparison blocked" message={compatibility.message} icon="alert" />
  }
  if (mode === "difference" && compatibility.level !== "compatible") {
    return <StatePanel title="Difference view blocked" message={`${compatibility.message} Choose a compatible pair before calculating a derived difference.`} icon="alert" />
  }

  return (
    <section className="comparison-viewer" aria-label={`${mode} observation view`}>
      <header className="comparison-viewer__header">
        <div>
          <span className="section-kicker">Observation workspace</span>
          <h2>{mode === "side-by-side" ? "Synchronized scenes" : mode === "difference" ? "Derived difference view" : mode === "single" ? "Single observation" : mode === "fade" ? "Overlay fade" : "Jelly swipe comparison"}</h2>
        </div>
        <div className={`compatibility compatibility--${compatibility.level}`}>
          <Icon name={compatibility.level === "compatible" ? "check" : "alert"} size={15} />
          <span>{compatibility.level}</span>
        </div>
      </header>

      {mode !== "single" && <p className={`compatibility-note compatibility-note--${compatibility.level}`}>{compatibility.message}</p>}

      <div className="comparison-viewer__stage">
        {mode === "swipe" && left && <JellySwipe left={left} right={right} lowBandwidth={lowBandwidth} />}
        {mode === "side-by-side" && left && (
          <div className="side-by-side"><ObservationImage observation={left} label="Earlier" lowBandwidth={lowBandwidth} fixtureData={fixtureData} /><ObservationImage observation={right} label="Later" lowBandwidth={lowBandwidth} fixtureData={fixtureData} /></div>
        )}
        {mode === "single" && <ObservationImage observation={right} label="Selected observation" lowBandwidth={lowBandwidth} fixtureData={fixtureData} />}
        {mode === "difference" && left && (
          <div className="difference-view">
            {lowBandwidth ? <><FixtureTexture side="left" /><FixtureTexture side="right" /></> : <><img src={left.imageUrl} alt="" aria-hidden="true" /><img src={right.imageUrl} alt="" aria-hidden="true" /></>}
            <div className="difference-view__legend"><DataBadge value="derived" /> Pixel-difference preview / {fixtureData ? "fixture imagery" : "connected observation previews"}</div>
          </div>
        )}
        {mode === "fade" && left && (
          <div className="fade-view">
            {lowBandwidth ? <><FixtureTexture side="left" /><div style={{ opacity: fade / 100 }}><FixtureTexture side="right" /></div></> : <><img src={left.imageUrl} alt="" aria-hidden="true" /><img src={right.imageUrl} alt="" aria-hidden="true" style={{ opacity: fade / 100 }} /></>}
            <label><span>Later observation opacity</span><input type="range" min="0" max="100" value={fade} onChange={(event) => setFade(Number(event.target.value))} aria-valuetext={`${fade}% later observation`} /></label>
          </div>
        )}
      </div>

      <div className="comparison-viewer__metadata">
        {left && mode !== "single" && <article><div><strong>Earlier observation</strong><DataBadge value={left.classification} /><QualityBadge value={left.quality} /></div><ObservationDetails observation={left} /></article>}
        <article><div><strong>{mode === "single" ? "Observation" : "Later observation"}</strong><DataBadge value={right.classification} /><QualityBadge value={right.quality} /></div><ObservationDetails observation={right} /></article>
      </div>
      <p className="fixture-note"><Icon name="info" size={14} /> {lowBandwidth ? `Low-bandwidth mode replaces remote ${fixtureData ? "fixture " : ""}imagery with lightweight textures. ` : fixtureData ? "Imagery is a visual fixture, not a loaded satellite product. " : "Observation previews come from the configured API. "}Metadata, compatibility checks, and limitations remain attached.</p>
    </section>
  )
}
