import type { ModuleId } from "./models"

export type ModuleDefinition = {
  id: ModuleId
  shortLabel: string
  title: string
  description: string
  accent: string
  layerIds: string[]
  evidenceTabs: Array<"summary" | "comparison" | "chart" | "context" | "sources">
  observedStatement: string
  contextStatement: string
  possibleExplanations: string
  cannotProve: string
}

export const moduleRegistry: Record<ModuleId, ModuleDefinition> = {
  coastal: {
    id: "coastal",
    shortLabel: "Coastal",
    title: "Coastal change",
    description: "Inspect shoreline, surface-water, subsidence, and settlement context without treating SAR as a sea-level gauge.",
    accent: "#39a9ad",
    layerIds: [
      "sar-observation",
      "shoreline",
      "inundation",
      "subsidence",
      "settlements",
      "population",
      "altimetry",
    ],
    evidenceTabs: ["summary", "comparison", "chart", "context", "sources"],
    observedStatement: "Repeat SAR imagery indicates shoreline-position or surface-water change within the selected footprint.",
    contextStatement: "Altimetry, tide, surge, weather, and vertical-land-motion products provide separate context.",
    possibleExplanations: "Erosion, flooding, sediment movement, subsidence, construction, seasonal water, or processing artifacts.",
    cannotProve: "SAR shoreline movement alone does not prove sea-level rise caused the change. NISAR observations and altimetry are different measurements.",
  },
  flood: {
    id: "flood",
    shortLabel: "Flood",
    title: "Flood & inundation",
    description: "Compare repeat radar brightness to screen standing water, saturated ground, and river or coastal inundation, then check weather and terrain context.",
    accent: "#4f9ff0",
    layerIds: [
      "sar-observation",
      "surface-water",
      "inundation-extent",
      "sar-preview",
      "settlements",
      "river-network",
    ],
    evidenceTabs: ["summary", "comparison", "chart", "context", "sources"],
    observedStatement: "Repeat SAR amplitude can show darker, smoother surfaces consistent with open water or saturated ground within the selected footprint.",
    contextStatement: "Rainfall, river level, tide, terrain, and settlement data help separate flooding from seasonal water or wet soil.",
    possibleExplanations: "River flooding, storm or tidal inundation, seasonal water, wet soil, vegetation change, or imaging-geometry effects.",
    cannotProve: "Brightness change alone does not measure flood depth, duration, or human impact, and is not a flood forecast or public warning.",
  },
  ice: {
    id: "ice",
    shortLabel: "Ice",
    title: "Ice change",
    description: "Compare aligned radar observations with velocity, displacement, boundary, elevation, and temperature context.",
    accent: "#cbe870",
    layerIds: [
      "sar-observation",
      "velocity",
      "direction-vectors",
      "ice-front",
      "displacement",
      "elevation",
      "temperature",
      "quality-mask",
    ],
    evidenceTabs: ["summary", "comparison", "chart", "context", "sources"],
    observedStatement: "Aligned radar observations show coherent surface displacement and a change in the classified ice-front position.",
    contextStatement: "Velocity products, elevation, air temperature, and quality masks help test whether the pattern is reliable.",
    possibleExplanations: "Ice flow, seasonal melt, calving, stress changes, acquisition geometry, or co-registration error.",
    cannotProve: "A short radar comparison does not establish a long-term trend or attribute change to a single climatic driver.",
  },
  glof: {
    id: "glof",
    shortLabel: "GLOF",
    title: "Glacial lake context",
    description: "Review lake-area history, terrain, potential downstream paths, settlements, and authority-validated assessments.",
    accent: "#eb7658",
    layerIds: [
      "glacial-lakes",
      "lake-history",
      "glacier-boundary",
      "elevation-slope",
      "downstream-paths",
      "settlements",
    ],
    evidenceTabs: ["summary", "chart", "context", "sources"],
    observedStatement: "Satellite observations can indicate a change in mapped lake area or surrounding glacier conditions.",
    contextStatement: "Terrain, downstream exposure, field reports, and authority assessments are required to evaluate consequence.",
    possibleExplanations: "Seasonal water variation, lake expansion, drainage, cloud or shadow artifacts, and classification changes.",
    cannotProve: "Lake change is not an automatic public warning. A candidate must pass analyst review, supporting-evidence checks, and authority approval.",
  },
}

export const moduleList = Object.values(moduleRegistry)
