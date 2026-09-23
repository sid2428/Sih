export type SourceId = "nwp" | "ensemble" | "ai";
export type VariableId = "rainfall" | "temperature" | "wind";
export type RegimeId =
  | "active-monsoon"
  | "monsoon-onset"
  | "low-pressure-system"
  | "western-disturbance"
  | "heat-dome"
  | "quiescent";
export interface Cell {
  id: string;
  lat: number;
  lon: number;
}
export interface Selection {
  cell: Cell;
  location: string;
  variable: VariableId;
  lead: number;
  date: string;
  regime: RegimeId;
  temperature: number;
  unavailable: SourceId[];
}
export interface ForecastRecord {
  timestamp: string;
  lat: number;
  lon: number;
  lead_time: number;
  source: SourceId;
  variable: VariableId;
  forecast_value: number;
  observed_value?: number;
}
export interface Sample {
  observed: number;
  forecast: number;
  time: string;
}
export interface SourceResult {
  id: SourceId;
  raw: number;
  corrected: number;
  weight: number;
  bias: number;
  cost: number;
  rmse: number;
  probability: number;
  samples: number;
  available: boolean;
  residuals: number[];
}
export interface Forecast {
  sources: SourceResult[];
  value: number;
  routine: number;
  baseline: number;
  probability: number;
  lower: number;
  upper: number;
  threshold: number;
  confidence: "High" | "Moderate" | "Limited";
  risk: "Monitor" | "Elevated" | "High";
  agreement: number;
  tailStrength: number;
  reasons: string[];
  skill: {
    baseline: number;
    adaptive: number;
    improvement: number;
    count: number;
    sourceErrors: number[];
  } | null;
  mode: "demo" | "upload";
  historyStart: string;
  historyEnd: string;
  coverage: string;
}
