import { describe, expect, it } from "vitest";
import { deriveForecast, softmax, applyTail } from "./engine";
import { INITIAL, PRESETS } from "../../data/presets";
import { CELLS, LOCATIONS } from "../../data/geography";
import { parseForecastCsv } from "../csv/parse";
import type { ForecastRecord } from "../../types/forecast";

describe("forecast invariants", () => {
  it("builds a coarse Indian grid and snaps all named locations", () => {
    expect(CELLS.length).toBeGreaterThan(200);
    for (const l of LOCATIONS) {
      expect(CELLS).toContainEqual(l.cell);
      expect(Math.abs(l.cell.lat - l.lat)).toBeLessThan(1.5);
      expect(Math.abs(l.cell.lon - l.lon)).toBeLessThan(1.5);
    }
  });
  it("keeps weights normalized and guidance finite across regimes, variables and leads", () => {
    for (const preset of PRESETS)
      for (const lead of [6, 48, 144, 240]) {
        const f = deriveForecast({ ...preset.selection, lead });
        expect(f.sources.reduce((a, b) => a + b.weight, 0)).toBeCloseTo(1, 12);
        expect(f.sources.every((s) => s.weight >= 0)).toBe(true);
        expect(Number.isFinite(f.value)).toBe(true);
        expect(f.probability).toBeGreaterThanOrEqual(0);
        expect(f.probability).toBeLessThanOrEqual(1);
        expect(f.lower).toBeLessThanOrEqual(f.upper);
      }
  });
  it("is reproducible", () =>
    expect(deriveForecast(INITIAL)).toEqual(deriveForecast({ ...INITIAL })));
  it("removes unavailable sources and limits confidence", () => {
    const f = deriveForecast({ ...INITIAL, unavailable: ["ai", "ensemble"] });
    expect(f.sources.map((s) => s.weight)).toEqual([1, 0, 0]);
    expect(f.confidence).toBe("Limited");
    expect(f.tailStrength).toBe(0);
  });
  it("changes the winning source with forecast horizon", () => {
    const a = deriveForecast({ ...INITIAL, lead: 6 });
    const b = deriveForecast({ ...INITIAL, lead: 240 });
    expect(a.sources[2].weight).toBeGreaterThan(b.sources[2].weight);
    expect(b.sources[0].weight).toBeGreaterThan(a.sources[0].weight);
  });
  it("flattens weights as temperature increases without changing source values", () => {
    const cold = deriveForecast({ ...INITIAL, temperature: 0.1 });
    const warm = deriveForecast({ ...INITIAL, temperature: 2 });
    expect(Math.max(...warm.sources.map((s) => s.weight))).toBeLessThan(
      Math.max(...cold.sources.map((s) => s.weight)),
    );
    expect(warm.sources.map((s) => s.corrected)).toEqual(
      cold.sources.map((s) => s.corrected),
    );
  });
  it("handles large costs stably and returns no weight if all sources are missing", () => {
    expect(
      softmax([10000, 10001, 10002], 0.5, [true, false, true]).reduce(
        (a, b) => a + b,
        0,
      ),
    ).toBeCloseTo(1);
    expect(softmax([1, 2, 3], 1, [false, false, false])).toEqual([0, 0, 0]);
  });
  it("does not activate tail guidance without both evidence and agreement", () => {
    expect(
      applyTail([100, 30, 20], [0.5, 0.25, 0.25], 0.9, "rainfall").strength,
    ).toBe(0);
    expect(
      applyTail([100, 90, 20], [0.5, 0.25, 0.25], 0.4, "rainfall").strength,
    ).toBe(0);
    expect(
      applyTail([100, 90, 20], [0.5, 0.25, 0.25], 0.9, "temperature").strength,
    ).toBe(0);
    const f = applyTail([100, 90, 20], [0.5, 0.25, 0.25], 0.9, "rainfall");
    expect(f.strength).toBeGreaterThan(0);
    expect(f.strength).toBeLessThanOrEqual(0.35);
    expect(f.value).toBeGreaterThanOrEqual(f.routine);
  });
  it("evaluates on 24 held-out cases and does not invent positive improvement", () => {
    const f = deriveForecast(INITIAL);
    expect(f.skill?.count).toBe(24);
    expect(f.skill?.improvement).toBeCloseTo(
      (1 - f.skill!.adaptive / f.skill!.baseline) * 100,
    );
  });
});

describe("uploaded forecasts", () => {
  const row: ForecastRecord = {
    timestamp: "2026-07-18T06:00:00Z",
    lat: INITIAL.cell.lat,
    lon: INITIAL.cell.lon,
    lead_time: 48,
    source: "nwp",
    variable: "rainfall",
    forecast_value: 150,
  };
  it("uses uploaded current values and removes absent sources", () => {
    const f = deriveForecast(INITIAL, [row]);
    expect(f.sources[0].raw).toBe(150);
    expect(f.sources.map((s) => s.weight)).toEqual([1, 0, 0]);
    expect(f.skill).toBeNull();
  });
  it("cannot learn from the current observation or future observations", () => {
    const before = deriveForecast(INITIAL, [row]);
    const after = deriveForecast(INITIAL, [
      { ...row, observed_value: 9999 },
      { ...row, timestamp: "2026-08-01T06:00:00Z", observed_value: 9999 },
    ]);
    expect(before.sources[0].bias).toBe(after.sources[0].bias);
    expect(before.value).toBe(after.value);
  });
  it("learns bias from earlier matching observations when enough history exists", () => {
    const history = Array.from({ length: 30 }, (_, i) => ({
      ...row,
      timestamp: new Date(Date.UTC(2026, 4, i + 1, 6)).toISOString(),
      forecast_value: 70,
      observed_value: 50,
    }));
    const f = deriveForecast(INITIAL, [...history, row]);
    expect(f.sources[0].samples).toBe(30);
    expect(f.sources[0].bias).toBeCloseTo(20);
    expect(f.value).toBeCloseTo(130);
  });
});

describe("CSV validation", () => {
  const headers =
    "timestamp,lat,lon,lead_time,source,variable,forecast_value,observed_value\n";
  const good = "2026-07-18T06:00:00Z,19.5,73.5,48,nwp,rainfall,100,";
  it("accepts forecast-only data and optional observations", () => {
    expect(parseForecastCsv(headers + good).records[0].forecast_value).toBe(
      100,
    );
    expect(
      parseForecastCsv(headers + good + "90").records[0].observed_value,
    ).toBe(90);
  });
  it("rejects mixing forecast cycles across sources on one date", () => {
    const mixed =
      headers +
      good +
      "\n" +
      good.replace("06:00:00", "12:00:00").replace("nwp", "ai");
    expect(parseForecastCsv(mixed).errors.join(" ")).toContain(
      "initialization times differ",
    );
  });
  it("rejects missing schemas, empty numeric values, invalid IDs, negative rain, and duplicate groups", () => {
    for (const csv of [
      "a,b\n1,2",
      headers + good.replace("19.5", ""),
      headers + good.replace("nwp", "unknown"),
      headers + good.replace(",100,", ",-1,"),
      headers + good + "\n" + good,
    ])
      expect(parseForecastCsv(csv).errors.length).toBeGreaterThan(0);
  });
});
