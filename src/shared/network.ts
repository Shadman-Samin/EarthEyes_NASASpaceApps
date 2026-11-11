type NavigatorWithConnection = Navigator & {
  connection?: { saveData?: boolean }
}

export function prefersLowBandwidth() {
  if (typeof window === "undefined") return false
  const savesData = (navigator as NavigatorWithConnection).connection?.saveData === true
  const reducesData = typeof window.matchMedia === "function" && window.matchMedia("(prefers-reduced-data: reduce)").matches
  return savesData || reducesData
}
