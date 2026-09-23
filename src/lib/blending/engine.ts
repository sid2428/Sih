import type {
  Forecast,
  ForecastRecord,
  Sample,
  Selection,
  SourceResult,
} from "../../types/forecast";
import {
  PROFILE,
  REGIMES,
  SOURCES,
  VARIABLES,
  regionalFactors,
} from "../../data/mock-profile";

export const mean = (v: number[]) =>
  v.length ? v.reduce((a, b) => a + b, 0) / v.length : 0;
export const quantile = (values: number[], p: number) => {
  const a = [...values].sort((x, y) => x - y);
  return a[Math.min(a.length - 1, Math.floor((a.length - 1) * p))] ?? 0;
};
const clip = (value: number, variable: Selection["variable"]) =>
  variable === "temperature" ? value : Math.max(0, value);
function random(seed: number) {
  let a = seed | 0;
  return () => {
    a += 0x6d2b79f5;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t ^= t + Math.imul(t ^ (t >>> 7), 61 | t);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
function hash(s: string) {
  let h = PROFILE.seed;
  for (const c of s) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return h;
}
export function validTime(s: Selection): Date {
  return new Date(Date.parse(s.date + "T06:00:00Z") + s.lead * 3600000);
}
export function errorScale(s: Selection, index: number): number {
  const region = regionalFactors(s.cell.lat, s.cell.lon)[index];
  const seasonal =
    1 +
    0.13 * Math.cos(((Number(s.date.slice(5, 7)) - 7) * Math.PI) / 6 + index);
  const regime =
    s.regime === "low-pressure-system" && index === 2
      ? 1.3
      : s.regime === "heat-dome" && index === 2
        ? 0.72
        : 1;
  const spatial =
    1 + 0.14 * Math.sin(s.cell.lat * 0.35 + s.cell.lon * 0.2 + index * 2);
  return (
    VARIABLES[s.variable].scale *
    (PROFILE.error[index] + (PROFILE.growth[index] * s.lead) / 24) *
    region *
    seasonal *
    regime *
    spatial
  );
}
function currentSignal(s: Selection): number {
  const spatial = 0.9 + 0.12 * Math.sin(s.cell.lat * 0.7 + s.cell.lon * 0.4);
  const seasonal =
    0.85 + 0.15 * Math.cos(((Number(s.date.slice(5, 7)) - 7) * Math.PI) / 6);
  if (s.variable === "rainfall")
    return PROFILE.rainfallSignal[s.regime] * spatial * seasonal;
  if (s.variable === "temperature")
    return (
      (s.regime === "heat-dome" ? 43 : 31) +
      2 * Math.sin(s.cell.lon) -
      0.16 * (s.cell.lat - 20)
    );
  return (
    (s.regime === "low-pressure-system"
      ? 67
      : s.regime === "quiescent"
        ? 14
        : 32) * spatial
  );
}
const cache = new Map<string, { history: Sample[][]; raw: number[] }>();
/** Generate seeded, correlated historical errors. Later periods never enter calibration. */
function historyFor(s: Selection) {
  const key = JSON.stringify([s.cell.id, s.variable, s.lead, s.date, s.regime]);
  const cached = cache.get(key);
  if (cached) return cached;
  const rng = random(
    hash(
      JSON.stringify([
        regionalFactors(s.cell.lat, s.cell.lon),
        s.variable,
        s.date,
        s.regime,
      ]),
    ),
  );
  const errors = [0, 0, 0];
  const history: Sample[][] = [[], [], []];
  for (let t = 0; t < PROFILE.history; t++) {
    const u = rng();
    const scale = VARIABLES[s.variable].scale;
    const observed = clip(
      s.variable === "rainfall"
        ? 4 + u * u * 130 + (t % 17 === 0 ? 65 : 0)
        : s.variable === "temperature"
          ? 28 + u * 17
          : 8 + u * 74,
      s.variable,
    );
    // End every historical valid window before the selected initialization.
    const time = new Date(
      Date.parse(s.date + "T06:00:00Z") - (PROFILE.history - t + 12) * 86400000,
    ).toISOString();
    for (let i = 0; i < 3; i++) {
      const noise = (rng() + rng() + rng() + rng() - 2) * 1.73;
      errors[i] =
        PROFILE.rho * errors[i] + Math.sqrt(1 - PROFILE.rho ** 2) * noise;
      const tailBias =
        s.variable === "rainfall" && observed > 90
          ? -[0.12, 0.58, 0.26][i] * (observed - 60)
          : 0;
      history[i].push({
        observed,
        forecast: clip(
          observed +
            PROFILE.bias[i] * scale +
            errors[i] * errorScale(s, i) +
            tailBias,
          s.variable,
        ),
        time,
      });
    }
  }
  const signal = currentSignal(s);
  const raw = SOURCES.map((_, i) =>
    clip(
      signal +
        PROFILE.bias[i] * VARIABLES[s.variable].scale +
        errors[i] * errorScale(s, i) * 0.22 -
        (s.variable === "rainfall"
          ? Math.max(signal - 60, 0) * PROFILE.currentStormAttenuation[i]
          : 0),
      s.variable,
    ),
  );
  const result = { history, raw };
  if (cache.size > 2500) cache.clear();
  cache.set(key, result);
  return result;
}
/** Stable softmax of normalized error costs; unavailable sources have zero influence. */
export function softmax(
  costs: number[],
  temperature: number,
  available: boolean[],
): number[] {
  if (!available.some(Boolean)) return costs.map(() => 0);
  const minimum = Math.min(...costs.filter((_, i) => available[i]));
  const exps = costs.map((c, i) =>
    available[i] ? Math.exp(-(c - minimum) / Math.max(0.08, temperature)) : 0,
  );
  const sum = exps.reduce((a, b) => a + b, 0);
  return exps.map((e) => e / sum);
}
/** Fit mean bias on the first period. Score its corrected output on a later period. */
function calibrate(history: Sample[], variable: Selection["variable"]) {
  const cut = Math.floor(history.length * 0.6),
    end = Math.floor(history.length * 0.8);
  const fit = history.slice(0, cut);
  const validate = history.slice(cut, end);
  const test = history.slice(end);
  const temporalWeights = fit.map((_, i) => Math.exp((i - fit.length) / 30));
  const sum = temporalWeights.reduce((a, b) => a + b, 0);
  const bias =
    fit.reduce(
      (a, b, i) => a + (b.forecast - b.observed) * temporalWeights[i],
      0,
    ) / (sum || 1);
  const residuals = validate.map(
    (p) => p.observed - clip(p.forecast - bias, variable),
  );
  const mse = mean(residuals.map((r) => r * r));
  const meta = VARIABLES[variable];
  const missRate = mean(
    validate.map((p) =>
      Number(
        clip(p.forecast - bias, variable) >= meta.threshold !==
          p.observed >= meta.threshold,
      ),
    ),
  );
  return {
    bias,
    residuals,
    rmse: Math.sqrt(mse),
    cost:
      mse / meta.scale ** 2 + (variable === "rainfall" ? 0.65 * missRate : 0),
    test,
  };
}
/** A bounded rainfall-only safeguard. It never chooses a maximum unconditionally. */
export function applyTail(
  values: number[],
  weights: number[],
  probability: number,
  variable: Selection["variable"],
) {
  const active = values.filter((_, i) => weights[i] > 0);
  const threshold = VARIABLES[variable].threshold;
  const agreement = active.filter((v) => v >= threshold).length;
  const routine = values.reduce((a, b, i) => a + b * weights[i], 0);
  const strength =
    variable === "rainfall" && agreement >= 2 && probability >= PROFILE.tailGate
      ? Math.min(PROFILE.tailMaximum, (probability - PROFILE.tailGate) * 0.8)
      : 0;
  const sorted = values
    .map((v, i) => ({ v, w: weights[i] }))
    .filter((x) => x.w > 0)
    .sort((a, b) => a.v - b.v);
  let sum = 0;
  let upper = routine;
  for (const x of sorted) {
    sum += x.w;
    if (sum >= 0.85) {
      upper = x.v;
      break;
    }
  }
  return {
    routine,
    value: routine + strength * Math.max(upper - routine, 0),
    strength,
    agreement,
  };
}
export function prepareForecast(s: Selection, records: ForecastRecord[] = []) {
  const bundled = historyFor(s);
  const meta = VARIABLES[s.variable];
  const current = records.filter(
    (r) =>
      r.lat === s.cell.lat &&
      r.lon === s.cell.lon &&
      r.variable === s.variable &&
      r.lead_time === s.lead &&
      r.timestamp.slice(0, 10) === s.date,
  );
  const uploaded = records.length > 0;
  const init =
    uploaded && current.length
      ? Date.parse(current[0].timestamp)
      : Date.parse(s.date + "T06:00:00Z");
  const histories = SOURCES.map((src, i) =>
    uploaded
      ? records
          .filter(
            (r) =>
              r.source === src.id &&
              r.lat === s.cell.lat &&
              r.lon === s.cell.lon &&
              r.variable === s.variable &&
              r.lead_time === s.lead &&
              r.observed_value !== undefined &&
              Date.parse(r.timestamp) +
                (r.lead_time + (r.variable === "rainfall" ? 24 : 0)) * 3600000 <
                init,
          )
          .sort((a, b) => Date.parse(a.timestamp) - Date.parse(b.timestamp))
          .map((r) => ({
            observed: r.observed_value!,
            forecast: r.forecast_value,
            time: r.timestamp,
          }))
      : bundled.history[i],
  );
  const calibrations = histories.map((h, i) =>
    h.length >= 20
      ? calibrate(h, s.variable)
      : calibrate(bundled.history[i], s.variable),
  );
  const sources: SourceResult[] = SOURCES.map((src, i) => {
    const c = calibrations[i],
      record = current.find((r) => r.source === src.id);
    const raw = uploaded ? (record?.forecast_value ?? 0) : bundled.raw[i];
    const corrected = clip(raw - c.bias, s.variable);
    const probability = mean(
      c.residuals.map((r) =>
        Number(clip(corrected + r, s.variable) >= meta.threshold),
      ),
    );
    return {
      id: src.id,
      raw,
      corrected,
      weight: 0,
      bias: c.bias,
      cost: c.cost,
      rmse: c.rmse,
      probability,
      samples: histories[i].length,
      available: !s.unavailable.includes(src.id) && (!uploaded || !!record),
      residuals: c.residuals,
    };
  });
  return { sources, calibrations, histories, current, uploaded };
}

export function deriveForecast(
  s: Selection,
  records: ForecastRecord[] = [],
): Forecast {
  const { sources, calibrations, histories, current, uploaded } =
    prepareForecast(s, records);
  const meta = VARIABLES[s.variable];
  const weights = softmax(
    sources.map((x) => x.cost),
    s.temperature,
    sources.map((x) => x.available),
  );
  sources.forEach((x, i) => (x.weight = weights[i]));
  const active = sources.filter((x) => x.available);
  const probability = sources.reduce((a, b) => a + b.weight * b.probability, 0);
  const tail = applyTail(
    sources.map((x) => x.corrected),
    weights,
    probability,
    s.variable,
  );
  // Inverse CDF of a weighted mixture of validation residual distributions.
  const mixture = sources
    .flatMap((x) =>
      x.available
        ? x.residuals.map((r) => ({
            v: clip(x.corrected + r, s.variable),
            w: x.weight / x.residuals.length,
          }))
        : [],
    )
    .sort((a, b) => a.v - b.v);
  function mixtureQuantile(p: number) {
    let sum = 0;
    for (const x of mixture) {
      sum += x.w;
      if (sum >= p) return x.v;
    }
    return mixture.at(-1)?.v ?? 0;
  }
  let skill: Forecast["skill"] = null;
  if (!uploaded && active.length > 0) {
    const baselineErrors: number[] = [],
      adaptiveErrors: number[] = [];
    const sourceErrors: number[][] = [[], [], []];
    for (let t = 0; t < calibrations[0].test.length; t++) {
      const values = calibrations.map((c) =>
        clip(c.test[t].forecast - c.bias, s.variable),
      );
      const p = sources.reduce(
        (a, x, i) =>
          a +
          x.weight *
            mean(
              x.residuals.map((r) =>
                Number(clip(values[i] + r, s.variable) >= meta.threshold),
              ),
            ),
        0,
      );
      const blended = applyTail(values, weights, p, s.variable).value;
      const observed = calibrations[0].test[t].observed;
      values.forEach((v, i) => sourceErrors[i].push((v - observed) ** 2));
      baselineErrors.push(
        (mean(values.filter((_, i) => sources[i].available)) - observed) ** 2,
      );
      adaptiveErrors.push((blended - observed) ** 2);
    }
    const baseline = Math.sqrt(mean(baselineErrors)),
      adaptive = Math.sqrt(mean(adaptiveErrors));
    skill = {
      baseline,
      adaptive,
      improvement: baseline > 0 ? (1 - adaptive / baseline) * 100 : 0,
      count: baselineErrors.length,
      sourceErrors: sourceErrors.map((errors) => Math.sqrt(mean(errors))),
    };
  }
  const sorted = [...active].sort((a, b) => b.weight - a.weight);
  const leader = sorted[0];
  const confidence =
    active.length < 3 || sources.some((x) => x.available && x.samples < 20)
      ? "Limited"
      : mixtureQuantile(0.9) - mixtureQuantile(0.1) > meta.scale * 2.5
        ? "Moderate"
        : "High";
  const reasons = [
    leader
      ? `${SOURCES.find((x) => x.id === leader.id)!.name} leads at ${Math.round(leader.weight * 100)}% with the lowest adjusted recent error for this ${s.lead}-hour forecast.`
      : "No sources are available. Restore an input to calculate guidance.",
    tail.strength > 0
      ? `${tail.agreement} sources exceed ${meta.threshold} ${meta.unit}. The rainfall tail guard adds ${(tail.value - tail.routine).toFixed(1)} ${meta.unit} to the central blend.`
      : `${REGIMES[s.regime]} and ${s.lead / 24 < 1 ? "sub-day" : `day-${(s.lead / 24).toFixed(0)}`} lead-time error profiles inform these weights.`,
    active.length < 3
      ? `${3 - active.length} input(s) unavailable. Remaining weights are normalized; confidence is limited.`
      : uploaded
        ? "Uploaded values use only earlier matching observations where sufficient history exists; otherwise the bundled calibration prior applies."
        : `Skill comparison uses ${skill?.count ?? 0} held-out cases that never entered bias fitting or weight selection.`,
  ];
  return {
    sources,
    value: tail.value,
    routine: tail.routine,
    baseline: mean(active.map((x) => x.corrected)),
    probability,
    lower: mixtureQuantile(0.1),
    upper: mixtureQuantile(0.9),
    threshold: meta.threshold,
    confidence,
    risk:
      probability >= 0.7
        ? "High"
        : probability >= 0.35
          ? "Elevated"
          : "Monitor",
    agreement: tail.agreement,
    tailStrength: tail.strength,
    reasons,
    skill,
    mode: uploaded ? "upload" : "demo",
    historyStart: histories.flat()[0]?.time ?? "No local history",
    historyEnd: histories.flat().at(-1)?.time ?? "Bundled prior",
    coverage: uploaded
      ? `${current.length} of 3 sources in selected group`
      : "120 historical cases per source",
  };
}
