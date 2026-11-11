import { useEffect, useState } from "react"
import type { EventContext, Observation } from "../../domain/models"
import { formatDate } from "../../shared/formatting"
import { Icon } from "../../shared/ui"
import { getDataOrigin } from "../../data/repository"

export function ObservationTimeline({
  observations,
  selectedId,
  events,
  onSelect,
  dataOrigin = getDataOrigin(),
}: {
  observations: Observation[]
  selectedId: string
  events: EventContext[]
  onSelect: (id: string, replace?: boolean) => void
  dataOrigin?: "fixture" | "live"
}) {
  const [playing, setPlaying] = useState(false)
  const fixtureData = dataOrigin === "fixture"
  const selectedIndex = Math.max(0, observations.findIndex((observation) => observation.id === selectedId))

  useEffect(() => {
    if (!playing || observations.length < 2) return
    const interval = window.setInterval(() => {
      const index = observations.findIndex((observation) => observation.id === selectedId)
      const nextIndex = index >= observations.length - 1 ? 0 : index + 1
      onSelect(observations[nextIndex].id, true)
    }, window.matchMedia("(prefers-reduced-motion: reduce)").matches ? 1800 : 1100)
    return () => window.clearInterval(interval)
  }, [observations, onSelect, playing, selectedId])

  if (!observations.length) return null
  const selected = observations[selectedIndex]
  const acquisitionTimes = observations.map((observation) => new Date(observation.acquiredAt).getTime())
  const startTime = Math.min(...acquisitionTimes)
  const endTime = Math.max(...acquisitionTimes)
  const positionFor = (time: number) => endTime === startTime ? 50 : (time - startTime) / (endTime - startTime) * 100

  return (
    <section className="observation-timeline" aria-label="Observation timeline">
      <div className="observation-timeline__transport">
        <button type="button" onClick={() => setPlaying((current) => !current)} aria-label={playing ? "Pause observation playback" : "Play observations"}>
          <Icon name={playing ? "pause" : "play"} size={16} />
        </button>
        <div>
          <strong>{formatDate(selected.acquiredAt)}</strong>
          <span>{selected.platform} / {selected.quality}</span>
        </div>
      </div>
      <div className="observation-timeline__track">
        <input
          type="range"
          min="0"
          max={observations.length - 1}
          step="1"
          value={selectedIndex}
          onChange={(event) => onSelect(observations[Number(event.target.value)].id, true)}
          aria-label="Selected acquisition"
          aria-valuetext={`${formatDate(selected.acquiredAt)}, ${selected.platform}, ${selected.quality}`}
        />
        <div className="observation-timeline__ticks" aria-hidden="true">
          {observations.map((observation, index) => (
            <span key={observation.id} className={index === selectedIndex ? "is-selected" : ""} style={{ left: `${observations.length > 1 ? index / (observations.length - 1) * 100 : 50}%` }}>
              <i data-quality={observation.quality} />
              <small>{formatDate(observation.acquiredAt, { month: "short", year: "2-digit" })}</small>
            </span>
          ))}
        </div>
        {events.map((event) => {
          const position = Math.min(100, Math.max(0, positionFor(new Date(`${event.date}T00:00:00Z`).getTime())))
          return <span key={event.id} className="observation-timeline__event" style={{ left: `${position}%` }} title={event.title} tabIndex={0} aria-label={`${event.title}, ${event.date}`}><Icon name="alert" size={12} /></span>
        })}
      </div>
      <div className="observation-timeline__coverage">
        <span>{observations.length} acquisitions</span>
        <span>{fixtureData ? "Fixture acquisition steps" : "Loaded dates, not complete coverage"}</span>
      </div>
    </section>
  )
}
