import type { RegimeId, SourceId, VariableId } from "../types/forecast";
export const SOURCES: {
  id: SourceId;
  name: string;
  short: string;
  color: string;
  description: string;
}[] = [
  {
    id: "nwp",
    name: "Physics-based NWP",
    short: "NWP",
    color: "#2f6f8f",
    description: "Numerical weather prediction",
  },
  {
    id: "ensemble",
    name: "Ensemble guidance",
    short: "Ensemble",
    color: "#6f929a",
    description: "Multi-member consensus",
  },
  {
    id: "ai",
    name: "AI pattern model",
    short: "AI model",
    color: "#4f9d8a",
    description: "Learned weather patterns",
  },
];
export const VARIABLES: Record<
  VariableId,
  {
    label: string;
    unit: string;
    threshold: number;
    scale: number;
    period: string;
  }
> = {
  rainfall: {
    label: "Rainfall",
    unit: "mm",
    threshold: 64.5,
    scale: 25,
    period: "24 h accumulation",
  },
  temperature: {
    label: "Temperature",
    unit: "°C",
    threshold: 40,
    scale: 3,
    period: "2 m air temperature",
  },
  wind: {
    label: "Wind speed",
    unit: "km/h",
    threshold: 50,
    scale: 12,
    period: "10 m sustained wind",
  },
};
export const REGIMES: Record<RegimeId, string> = {
  "active-monsoon": "Active monsoon",
  "monsoon-onset": "Monsoon onset",
  "low-pressure-system": "Low-pressure system",
  "western-disturbance": "Western disturbance",
  "heat-dome": "Heat dome",
  quiescent: "Quiescent",
};
// These are scenario coefficients, not measured claims about operational models.
// NWP error grows steadily; AI starts stronger but degrades faster with lead.
export const PROFILE = {
  version: "1.0.0",
  seed: 26081,
  history: 120,
  train: 72,
  validation: 24,
  rho: 0.62,
  error: [0.5, 0.77, 0.28],
  growth: [0.045, 0.033, 0.13],
  bias: [0.19, -0.27, 0.08],
  tailGate: 0.55,
  tailMaximum: 0.35,
  minimumHistory: 20,
  rainfallSignal: {
    "active-monsoon": 180,
    "monsoon-onset": 72,
    "low-pressure-system": 230,
    "western-disturbance": 38,
    "heat-dome": 1,
    quiescent: 7,
  },
  currentStormAttenuation: [0.08, 0.8, 0.28],
};
export function regionalFactors(lat: number, lon: number): number[] {
  if (lon > 88) return [0.8, 1.08, 1.17];
  if (lon < 77 && lat < 23) return [0.7, 1.18, 0.94];
  if (lat > 29) return [0.83, 0.98, 1.28];
  if (lat > 24 && lon < 79) return [1.09, 1.02, 0.7];
  return [1, 0.55, 1.05];
}
