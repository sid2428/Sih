import { useLayoutEffect, useRef } from "react";
import { scaleLinear } from "d3";
import gsap from "gsap";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import type { Forecast, Selection } from "../types/forecast";

export function WeightBars({ forecast }: { forecast: Forecast }) {
  const ref = useRef<HTMLDivElement>(null);
  useLayoutEffect(() => {
    const context = gsap.context(() => {
      gsap.to(".weight-fill", {
        scaleX: (i: number) => forecast.sources[i].weight,
        duration: matchMedia("(prefers-reduced-motion: reduce)").matches
          ? 0
          : 0.5,
        ease: "power2.out",
      });
    }, ref);
    return () => context.revert();
  }, [forecast]);
  return (
    <div className="weight-bars" ref={ref}>
      {forecast.sources.map((s, i) => (
        <div className="weight-row" key={s.id}>
          <div className="weight-label">
            <span>
              <i style={{ background: SOURCES[i].color }} />
              {SOURCES[i].name}
            </span>
            <strong>
              {s.available ? `${(s.weight * 100).toFixed(1)}%` : "Offline"}
            </strong>
          </div>
          <div className="weight-track">
            <div
              className="weight-fill"
              style={{
                background: SOURCES[i].color,
                transformOrigin: "left",
                transform: `scaleX(${s.weight})`,
              }}
            />
          </div>
        </div>
      ))}
    </div>
  );
}

export function RiskComparison({
  selection,
  forecast,
}: {
  selection: Selection;
  forecast: Forecast;
}) {
  const maximum =
    Math.max(
      forecast.upper,
      forecast.threshold * 1.4,
      ...forecast.sources.map((s) => s.corrected),
    ) * 1.12;
  const y = scaleLinear().domain([0, maximum]).range([225, 22]);
  const meta = VARIABLES[selection.variable];
  return (
    <svg
      className="risk-chart"
      viewBox="0 0 780 280"
      role="img"
      aria-label={`Equal average ${forecast.baseline.toFixed(1)} versus adaptive guidance ${forecast.value.toFixed(1)} ${meta.unit}; threshold ${forecast.threshold}`}
    >
      {y.ticks(5).map((t) => (
        <g key={t}>
          <line className="chart-grid" x1="50" x2="760" y1={y(t)} y2={y(t)} />
          <text className="axis-text" x="38" y={y(t) + 4} textAnchor="end">
            {t.toFixed(0)}
          </text>
        </g>
      ))}
      <line
        x1="50"
        x2="760"
        y1={y(forecast.threshold)}
        y2={y(forecast.threshold)}
        stroke="#d8ac67"
        strokeDasharray="5 5"
      />
      <text
        x="754"
        y={y(forecast.threshold) - 9}
        fill="#d8ac67"
        fontSize="10"
        textAnchor="end"
      >
        Review threshold · {forecast.threshold} {meta.unit}
      </text>
      {[
        {
          x: 220,
          value: forecast.baseline,
          label: "Equal-weight average",
          color: "#5b657d",
        },
        {
          x: 565,
          value: forecast.value,
          label: "Adaptive guidance",
          color: "#8295ff",
        },
      ].map((b) => (
        <g key={b.label}>
          <rect
            x={b.x - 46}
            y={y(b.value)}
            width="92"
            height={Math.max(0, 225 - y(b.value))}
            rx="3"
            fill={b.color}
            opacity=".85"
          />
          <text
            x={b.x}
            y={y(b.value) - 11}
            fill="#eff3ff"
            textAnchor="middle"
            className="bar-value"
          >
            {b.value.toFixed(1)} <tspan fontSize="12">{meta.unit}</tspan>
          </text>
          <text x={b.x} y="252" className="axis-text light" textAnchor="middle">
            {b.label}
          </text>
        </g>
      ))}
      {forecast.sources
        .filter((s) => s.available)
        .map((s) => (
          <g key={s.id}>
            <circle
              cx="700"
              cy={y(s.corrected)}
              r="4"
              fill={SOURCES.find((x) => x.id === s.id)!.color}
            />
            <title>
              {s.id}: {s.corrected.toFixed(1)} {meta.unit}
            </title>
          </g>
        ))}
    </svg>
  );
}
