import { useMemo, useState } from "react";
import { geoIdentity, geoPath } from "d3";
import { Crosshair, Minus, Plus, Maximize2 } from "lucide-react";
import { CELLS, INDIA, LOCATIONS } from "../data/geography";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { deriveForecast } from "../lib/blending/engine";
import { useForecastStore } from "../store/forecast-store";
import { useRunStore } from "../store/run-store";
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
  const run = useRunStore();
  const [zoom, setZoom] = useState(1);
  const [hover, setHover] = useState<Cell | null>(null);

  const unit = VARIABLES[selection.variable]?.unit ?? "mm";

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

  // Active radar scan color matching active agent
  const activeAgentColor = useMemo(() => {
    if (run.agents.nwp === "processing" || run.agents.nwp === "sending")
      return SOURCES[0].color;
    if (
      run.agents.ensemble === "processing" ||
      run.agents.ensemble === "sending"
    )
      return SOURCES[1].color;
    if (run.agents.ai === "processing" || run.agents.ai === "sending")
      return SOURCES[2].color;
    if (run.agents.blend === "blending" || run.agents.blend === "receiving")
      return "#a5adff";
    if (run.status === "complete") return "#75d4b3";
    return "#a5adff";
  }, [run.agents, run.status]);

  const statusDetail = useMemo(() => {
    if (run.status === "running") {
      if (run.agents.nwp === "processing" || run.agents.nwp === "sending") {
        return `Physics Agent analyzing atmospheric dynamics for ${selection.location}…`;
      }
      if (
        run.agents.ensemble === "processing" ||
        run.agents.ensemble === "sending"
      ) {
        return `Ensemble Agent evaluating member spread & uncertainty…`;
      }
      if (run.agents.ai === "processing" || run.agents.ai === "sending") {
        return `AI Pattern Agent matching historical neural analogs…`;
      }
      if (run.agents.blend === "blending" || run.agents.blend === "receiving") {
        return `Blending Agent synthesizing dynamic weights…`;
      }
      if (run.agents.output === "generating") {
        return `Checking extreme thresholds & formatting guidance…`;
      }
      return `Agents simulating forecast for ${selection.location}…`;
    }
    if (run.status === "complete") {
      return run.result
        ? `Consensus guidance resolved: ${run.result.value.toFixed(1)} ${unit} · Iteration #${run.iteration}`
        : `Forecast guidance complete`;
    }
    if (run.status === "stale") {
      return `Parameters modified for ${selection.location} · Ready for Iteration #${run.iteration + 1}`;
    }
    if (hover) {
      return `Select grid cell (${hover.lat.toFixed(1)}°N, ${hover.lon.toFixed(1)}°E)`;
    }
    return selection.location;
  }, [
    run.status,
    run.agents,
    run.result,
    run.iteration,
    selection.location,
    unit,
    hover,
  ]);
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
        {/* Simulation Iteration Overlay Badge */}
        {run.status !== "idle" && (
          <div className={`map-sim-badge ${run.status}`}>
            <span className="badge-run-dot" />
            <span className="badge-run-text">
              {run.status === "running"
                ? `SIMULATION RUN 0${run.iteration || 1}`
                : run.status === "complete"
                  ? `FORECAST ITERATION 0${run.iteration || 1}`
                  : `ITERATION 0${run.iteration || 1} · ${run.status.toUpperCase()}`}
            </span>
          </div>
        )}

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
                const isSelectedCell = cell.id === selection.cell.id;
                const isAgentActive =
                  run.status === "running" &&
                  (run.agents[leader.id] === "processing" ||
                    run.agents[leader.id] === "sending");
                const isBlendPhase =
                  run.status === "running" &&
                  (run.agents.blend === "blending" ||
                    run.agents.blend === "receiving");

                return (
                  <rect
                    key={cell.id}
                    x={p[0]}
                    y={p[1]}
                    width={q[0] - p[0]}
                    height={q[1] - p[1]}
                    rx=".8"
                    className={`grid-cell ${isSelectedCell ? "selected" : ""} ${isAgentActive ? "agent-evaluating-cell" : ""} ${isBlendPhase && contested ? "contested-evaluating-cell" : ""}`}
                    fill={
                      contested
                        ? "url(#contested)"
                        : SOURCES.find((s) => s.id === leader.id)!.color
                    }
                    opacity={
                      records.length
                        ? 0.18
                        : isSelectedCell
                          ? 0.95
                          : isAgentActive
                            ? 0.78
                            : 0.38 + leader.weight * 0.4
                    }
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

            {/* Concentric radar rings during live simulation */}
            {run.status === "running" && (
              <g className="map-radar-group">
                <circle
                  cx={selected[0]}
                  cy={selected[1]}
                  r="14"
                  className="map-radar-ring map-radar-ring-1"
                  stroke={activeAgentColor}
                />
                <circle
                  cx={selected[0]}
                  cy={selected[1]}
                  r="26"
                  className="map-radar-ring map-radar-ring-2"
                  stroke={activeAgentColor}
                />
                <circle
                  cx={selected[0]}
                  cy={selected[1]}
                  r="40"
                  className="map-radar-ring map-radar-ring-3"
                  stroke={activeAgentColor}
                />
              </g>
            )}

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

            {/* Final forecast result callout badge anchored to the selected grid cell */}
            {run.status === "complete" && run.result && (
              <g
                className="map-forecast-callout"
                transform={`translate(${Math.min(selected[0] + 14, 460)}, ${Math.max(selected[1] - 42, 28)})`}
              >
                <rect
                  width="134"
                  height="44"
                  rx="6"
                  fill="#0c1422fa"
                  stroke="#75d4b3"
                  strokeWidth="1.2"
                />
                <circle cx="12" cy="14" r="3" fill="#75d4b3" />
                <text
                  x="20"
                  y="17"
                  fill="#75d4b3"
                  fontSize="8.5"
                  fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                  letterSpacing="0.4px"
                >
                  ITERATION 0{run.iteration || 1} GUIDANCE
                </text>
                <text
                  x="12"
                  y="34"
                  fill="#ffffff"
                  fontSize="13"
                  fontWeight="700"
                  fontFamily="'IBM Plex Mono', monospace"
                >
                  {run.result.value.toFixed(1)} {unit}
                </text>
                <text
                  x="82"
                  y="34"
                  fill="#8ba2be"
                  fontSize="8"
                  fontFamily="'IBM Plex Mono', monospace"
                >
                  {run.result.confidence} conf
                </text>
              </g>
            )}

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
          <span>{statusDetail}</span>
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
