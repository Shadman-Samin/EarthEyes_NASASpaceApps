import type { DataClass, Quality } from "../../domain/models"

const labels: Record<DataClass, string> = {
  observed: "Observed",
  derived: "Derived",
  modeled: "Modeled",
  context: "Context",
  interpretation: "Interpretation",
  "authority-alert": "Authority alert",
}

export function DataBadge({ value }: { value: DataClass }) {
  return <span className={`data-badge data-badge--${value}`}>{labels[value]}</span>
}

export function QualityBadge({ value }: { value: Quality }) {
  return <span className={`quality-badge quality-badge--${value}`}>{value.replace("-", " ")}</span>
}
