export const formatDate = (value: string, options?: Intl.DateTimeFormatOptions) =>
  new Intl.DateTimeFormat("en", { day: "2-digit", month: "short", year: "numeric", ...options, timeZone: "UTC" }).format(
    new Date(value),
  )

export const formatDateTime = (value: string) =>
  new Intl.DateTimeFormat("en", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "UTC",
    timeZoneName: "short",
  }).format(new Date(value))

export const formatCoordinate = ([longitude, latitude]: [number, number]) =>
  `${Math.abs(latitude).toFixed(3)}${latitude >= 0 ? "N" : "S"}, ${Math.abs(longitude).toFixed(3)}${longitude >= 0 ? "E" : "W"}`
