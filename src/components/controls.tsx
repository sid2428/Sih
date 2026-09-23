import { SlidersHorizontal, RotateCcw } from "lucide-react";
import { useState } from "react";
import { LOCATIONS } from "../data/geography";
import { REGIMES, SOURCES, VARIABLES } from "../data/mock-profile";
import { useForecastStore } from "../store/forecast-store";
import { deriveForecast } from "../lib/blending/engine";
import type { RegimeId, VariableId } from "../types/forecast";
export function Controls({ expanded = false }: { expanded?: boolean }) {
  const [open, setOpen] = useState(expanded);
  const { selection: s, setSelection, records, reset } = useForecastStore();
  const activeSources = deriveForecast(s, records).sources.filter(
    (x) => x.available,
  );
  const presentSources = deriveForecast(
    { ...s, unavailable: [] },
    records,
  ).sources.filter((x) => x.available);
  const groups = Array.from(
    new Map(
      records.map((r) => [
        JSON.stringify([
          r.lat,
          r.lon,
          r.timestamp.slice(0, 10),
          r.lead_time,
          r.variable,
        ]),
        r,
      ]),
    ).entries(),
  );
  return (
    <section className="controls-panel">
      <div className="control-primary">
        {records.length > 0 ? (
          <label>
            Imported forecast group
            <select
              value={JSON.stringify([
                s.cell.lat,
                s.cell.lon,
                s.date,
                s.lead,
                s.variable,
              ])}
              onChange={(e) => {
                const r = groups.find(([key]) => key === e.target.value)?.[1];
                if (r)
                  setSelection({
                    cell: { id: `${r.lat}-${r.lon}`, lat: r.lat, lon: r.lon },
                    location: "Imported location",
                    date: r.timestamp.slice(0, 10),
                    lead: r.lead_time,
                    variable: r.variable,
                    unavailable: [],
                  });
              }}
            >
              {groups.map(([key, r]) => (
                <option key={key} value={key}>
                  {r.lat}°N {r.lon}°E / {r.variable} / {r.lead_time}h /{" "}
                  {r.timestamp.slice(0, 10)}
                </option>
              ))}
            </select>
          </label>
        ) : (
          <>
            <label>
              Location
              <select
                value={
                  LOCATIONS.some((l) => l.name === s.location) ? s.location : ""
                }
                onChange={(e) => {
                  const loc = LOCATIONS.find((l) => l.name === e.target.value);
                  if (loc) setSelection({ cell: loc.cell, location: loc.name });
                }}
              >
                <option value="" disabled>
                  Selected grid cell
                </option>
                {LOCATIONS.map((l) => (
                  <option key={l.name}>{l.name}</option>
                ))}
              </select>
            </label>
            <label>
              Forecast variable
              <select
                value={s.variable}
                onChange={(e) =>
                  setSelection({ variable: e.target.value as VariableId })
                }
              >
                {Object.entries(VARIABLES).map(([key, v]) => (
                  <option value={key} key={key}>
                    {v.label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Lead time
              <select
                value={s.lead}
                onChange={(e) => setSelection({ lead: Number(e.target.value) })}
              >
                {Array.from(
                  new Set([
                    6,
                    12,
                    24,
                    48,
                    72,
                    96,
                    120,
                    144,
                    168,
                    192,
                    216,
                    240,
                    s.lead,
                  ]),
                )
                  .sort((a, b) => a - b)
                  .map((h) => (
                    <option key={h} value={h}>
                      {h} hours {h >= 24 ? `/ Day ${h / 24}` : ""}
                    </option>
                  ))}
              </select>
            </label>
          </>
        )}
        <button
          className={"button quiet advanced-toggle " + (open ? "active" : "")}
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
        >
          <SlidersHorizontal size={15} />
          {open ? "Hide controls" : "Explore parameters"}
        </button>
      </div>
      {open && (
        <div className="advanced-controls">
          <label>
            Forecast cycle date
            <input
              type="date"
              value={s.date}
              disabled={!!records.length}
              onChange={(e) => {
                if (e.target.value) setSelection({ date: e.target.value });
              }}
            />
          </label>
          <label>
            Weather regime
            <select
              value={s.regime}
              onChange={(e) =>
                setSelection({ regime: e.target.value as RegimeId })
              }
            >
              {Object.entries(REGIMES).map(([key, label]) => (
                <option key={key} value={key}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="range-label">
            <span>
              Blend temperature <b>{s.temperature.toFixed(2)}</b>
            </span>
            <input
              aria-label="Blend temperature"
              type="range"
              min="0.1"
              max="2"
              step="0.05"
              value={s.temperature}
              onChange={(e) =>
                setSelection({ temperature: Number(e.target.value) })
              }
            />
            <span className="range-extents">
              <span>Decisive</span>
              <span>Distributed</span>
            </span>
          </label>
          <fieldset className="availability">
            <legend>Available inputs</legend>
            {SOURCES.map((source) => (
              <label key={source.id}>
                <input
                  type="checkbox"
                  checked={activeSources.some((x) => x.id === source.id)}
                  disabled={
                    !presentSources.some((x) => x.id === source.id) ||
                    (activeSources.length === 1 &&
                      activeSources[0].id === source.id)
                  }
                  onChange={(e) =>
                    setSelection({
                      unavailable: e.target.checked
                        ? s.unavailable.filter((id) => id !== source.id)
                        : [...s.unavailable, source.id],
                    })
                  }
                />
                {source.short}
              </label>
            ))}
          </fieldset>
          <button
            className="icon-button"
            title="Reset briefing"
            aria-label="Reset briefing"
            onClick={reset}
          >
            <RotateCcw size={16} />
          </button>
        </div>
      )}
    </section>
  );
}
