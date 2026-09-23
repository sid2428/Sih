import { useMemo, useState } from "react";
import { geoIdentity, geoPath } from "d3";
import { Crosshair, Minus, Plus, Maximize2 } from "lucide-react";
import { CELLS, INDIA, LOCATIONS } from "../data/geography";
import { SOURCES } from "../data/mock-profile";
import { deriveForecast } from "../lib/blending/engine";
import { useForecastStore } from "../store/forecast-store";
import type { Cell } from "../types/forecast";
const projection = geoIdentity()
  .reflectY(true)
  .fitExtent(
    [
      [72, 25],
      [560, 420],
    ],
    INDIA,
  );
const path = geoPath(projection);
const xy = (lon: number, lat: number) => projection([lon, lat]) ?? [0, 0];
export default function IndiaMap() {
  const { selection, setSelection, records } = useForecastStore();
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<Cell | null>(null);
  const cells = useMemo(
    () =>
      CELLS.map((cell) => {
        const f = deriveForecast({ ...selection, cell });
        const sorted = [...f.sources].sort((a, b) => b.weight - a.weight);
        return {
          cell,
          leader: sorted[0],
          contested: sorted[0].weight - sorted[1].weight < 0.08,
        };
      }),
    [selection],
  );
  const selected = xy(selection.cell.lon, selection.cell.lat);
  function select(cell: Cell) {
    if (records.length) return;
    const loc = LOCATIONS.find((l) => l.cell.id === cell.id);
    setSelection({
      cell,
      location:
        loc?.name ?? `Grid ${cell.lat.toFixed(1)}°N, ${cell.lon.toFixed(1)}°E`,
    });
  }
  return (
    <section className="map-panel panel" aria-label="India forecast source map">
      <div className="panel-heading">
        <div>
          <h2>Regional intelligence</h2>
          <p>Dominant forecast source across India</p>
        </div>
        <span className="subtle-tag">1° grid</span>
      </div>
      <div className="map-stage">
        <div className="map-tools">
          <button
            aria-label="Zoom in"
            onClick={() => setZoom((z) => Math.min(1.6, z + 0.15))}
          >
            <Plus size={15} />
          </button>
          <button
            aria-label="Zoom out"
            onClick={() => setZoom((z) => Math.max(0.8, z - 0.15))}
          >
            <Minus size={15} />
          </button>
          <button aria-label="Reset map view" onClick={() => setZoom(1)}>
            <Maximize2 size={14} />
          </button>
        </div>
        <svg
          className="india-map"
          viewBox="0 0 630 455"
          role="group"
          aria-label="Select a one-degree forecast cell"
        >
          <defs>
            <pattern
              id="contested"
              width="5"
              height="5"
              patternUnits="userSpaceOnUse"
            >
              <rect width="5" height="5" fill="#27313d" />
              <path d="M0 5 5 0" stroke="#586172" strokeWidth=".7" />
            </pattern>
            <clipPath id="india-clip">
              <path d={path(INDIA) ?? ""} />
            </clipPath>
          </defs>
          <g className="graticule">
            {[70, 75, 80, 85, 90, 95].map((lon) => (
              <g key={lon}>
                <path d={`M${xy(lon, 6).join(",")}L${xy(lon, 37).join(",")}`} />
                <text x={xy(lon, 6)[0]} y={442}>
                  {lon}°E
                </text>
              </g>
            ))}
            {[10, 15, 20, 25, 30, 35].map((lat) => (
              <g key={lat}>
                <path
                  d={`M${xy(66, lat).join(",")}L${xy(100, lat).join(",")}`}
                />
                <text x="16" y={xy(66, lat)[1] + 4}>
                  {lat}°N
                </text>
              </g>
            ))}
          </g>
          <g
            transform={`translate(315,225) scale(${zoom}) translate(-315,-225)`}
          >
            <path className="india-base" d={path(INDIA) ?? ""} />
            <g clipPath="url(#india-clip)">
              {cells.map(({ cell, leader, contested }) => {
                const p = xy(cell.lon - 0.46, cell.lat + 0.46);
                const q = xy(cell.lon + 0.46, cell.lat - 0.46);
                return (
                  <rect
                    key={cell.id}
                    x={p[0]}
                    y={p[1]}
                    width={q[0] - p[0]}
                    height={q[1] - p[1]}
                    rx=".8"
                    className="grid-cell"
                    fill={
                      contested
                        ? "url(#contested)"
                        : SOURCES.find((s) => s.id === leader.id)!.color
                    }
                    opacity={records.length ? 0.18 : 0.38 + leader.weight * 0.4}
                    tabIndex={records.length ? -1 : 0}
                    role="button"
                    aria-label={`Grid ${cell.lat} north ${cell.lon} east, ${contested ? "contested" : leader.id + " dominant"}`}
                    onClick={() => select(cell)}
                    onKeyDown={(e) => {
                      if (e.key === "Enter" || e.key === " ") {
                        e.preventDefault();
                        select(cell);
                      }
                    }}
                    onMouseEnter={() => setHover(cell)}
                    onMouseLeave={() => setHover(null)}
                  >
                    <title>
                      {cell.lat}°N, {cell.lon}°E ·{" "}
                      {contested ? "Contested" : leader.id} ·{" "}
                      {(leader.weight * 100).toFixed(0)}%
                    </title>
                  </rect>
                );
              })}
            </g>
            <path className="india-border" d={path(INDIA) ?? ""} />
            {LOCATIONS.map((l) => {
              const p = xy(l.cell.lon, l.cell.lat);
              const isSelected = l.cell.id === selection.cell.id;
              return (
                <g
                  key={l.name}
                  className={"map-location " + (isSelected ? "selected" : "")}
                  onClick={() => select(l.cell)}
                >
                  <circle cx={p[0]} cy={p[1]} r={isSelected ? 4 : 2.7} />
                  <text x={p[0] + 9} y={p[1] - 6}>
                    {l.name}
                  </text>
                </g>
              );
            })}
            <circle
              cx={selected[0]}
              cy={selected[1]}
              r="11"
              className="selection-ring"
            />
            <path
              d={`M${selected[0] - 17},${selected[1]}h8m18,0h8M${selected[0]},${selected[1] - 17}v8m0,18v8`}
              stroke="#eef2ff"
              strokeWidth="1"
            />
            <text className="country-label" x={xy(69, 29)[0]} y={xy(69, 29)[1]}>
              PAKISTAN
            </text>
            <text className="country-label" x={xy(84, 34)[0]} y={xy(84, 34)[1]}>
              CHINA
            </text>
            <text
              className="country-label"
              x={xy(83, 28.8)[0]}
              y={xy(83, 28.8)[1]}
            >
              NEPAL
            </text>
            <text
              className="ocean-label"
              x={xy(68.5, 15)[0]}
              y={xy(68.5, 15)[1]}
            >
              Arabian Sea
            </text>
            <text className="ocean-label" x={xy(84, 15)[0]} y={xy(84, 15)[1]}>
              Bay of Bengal
            </text>
          </g>
        </svg>
        <div className="map-coordinate">
          <Crosshair size={13} />
          <span>
            {(hover ?? selection.cell).lat.toFixed(1)}° N &nbsp;{" "}
            {(hover ?? selection.cell).lon.toFixed(1)}° E
          </span>
          <span>{hover ? "Select grid cell" : selection.location}</span>
        </div>
      </div>
      <div className="map-legend">
        {SOURCES.map((s) => (
          <span key={s.id}>
            <i style={{ background: s.color }} />
            {s.short}
          </span>
        ))}
        <span>
          <i className="contested-key" />
          Contested
        </span>
        <span className="map-legend-note">
          {records.length
            ? "Imported point selected"
            : "Select a cell to explore"}
        </span>
      </div>
    </section>
  );
}
