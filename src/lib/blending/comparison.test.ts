import { describe, expect, it } from "vitest";
import { INITIAL, PRESETS } from "../../data/presets";
import { deriveForecast } from "./engine";
import {
  comparisonPoints,
  comparisonRanking,
  historicalComparison,
} from "./comparison";
import type { ForecastRecord } from "../../types/forecast";

describe("interactive comparison evidence", () => {
  it("uses exactly the engine’s held-out cases and scores for every preset", () => {
    for (const { selection } of PRESETS) {
      const points = historicalComparison(selection);
      const ranking = comparisonRanking(points, "history");
      const skill = deriveForecast(selection).skill!;
      expect(points).toHaveLength(skill.count);
      expect(ranking.find((r) => r.id === "blend")?.error).toBeCloseTo(
        skill.adaptive,
        10,
      );
      expect(ranking.find((r) => r.id === "baseline")?.error).toBeCloseTo(
        skill.baseline,
        10,
      );
      for (const [i, id] of ["nwp", "ensemble", "ai"].entries()) {
        if (!selection.unavailable.includes(id as "nwp" | "ensemble" | "ai"))
          expect(ranking.find((r) => r.id === id)?.error).toBeCloseTo(
            skill.sourceErrors[i],
            10,
          );
      }
    }
  });
  it("excludes unavailable models from the plot and ranking", () => {
    const points = historicalComparison({ ...INITIAL, unavailable: ["ai"] });
    expect(points.every((p) => p.ai === null)).toBe(true);
    expect(
      comparisonRanking(points, "history").some((r) => r.id === "ai"),
    ).toBe(false);
  });
  it("ranks the measured error, not a fixed winner", () => {
    const row = {
      x: 1,
      label: "case",
      nwp: 9,
      ensemble: 13,
      ai: 15,
      blend: 12,
      baseline: 12,
      observed: 10,
    };
    expect(comparisonRanking([row], "history")[0].id).toBe("nwp");
  });
  it("gives horizon values no accuracy rank without observations", () => {
    const points = comparisonPoints(INITIAL, "horizon");
    expect(points).toHaveLength(40);
    expect(points.every((p) => p.observed === null)).toBe(true);
    expect(
      comparisonRanking(points, "horizon").every((r) => r.error === null),
    ).toBe(true);
    expect(points.find((p) => p.x === INITIAL.lead)?.blend).toBe(
      deriveForecast(INITIAL).value,
    );
  });
  it("error-by-lead values equal the engine scores at that lead", () => {
    for (const point of comparisonPoints(INITIAL, "skill"))
      expect(point.blend).toBe(
        deriveForecast({ ...INITIAL, lead: point.x }).skill?.adaptive,
      );
  });
  it("never plots bundled histories or nonexistent leads for uploads", () => {
    const row: ForecastRecord = {
      timestamp: INITIAL.date + "T06:00:00Z",
      lat: INITIAL.cell.lat,
      lon: INITIAL.cell.lon,
      lead_time: 48,
      source: "nwp",
      variable: "rainfall",
      forecast_value: 100,
    };
    const records = [row, { ...row, lead_time: 72, forecast_value: 120 }];
    expect(comparisonPoints(INITIAL, "history", records)).toEqual([]);
    expect(comparisonPoints(INITIAL, "skill", records)).toEqual([]);
    const points = comparisonPoints(INITIAL, "horizon", records);
    expect(points.map((p) => p.x)).toEqual([48, 72]);
    expect(points.map((p) => p.nwp)).toEqual(
      [48, 72].map(
        (lead) =>
          deriveForecast({ ...INITIAL, lead }, records).sources[0].corrected,
      ),
    );
    expect(points.every((p) => p.ai === null && p.ensemble === null)).toBe(
      true,
    );
  });
});
