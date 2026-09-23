import Papa from "papaparse";
import { z } from "zod";
import type { ForecastRecord } from "../../types/forecast";
const number = z
  .string()
  .trim()
  .min(1, "Value is required")
  .transform(Number)
  .pipe(z.number().finite());
const schema = z.object({
  timestamp: z.string().datetime({ offset: true }),
  lat: number.pipe(z.number().min(6).max(37)),
  lon: number.pipe(z.number().min(68).max(98)),
  lead_time: number.pipe(z.number().int().min(6).max(240)),
  source: z.enum(["nwp", "ensemble", "ai"]),
  variable: z.enum(["rainfall", "temperature", "wind"]),
  forecast_value: number,
  observed_value: z.preprocess(
    (v) => (v === "" || v === undefined ? undefined : v),
    number.optional(),
  ),
});
export function parseForecastCsv(text: string): {
  records: ForecastRecord[];
  errors: string[];
} {
  const parsed = Papa.parse<Record<string, string>>(text, {
    header: true,
    skipEmptyLines: "greedy",
    transformHeader: (h) => h.trim(),
  });
  const errors = parsed.errors.map(
    (e) => `Row ${(e.row ?? 0) + 2}: ${e.message}`,
  );
  const records: ForecastRecord[] = [];
  const required = [
    "timestamp",
    "lat",
    "lon",
    "lead_time",
    "source",
    "variable",
    "forecast_value",
  ];
  const missing = required.filter((k) => !parsed.meta.fields?.includes(k));
  if (missing.length)
    return {
      records: [],
      errors: [
        `Missing columns: ${missing.join(", ")}. Download the template for the expected format.`,
      ],
    };
  if (parsed.data.length > 50000)
    return {
      records: [],
      errors: ["Use 50,000 rows or fewer for this browser workflow."],
    };
  const keys = new Set<string>();
  const cycles = new Map<string, string>();
  parsed.data.forEach((row, i) => {
    const r = schema.safeParse(row);
    if (!r.success) {
      errors.push(
        ...r.error.issues.map(
          (x) => `Row ${i + 2}, ${x.path.join(".")}: ${x.message}`,
        ),
      );
      return;
    }
    if (
      r.data.variable !== "temperature" &&
      (r.data.forecast_value < 0 || (r.data.observed_value ?? 0) < 0)
    ) {
      errors.push(`Row ${i + 2}: rainfall and wind values cannot be negative.`);
      return;
    }
    const data = {
      ...r.data,
      timestamp: new Date(r.data.timestamp).toISOString(),
    };
    const date = data.timestamp.slice(0, 10);
    const cycle = cycles.get(date);
    if (cycle && cycle !== data.timestamp) {
      errors.push(
        `Row ${i + 2}: initialization times differ on ${date}. Use one forecast cycle per date so source valid times align.`,
      );
      return;
    }
    cycles.set(date, data.timestamp);
    const key = JSON.stringify([
      data.timestamp.slice(0, 10),
      data.lat,
      data.lon,
      data.lead_time,
      data.source,
      data.variable,
    ]);
    if (keys.has(key)) {
      errors.push(
        `Row ${i + 2}: duplicate source/group or multiple forecast cycles on one date. Use one cycle per date.`,
      );
      return;
    }
    keys.add(key);
    records.push(data);
  });
  if (!parsed.data.length) errors.push("The file has no forecast rows.");
  return { records: errors.length ? [] : records, errors: errors.slice(0, 20) };
}
export function downloadFile(
  name: string,
  content: string,
  type = "text/plain",
) {
  const url = URL.createObjectURL(new Blob([content], { type }));
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
