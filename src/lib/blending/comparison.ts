import type { ForecastRecord, Selection } from "../../types/forecast";
import { SOURCES, VARIABLES } from "../../data/mock-profile";
import {
  applyTail,
  deriveForecast,
  mean,
  prepareForecast,
  softmax,
} from "./engine";
export type ComparisonMode = "history" | "horizon" | "skill";
export type SeriesId =
  "nwp" | "ensemble" | "ai" | "blend" | "baseline" | "observed";
export interface ComparisonPoint {
  x: number;
  label: string;
  nwp: number | null;
  ensemble: number | null;
  ai: number | null;
  blend: number | null;
  baseline: number | null;
  observed: number | null;
}
const clip = (v: number, s: Selection) =>
  s.variable === "temperature" ? v : Math.max(0, v);
/** The same untouched evaluation cases and correction parameters used in the skill score. */
export function historicalComparison(s: Selection): ComparisonPoint[] {
  const { sources, calibrations } = prepareForecast(s);
  const weights = softmax(
    sources.map((x) => x.cost),
    s.temperature,
    sources.map((x) => x.available),
  );
  return calibrations[0].test.map((point, t) => {
    const values = calibrations.map((c) =>
      clip(c.test[t].forecast - c.bias, s),
    );
    const probability = sources.reduce(
      (sum, source, i) =>
        sum +
        weights[i] *
          mean(
            source.residuals.map((r) =>
              Number(clip(values[i] + r, s) >= VARIABLES[s.variable].threshold),
            ),
          ),
      0,
    );
    return {
      x: t,
      label: point.time.slice(5, 10),
      nwp: sources[0].available ? values[0] : null,
      ensemble: sources[1].available ? values[1] : null,
      ai: sources[2].available ? values[2] : null,
      blend: applyTail(values, weights, probability, s.variable).value,
      baseline: mean(values.filter((_, i) => sources[i].available)),
      observed: point.observed,
    };
  });
}
export function comparisonPoints(
  s: Selection,
  mode: ComparisonMode,
  records: ForecastRecord[] = [],
): ComparisonPoint[] {
  if (records.length && mode !== "horizon") return [];
  if (mode === "history") return historicalComparison(s);
  const leads = records.length
    ? Array.from(
        new Set(
          records
            .filter(
              (r) =>
                r.lat === s.cell.lat &&
                r.lon === s.cell.lon &&
                r.variable === s.variable &&
                r.timestamp.slice(0, 10) === s.date,
            )
            .map((r) => r.lead_time),
        ),
      ).sort((a, b) => a - b)
    : Array.from({ length: 40 }, (_, i) => (i + 1) * 6);
  return leads.map((lead) => {
    const f = deriveForecast({ ...s, lead }, records);
    const value = (i: number) =>
      !f.sources[i].available
        ? null
        : mode === "skill"
          ? (f.skill?.sourceErrors[i] ?? null)
          : f.sources[i].corrected;
    return {
      x: lead,
      label: `${lead} h`,
      nwp: value(0),
      ensemble: value(1),
      ai: value(2),
      blend: mode === "skill" ? (f.skill?.adaptive ?? null) : f.value,
      baseline: mode === "skill" ? (f.skill?.baseline ?? null) : f.baseline,
      observed: null,
    };
  });
}
export function comparisonRanking(
  points: ComparisonPoint[],
  mode: ComparisonMode,
) {
  return (["blend", ...SOURCES.map((s) => s.id), "baseline"] as SeriesId[])
    .map((id) => {
      const valid = points.filter(
        (p) => p[id] !== null && (mode !== "history" || p.observed !== null),
      );
      const error =
        mode === "history"
          ? Math.sqrt(mean(valid.map((p) => (p[id]! - p.observed!) ** 2)))
          : mode === "skill"
            ? mean(valid.map((p) => p[id]!))
            : null;
      return { id, error, count: valid.length };
    })
    .filter((r) => r.count > 0)
    .sort((a, b) => (a.error ?? Infinity) - (b.error ?? Infinity));
}
