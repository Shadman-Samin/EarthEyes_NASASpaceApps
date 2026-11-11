import { Icon, type IconName } from "./Icon"

export function StatePanel({
  title,
  message,
  icon = "info",
  compact = false,
}: {
  title: string
  message: string
  icon?: IconName
  compact?: boolean
}) {
  return (
    <div className={`state-panel ${compact ? "state-panel--compact" : ""}`} role="status">
      <span className="state-panel__icon"><Icon name={icon} size={18} /></span>
      <div>
        <strong>{title}</strong>
        <p>{message}</p>
      </div>
    </div>
  )
}

export function Skeleton({ lines = 3 }: { lines?: number }) {
  return (
    <div className="skeleton" aria-label="Loading" role="status">
      {Array.from({ length: lines }, (_, index) => (
        <span key={index} style={{ width: `${92 - index * 11}%` }} />
      ))}
    </div>
  )
}
