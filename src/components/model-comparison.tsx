import { useEffect, useMemo, useRef, useState } from "react";
import { init, use } from "echarts/core";
import type { EChartsType } from "echarts/core";
import type { EChartsOption } from "echarts";
import { LineChart } from "echarts/charts";
import {
  AriaComponent,
  DataZoomComponent,
  GridComponent,
  MarkLineComponent,
  TooltipComponent,
} from "echarts/components";
import { CanvasRenderer } from "echarts/renderers";
import {
  ArrowDownRight,
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  Check,
  ChevronDown,
  Crosshair,
  Download,
  Expand,
  Pause,
  Play,
  RotateCcw,
} from "lucide-react";
import { Controls } from "./controls";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { useForecastStore } from "../store/forecast-store";
import {
  comparisonPoints,
  comparisonRanking,
} from "../lib/blending/comparison";
import type { ComparisonMode, SeriesId } from "../lib/blending/comparison";
import { downloadFile } from "../lib/csv/parse";
import { deriveForecast } from "../lib/blending/engine";
use([
  LineChart,
  GridComponent,
  TooltipComponent,
  DataZoomComponent,
  MarkLineComponent,
  AriaComponent,
  CanvasRenderer,
]);
const SERIES: { id: SeriesId; label: string; color: string; dash?: boolean }[] =
  [
    { id: "nwp", label: "Physics-based NWP", color: SOURCES[0].color },
    { id: "ensemble", label: "Ensemble guidance", color: SOURCES[1].color },
    { id: "ai", label: "AI pattern model", color: SOURCES[2].color },
    { id: "baseline", label: "Equal average", color: "#8190a6", dash: true },
    { id: "blend", label: "Adaptive blend", color: "#f0c77b" },
    { id: "observed", label: "Observed", color: "#eff2f8", dash: true },
  ];
const MODES: { id: ComparisonMode; label: string; description: string }[] = [
  {
    id: "history",
    label: "Historical replay",
    description: "24 held-out weather cases · forecast vs observation",
  },
  {
    id: "horizon",
    label: "Forecast horizon",
    description: "Source forecasts across available lead times",
  },
  {
    id: "skill",
    label: "Error by lead",
    description: "Held-out root-mean-square error · lower is better",
  },
];
export default function ModelComparison() {
  const { selection, records, setView } = useForecastStore();
  const meta = VARIABLES[selection.variable];
  const [mode, setMode] = useState<ComparisonMode>(
    records.length ? "horizon" : "history",
  );
  const [cursor, setCursor] = useState(0);
  const [playing, setPlaying] = useState(false);
  const [settings, setSettings] = useState(false);
  const [expanded, setExpanded] = useState(false);
  const [visible, setVisible] = useState<SeriesId[]>([
    "nwp",
    "ensemble",
    "ai",
    "blend",
    "baseline",
    "observed",
  ]);
  const chartHost = useRef<HTMLDivElement>(null);
  const chart = useRef<EChartsType | null>(null);
  const pointer = useRef(0);
  pointer.current = cursor;
  const pointLabels = useRef<string[]>([]);
  const effectiveMode = records.length ? "horizon" : mode;
  const points = useMemo(
    () => comparisonPoints(selection, effectiveMode, records),
    [selection, effectiveMode, records],
  );
  pointLabels.current = points.map((p) => p.label);
  const ranking = useMemo(
    () =>
      comparisonRanking(points, effectiveMode).filter(
        (row) =>
          effectiveMode !== "horizon" || SOURCES.some((s) => s.id === row.id),
      ),
    [points, effectiveMode],
  );
  const forecast = useMemo(
    () => deriveForecast(selection, records),
    [selection, records],
  );
  const index = Math.min(cursor, Math.max(0, points.length - 1));
  const point = points[index];
  const best = ranking.find((r) => r.error !== null);
  const availableSeries = SERIES.filter((s) =>
    points.some((p) => p[s.id] !== null),
  );
  useEffect(() => {
    setCursor(0);
    setPlaying(false);
    setVisible((current) =>
      SERIES.some(
        (s) => current.includes(s.id) && points.some((p) => p[s.id] !== null),
      )
        ? current
        : SERIES.filter((s) => points.some((p) => p[s.id] !== null)).map(
            (s) => s.id,
          ),
    );
  }, [points]);
  useEffect(() => {
    if (!chartHost.current) return;
    const instance = init(chartHost.current, undefined, { renderer: "canvas" });
    chart.current = instance;
    const onPointer = (event: unknown) => {
      const value = (event as { axesInfo?: { value: number | string }[] })
        .axesInfo?.[0]?.value;
      if (value === undefined) return;
      const i =
        typeof value === "number" ? value : pointLabels.current.indexOf(value);
      if (i >= 0 && i < pointLabels.current.length && pointer.current !== i) {
        pointer.current = i;
        setCursor(i);
      }
    };
    instance.on("updateAxisPointer", onPointer);
    const observer = new ResizeObserver(() => instance.resize());
    observer.observe(chartHost.current);
    return () => {
      observer.disconnect();
      instance.off("updateAxisPointer", onPointer);
      instance.dispose();
      chart.current = null;
    };
  }, []);
  useEffect(() => {
    const reduced = matchMedia("(prefers-reduced-motion: reduce)").matches;
    const option: EChartsOption = {
      animation: !reduced,
      animationDuration: 500,
      animationDurationUpdate: 220,
      backgroundColor: "transparent",
      textStyle: { fontFamily: "Manrope Variable, sans-serif" },
      aria: { enabled: true },
      grid: { left: 55, right: 30, top: 33, bottom: 73 },
      tooltip: {
        trigger: "axis",
        backgroundColor: "#1b2333",
        borderColor: "#44516a",
        textStyle: { color: "#e7ecf6", fontSize: 12 },
        axisPointer: {
          type: "cross",
          label: { backgroundColor: "#384765" },
          lineStyle: { color: "#899dbc", type: "dashed" },
        },
        confine: true,
        valueFormatter: (value) =>
          typeof value === "number"
            ? `${value.toFixed(1)} ${meta.unit}`
            : String(value ?? "—"),
      },
      xAxis: {
        type: "category",
        data: points.map((p) => p.label),
        boundaryGap: false,
        axisTick: { show: false },
        axisLine: { lineStyle: { color: "#334056" } },
        axisLabel: {
          color: "#9eabc0",
          fontSize: 10,
          margin: 14,
          interval: effectiveMode === "history" ? 3 : 6,
        },
      },
      yAxis: {
        type: "value",
        name: effectiveMode === "skill" ? `Error (${meta.unit})` : meta.unit,
        nameTextStyle: {
          color: "#a6b3c8",
          align: "right",
          padding: [0, 5, 4, 0],
        },
        min:
          selection.variable === "temperature" && effectiveMode !== "skill"
            ? "dataMin"
            : 0,
        axisLabel: { color: "#9eabc0", fontSize: 10 },
        splitLine: { lineStyle: { color: "#293245", type: "dashed" } },
      },
      dataZoom: [
        {
          type: "inside",
          xAxisIndex: 0,
          zoomOnMouseWheel: "ctrl",
          moveOnMouseWheel: false,
        },
        {
          type: "slider",
          xAxisIndex: 0,
          height: 17,
          bottom: 10,
          borderColor: "transparent",
          backgroundColor: "#141c2b",
          fillerColor: "#617aad25",
          handleStyle: { color: "#8da3d3", borderColor: "#8da3d3" },
          dataBackground: {
            lineStyle: { color: "#465672" },
            areaStyle: { color: "#263653" },
          },
          textStyle: { color: "#9eaec6" },
          showDetail: false,
          brushSelect: true,
        },
      ],
      series: SERIES.filter((s) => visible.includes(s.id)).map((s) => ({
        id: s.id,
        name: s.label,
        type: "line" as const,
        data: points.map((p) => p[s.id]),
        showSymbol: points.length === 1,
        symbol: "circle",
        symbolSize: 6,
        connectNulls: false,
        smooth: 0.18,
        lineStyle: {
          color: s.color,
          width: s.id === "blend" ? 3 : s.id === "observed" ? 2 : 1.6,
          type: s.dash ? ("dashed" as const) : ("solid" as const),
          opacity: s.id === "baseline" ? 0.75 : 1,
        },
        itemStyle: { color: s.color },
        emphasis: { focus: "series" as const },
        areaStyle:
          s.id === "blend"
            ? {
                color: {
                  type: "linear" as const,
                  x: 0,
                  y: 0,
                  x2: 0,
                  y2: 1,
                  colorStops: [
                    { offset: 0, color: "#f0c77b19" },
                    { offset: 1, color: "#f0c77b00" },
                  ],
                },
              }
            : undefined,
        markLine:
          s.id === "blend" && effectiveMode !== "skill"
            ? {
                silent: true,
                symbol: "none",
                lineStyle: { color: "#987b52", type: "dashed" },
                label: {
                  formatter: `Review ${meta.threshold} ${meta.unit}`,
                  position: "insideEndTop",
                  color: "#c3a46f",
                  fontSize: 10,
                },
                data: [{ yAxis: meta.threshold }],
              }
            : undefined,
      })),
    };
    chart.current?.setOption(option, { notMerge: true });
  }, [points, effectiveMode, visible, meta, selection.variable]);
  useEffect(() => {
    if (playing) {
      const timer = setInterval(() => {
        setCursor((current) => {
          if (current >= points.length - 1) {
            setPlaying(false);
            return current;
          }
          return current + 1;
        });
      }, 650);
      return () => clearInterval(timer);
    }
  }, [playing, points.length]);
  useEffect(() => {
    if (playing)
      chart.current?.dispatchAction({
        type: "showTip",
        seriesIndex: 0,
        dataIndex: index,
      });
  }, [index, playing]);
  function setPoint(next: number) {
    setPlaying(false);
    setCursor(next);
    chart.current?.dispatchAction({
      type: "showTip",
      seriesIndex: 0,
      dataIndex: next,
    });
  }
  function toggle(id: SeriesId) {
    setVisible((current) =>
      current.includes(id)
        ? availableSeries.filter((s) => s.id !== id && current.includes(s.id))
            .length
          ? current.filter((v) => v !== id)
          : current
        : [...current, id],
    );
  }
  function exportComparison() {
    downloadFile(
      `astrablend-${effectiveMode}-comparison.csv`,
      [
        "case,nwp,ensemble,ai,blend,equal_average,observed",
        ...points.map((p) =>
          [
            p.label,
            p.nwp,
            p.ensemble,
            p.ai,
            p.blend,
            p.baseline,
            p.observed,
          ].join(","),
        ),
      ].join("\n"),
      "text/csv",
    );
  }
  return (
    <div className={`comparison-workspace ${expanded ? "expanded-chart" : ""}`}>
      <div className="comparison-context-bar">
        <button className="text-button" onClick={() => setView("overview")}>
          <ArrowLeft size={14} />
          Back to agents
        </button>
        <div>
          <span>{selection.location}</span>
          <i />
          <span>{meta.label}</span>
          <i />
          <span className="mono">T+{selection.lead} h</span>
        </div>
        <button
          className="button"
          aria-expanded={settings}
          onClick={() => setSettings((x) => !x)}
        >
          Adjust context
          <ChevronDown size={14} />
        </button>
      </div>
      {settings && <Controls expanded />}
      <section className="comparison-stage">
        <header className="comparison-stage-header">
          <div>
            <span className="eyebrow">Model performance</span>
            <h2>Let the forecasts tell their story.</h2>
            <p>{MODES.find((m) => m.id === effectiveMode)!.description}</p>
          </div>
          <div className="comparison-tools">
            <button
              className="icon-button"
              aria-label="Reset chart zoom"
              onClick={() =>
                chart.current?.dispatchAction({
                  type: "dataZoom",
                  start: 0,
                  end: 100,
                })
              }
            >
              <RotateCcw size={15} />
            </button>
            <button
              className="icon-button"
              aria-label={expanded ? "Restore chart size" : "Expand chart"}
              onClick={() => setExpanded((x) => !x)}
            >
              <Expand size={15} />
            </button>
            <button
              className="icon-button"
              aria-label="Download comparison CSV"
              onClick={exportComparison}
            >
              <Download size={15} />
            </button>
          </div>
        </header>
        <div
          className="comparison-mode-tabs"
          role="tablist"
          aria-label="Comparison mode"
        >
          {MODES.map((m) => (
            <button
              role="tab"
              key={m.id}
              aria-selected={effectiveMode === m.id}
              disabled={!!records.length && m.id !== "horizon"}
              className={effectiveMode === m.id ? "active" : ""}
              onClick={() => setMode(m.id)}
            >
              {m.label}
            </button>
          ))}
          <span>
            <Crosshair size={12} />
            Hover to inspect · drag the overview to zoom
          </span>
        </div>
        <div className="interactive-chart-grid">
          <div className="chart-main">
            <div className="series-toggles" aria-label="Visible models">
              {availableSeries.map((s) => (
                <button
                  key={s.id}
                  aria-pressed={visible.includes(s.id)}
                  onClick={() => toggle(s.id)}
                  className={visible.includes(s.id) ? "visible" : ""}
                  style={{ "--series-color": s.color } as React.CSSProperties}
                >
                  <i />
                  {s.label}
                </button>
              ))}
            </div>
            <div
              className="echart-host"
              ref={chartHost}
              data-testid="comparison-chart"
              role="img"
              aria-label="Interactive comparison of forecast models and the adaptive blend"
            />
            <div className="chart-playback">
              <button
                className="playback-button"
                aria-label={
                  playing ? "Pause chart replay" : "Play chart replay"
                }
                onClick={() => {
                  if (index >= points.length - 1) setCursor(0);
                  setPlaying((v) => !v);
                }}
              >
                {playing ? <Pause size={15} /> : <Play size={15} />}
              </button>
              <label htmlFor="comparison-cursor">
                {effectiveMode === "history" ? "Case" : "Lead"}{" "}
                <b>{point?.label ?? "—"}</b>
              </label>
              <input
                id="comparison-cursor"
                aria-label="Comparison cursor"
                type="range"
                min="0"
                max={Math.max(0, points.length - 1)}
                step="1"
                value={index}
                onChange={(e) => setPoint(Number(e.target.value))}
              />
              <span className="mono">
                {String(index + 1).padStart(2, "0")} / {points.length}
              </span>
            </div>
          </div>
          <aside className="point-inspector">
            <div className="point-inspector-title">
              <Crosshair size={14} />
              <span>
                {effectiveMode === "history"
                  ? "Selected weather case"
                  : "Selected forecast lead"}
              </span>
            </div>
            <h3>
              {point?.label ?? "No data"}
              <small>
                {effectiveMode === "history"
                  ? "Held-out observation"
                  : `${meta.label} / ${meta.unit}`}
              </small>
            </h3>
            {point?.observed !== null && point?.observed !== undefined && (
              <div className="observation-value">
                <span>Observed</span>
                <b>
                  {point.observed.toFixed(1)} <small>{meta.unit}</small>
                </b>
              </div>
            )}
            <div className="point-readings">
              {availableSeries
                .filter((s) => s.id !== "observed")
                .map((s) => (
                  <div
                    key={s.id}
                    className={s.id === "blend" ? "blend-reading" : ""}
                  >
                    <span>
                      <i style={{ background: s.color }} />
                      {s.id === "blend"
                        ? "Our blend"
                        : s.id === "baseline"
                          ? "Equal average"
                          : SOURCES.find((x) => x.id === s.id)?.short}
                    </span>
                    <b>
                      {point?.[s.id]?.toFixed(1) ?? "—"}
                      <small>{meta.unit}</small>
                    </b>
                  </div>
                ))}
            </div>
            <p>
              {effectiveMode === "history"
                ? "Scrub through the cases. The closest forecast can change from one event to the next."
                : effectiveMode === "skill"
                  ? "Each point compares models on the same held-out observations at that lead."
                  : "These are forecasts, not observations. Lower or higher values alone do not establish skill."}
            </p>
          </aside>
        </div>
      </section>
      <div className="comparison-bottom">
        <section className="ranking-panel">
          <div>
            <h2>
              {effectiveMode === "horizon"
                ? "Source contribution"
                : "Performance across the selection"}
            </h2>
            <p>
              {effectiveMode === "history"
                ? "Root-mean-square error on all 24 held-out cases"
                : effectiveMode === "skill"
                  ? "Mean of held-out errors across the available leads"
                  : "Adaptive weights for the current context"}
            </p>
          </div>
          <div className="ranking-list">
            {ranking.map((row, i) => {
              const series = SERIES.find((s) => s.id === row.id)!;
              const weight = forecast.sources.find(
                (s) => s.id === row.id,
              )?.weight;
              return (
                <div
                  className={
                    row.id === "blend"
                      ? "ranking-row highlighted"
                      : "ranking-row"
                  }
                  key={row.id}
                >
                  <span className="ranking-position">
                    {row.error !== null ? String(i + 1).padStart(2, "0") : "—"}
                  </span>
                  <i style={{ background: series.color }} />
                  <span>{series.label}</span>
                  <div className="ranking-bar">
                    <span
                      style={{
                        width:
                          row.error !== null
                            ? `${Math.min(100, (row.error / Math.max(...ranking.map((r) => r.error ?? 0), 1)) * 100)}%`
                            : `${(weight ?? 0) * 100}%`,
                        background: series.color,
                      }}
                    />
                  </div>
                  <strong>
                    {row.error !== null
                      ? row.error.toFixed(1)
                      : weight === undefined
                        ? "—"
                        : `${(weight * 100).toFixed(1)}%`}
                  </strong>
                  {row.id === best?.id && <Check size={13} />}
                </div>
              );
            })}
          </div>
        </section>
        <section className="comparison-takeaway">
          <span className="eyebrow">The difference, measured</span>
          {forecast.skill && effectiveMode !== "horizon" ? (
            <>
              <div className="takeaway-value">
                {forecast.skill.improvement >= 0 ? (
                  <ArrowDownRight size={28} />
                ) : (
                  <ArrowUpRight size={28} />
                )}
                <strong>
                  {Math.abs(forecast.skill.improvement).toFixed(1)}
                  <small>%</small>
                </strong>
              </div>
              <h3>
                {forecast.skill.improvement >= 0
                  ? "Less error. A clearer signal."
                  : "A useful counterexample."}
              </h3>
              <p>
                The adaptive blend has{" "}
                {Math.abs(forecast.skill.improvement).toFixed(1)}%{" "}
                {forecast.skill.improvement >= 0 ? "lower" : "higher"} error
                than equal weighting on the {selection.lead}-hour held-out
                cases.
              </p>
            </>
          ) : (
            <>
              <h3>Every contribution is visible.</h3>
              <p>
                Explore disagreement between sources across forecast leads. Use
                held-out observations to assess which approach performs better.
              </p>
            </>
          )}
          <button className="text-button" onClick={() => setView("risk")}>
            Inspect extreme-weather guidance
            <ArrowRight size={14} />
          </button>
        </section>
      </div>
      <details className="comparison-data-table">
        <summary>
          Inspect the underlying comparison data
          <ChevronDown size={14} />
        </summary>
        <div className="table-scroll">
          <table>
            <thead>
              <tr>
                <th>Case / lead</th>
                {availableSeries.map((s) => (
                  <th key={s.id}>{s.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {points.map((p) => (
                <tr key={p.x}>
                  <td>{p.label}</td>
                  {availableSeries.map((s) => (
                    <td key={s.id}>{p[s.id]?.toFixed(2) ?? "—"}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </div>
  );
}
