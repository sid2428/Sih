import { lazy, Suspense, useMemo, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  BookOpen,
  Check,
  ChevronRight,
  CircleHelp,
  Clock3,
  Database,
  Download,
  Layers3,
  GitBranch,
  ChartNoAxesCombined,
  MapPin,
  Radar,
  TriangleAlert,
  X,
} from "lucide-react";
import type { LucideIcon } from "lucide-react";
import { RiskComparison } from "./components/charts";
import RunWorkspace from "./components/run-workspace";
import { useRunStore } from "./store/run-store";
import { Controls } from "./components/controls";
import Provenance from "./components/provenance";
import { SOURCES, VARIABLES } from "./data/mock-profile";
import { PRESETS } from "./data/presets";
import { deriveForecast, validTime } from "./lib/blending/engine";
import { downloadFile } from "./lib/csv/parse";
import { useForecastStore } from "./store/forecast-store";
import type { View } from "./store/forecast-store";
import type { Forecast } from "./types/forecast";
const ModelComparison = lazy(() => import("./components/model-comparison"));
const NAV: { id: View; label: string; icon: LucideIcon }[] = [
  { id: "overview", label: "Agent workspace", icon: GitBranch },
  { id: "explorer", label: "Model comparison", icon: ChartNoAxesCombined },
  { id: "risk", label: "Extreme risk desk", icon: TriangleAlert },
  { id: "data", label: "Data & provenance", icon: Database },
];
const TITLES: Record<View, { title: string; description: string }> = {
  overview: {
    title: "Build. Configure. Forecast.",
    description:
      "Create multi-agent workflows to run simulations, compare models and generate forecasts.",
  },
  explorer: {
    title: "Put every model to the test.",
    description:
      "Explore the forecast, replay the evidence, and compare what each model gets right.",
  },
  risk: {
    title: "Keep the extreme in view.",
    description: "Assess the signal an average can leave behind.",
  },
  data: {
    title: "Confidence starts with provenance.",
    description:
      "Inspect the inputs, follow the method, and bring your own data.",
  },
};
function RiskTag({ forecast }: { forecast: Forecast }) {
  return (
    <span className={"risk-tag " + forecast.risk.toLowerCase()}>
      <span />
      {forecast.risk === "High"
        ? "High impact potential"
        : forecast.risk === "Elevated"
          ? "Elevated signal"
          : "Monitor conditions"}
    </span>
  );
}
function Reasoning({ forecast }: { forecast: Forecast }) {
  return (
    <div className="reasoning">
      <div className="section-label">
        <span>
          <BookOpen size={14} /> Why this blend?
        </span>
        <span className="subtle-tag">Explainable</span>
      </div>
      {forecast.reasons.map((r, i) => (
        <p key={i}>
          <span>0{i + 1}</span>
          {r}
        </p>
      ))}
    </div>
  );
}
export default function App() {
  const { selection, view, setView, records, fileName, applyPreset } =
    useForecastStore();
  const runStatus = useRunStore((s) => s.status);
  const [help, setHelp] = useState(false);
  const [exported, setExported] = useState(false);
  const forecast = useMemo(
    () => deriveForecast(selection, records),
    [selection, records],
  );
  const meta = VARIABLES[selection.variable];
  const available = forecast.sources.filter((s) => s.available).length;
  const valid = records.length
    ? new Date(
        Date.parse(
          records.find((r) => r.timestamp.slice(0, 10) === selection.date)
            ?.timestamp ?? selection.date,
        ) +
          selection.lead * 3600000,
      )
    : validTime(selection);
  const formatted = new Intl.DateTimeFormat("en-GB", {
    day: "2-digit",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
    timeZone: "UTC",
  }).format(valid);
  function exportBrief() {
    const lines = [
      "# AstraBlend forecast briefing",
      `Dataset: ${records.length ? fileName : "Demo dataset — seeded scenario profile"}`,
      `Location: ${selection.location} (${selection.cell.lat}°N, ${selection.cell.lon}°E)`,
      `Valid: ${valid.toISOString()}${selection.variable === "rainfall" ? " (start of 24-hour window)" : ""}`,
      `Variable: ${meta.label}`,
      `Guidance: ${forecast.value.toFixed(1)} ${meta.unit}`,
      `80% residual-mixture interval: ${forecast.lower.toFixed(1)}–${forecast.upper.toFixed(1)} ${meta.unit}`,
      `Estimated exceedance probability: ${(forecast.probability * 100).toFixed(1)}% above ${forecast.threshold} ${meta.unit}`,
      `Confidence: ${forecast.confidence}`,
      `Engine: 1.0.0`,
      "",
      "## Source contributions",
      ...forecast.sources.map(
        (s, i) =>
          `- ${SOURCES[i].name}: ${(s.weight * 100).toFixed(1)}%; corrected ${s.corrected.toFixed(1)} ${meta.unit}; ${s.available ? "available" : "unavailable"}`,
      ),
      "",
      "## Decision rationale",
      ...forecast.reasons.map((r) => `- ${r}`),
      "",
      "## Provenance",
      "Scenario results are not an issued weather warning. Probability and interval reliability require independent real-data validation.",
    ];
    downloadFile(
      `astrablend-${selection.location.replaceAll(" ", "-").toLowerCase()}-briefing.md`,
      lines.join("\n"),
      "text/markdown",
    );
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Skip to forecast
      </a>
      <aside className="sidebar">
        <a
          className="brand"
          href="#overview"
          onClick={(e) => {
            e.preventDefault();
            setView("overview");
          }}
        >
          <div className="brand-mark">
            <Layers3 size={25} />
          </div>
          <div>
            AstraBlend<span>Forecast intelligence</span>
          </div>
        </a>
        <div className="workspace-label">
          <span className="workspace-dot" />
          Forecast workspace
        </div>
        <nav aria-label="Primary">
          {NAV.map((item, i) => (
            <button
              key={item.id}
              className={"nav-item " + (view === item.id ? "active" : "")}
              aria-label={item.label}
              title={item.label}
              onClick={() => setView(item.id)}
              aria-current={view === item.id ? "page" : undefined}
            >
              <item.icon size={17} />
              <span>{item.label}</span>
              <small>0{i + 1}</small>
            </button>
          ))}
        </nav>
        <div className="sidebar-summary">
          <span className="orbit-symbol">
            <Radar size={30} />
          </span>
          <h3>Built for the bigger picture.</h3>
          <p>
            Physics, ensembles, and AI.
            <br />
            Working better together.
          </p>
          <div className="sidebar-source-dots">
            {SOURCES.map((s) => (
              <i style={{ background: s.color }} key={s.id} />
            ))}
          </div>
        </div>
        <div className="sidebar-bottom">
          <button onClick={() => setHelp(true)}>
            <CircleHelp size={16} />
            Workspace guide
            <ArrowUpRight size={13} />
          </button>
          <div className="project-signature">
            <span>SIH 2026</span>
            <span>PS 26081</span>
          </div>
          <p>Hybrid AI–NWP forecast blending</p>
        </div>
      </aside>
      <div className="main-shell">
        <header className="topbar">
          <div className="breadcrumb">
            Workspace <ChevronRight size={13} />
            <span>{NAV.find((n) => n.id === view)!.label}</span>
          </div>
          <div className="topbar-status">
            <span className="data-mode">
              <Database size={12} />
              {records.length ? "Local dataset" : "Demo dataset"}
            </span>
            <span>
              <Clock3 size={13} />
              {records.length ? "Imported cycle" : "Cycle 06Z"}
            </span>
            <span
              className={"source-status " + (available < 3 ? "degraded" : "")}
            >
              <i />
              {available}/3 inputs available
            </span>
          </div>
        </header>
        <main id="main">
          <div className="page-heading">
            <div>
              <div className="page-kicker">
                <span />
                Hybrid AI–NWP intelligence
              </div>
              <h1>{TITLES[view].title}</h1>
              <p>{TITLES[view].description}</p>
            </div>
            <button
              className="button export-button"
              onClick={exportBrief}
              disabled={view === "overview" && runStatus !== "complete"}
              title={
                view === "overview" && runStatus !== "complete"
                  ? "Complete a forecast run to export its briefing"
                  : "Download this forecast briefing"
              }
            >
              {exported ? <Check size={15} /> : <Download size={15} />}{" "}
              {exported ? "Briefing saved" : "Export briefing"}
            </button>
          </div>
          <div
            className={`forecast-context ${view === "overview" || view === "explorer" ? "compact-context" : ""}`}
          >
            <div>
              <MapPin size={14} />
              <b>{selection.location}</b>
              <span className="context-divider" />
              {meta.label}
              <span className="context-divider" />
              <span className="mono">
                T+{String(selection.lead).padStart(3, "0")} h
              </span>
            </div>
            <span>
              Valid {formatted} UTC
              {selection.variable === "rainfall" ? " · next 24 h" : ""}
            </span>
          </div>
          {view === "overview" && <RunWorkspace />}
          {view === "explorer" && (
            <Suspense
              fallback={
                <div className="empty-state">
                  Preparing interactive comparison…
                </div>
              }
            >
              <ModelComparison />
            </Suspense>
          )}
          {view === "risk" && (
            <>
              <div className="risk-mode-bar">
                <div className="segmented" aria-label="Extreme weather mode">
                  {[
                    {
                      label: "Heavy rainfall",
                      variable: "rainfall",
                      preset: 0,
                    },
                    { label: "Heatwave", variable: "temperature", preset: 4 },
                    { label: "High wind", variable: "wind", preset: 5 },
                  ].map((m) => (
                    <button
                      key={m.variable}
                      className={
                        selection.variable === m.variable ? "active" : ""
                      }
                      onClick={() =>
                        applyPreset(
                          PRESETS[m.preset].selection,
                          PRESETS[m.preset].id,
                        )
                      }
                    >
                      {m.label}
                    </button>
                  ))}
                </div>
                <RiskTag forecast={forecast} />
              </div>
              <div className="risk-layout">
                <section className="panel comparison-panel">
                  <div className="panel-heading">
                    <div>
                      <h2>When averaging hides the signal</h2>
                      <p>
                        Identical inputs. Different treatment of source
                        reliability.
                      </p>
                    </div>
                    <span className="subtle-tag">
                      Shared scale · {meta.unit}
                    </span>
                  </div>
                  <RiskComparison forecast={forecast} selection={selection} />
                  <div className="comparison-notes">
                    <div>
                      <span className="line-key baseline" />
                      <h3>Equal-weight average</h3>
                      <p>
                        Every available source contributes equally, including
                        those with weaker recent skill.
                      </p>
                    </div>
                    <div>
                      <span className="line-key blend" />
                      <h3>Adaptive guidance</h3>
                      <p>
                        Recent skill drives influence.
                        {forecast.tailStrength > 0
                          ? " Strong threshold evidence also activates the bounded rainfall tail guard."
                          : " The tail guard is inactive in this case."}
                      </p>
                    </div>
                  </div>
                  <details className="tail-explanation">
                    <summary>
                      How the extreme signal is handled{" "}
                      <ChevronRight size={14} />
                    </summary>
                    <p>
                      Rainfall tail adjustment requires at least two corrected
                      sources above {forecast.threshold} {meta.unit} and
                      exceedance evidence ≥55%. The blend moves at most 35%
                      toward the weighted upper source quantile. Heat and wind
                      retain the ordinary adaptive blend. This heuristic is
                      shown separately in the decision ledger.
                    </p>
                  </details>
                </section>
                <aside className="panel risk-assessment">
                  <div className="risk-icon">
                    <TriangleAlert size={23} />
                  </div>
                  <p className="readout-label">Threshold exceedance</p>
                  <div className="risk-probability">
                    {(forecast.probability * 100).toFixed(0)}
                    <span>%</span>
                  </div>
                  <p>
                    Estimated chance above{" "}
                    <b>
                      {forecast.threshold} {meta.unit}
                    </b>{" "}
                    for the selected forecast window.
                  </p>
                  <div className="risk-gauge">
                    <span style={{ width: `${forecast.probability * 100}%` }} />
                  </div>
                  <dl>
                    <div>
                      <dt>Source agreement</dt>
                      <dd>
                        {forecast.agreement} / {available}
                      </dd>
                    </div>
                    <div>
                      <dt>Confidence</dt>
                      <dd>{forecast.confidence}</dd>
                    </div>
                    <div>
                      <dt>Tail guard</dt>
                      <dd>
                        {forecast.tailStrength > 0 ? "Active" : "Not triggered"}
                      </dd>
                    </div>
                  </dl>
                  <div className="action-note">
                    <strong>Forecaster review</strong>
                    <p>
                      {forecast.risk === "High"
                        ? "A concentrated hazard signal remains after blending. Prioritize a local review of exposed areas."
                        : forecast.risk === "Elevated"
                          ? "The threshold signal warrants attention. Compare the source spread before escalating guidance."
                          : "Continue monitoring the next forecast cycle for changes in threshold evidence."}
                    </p>
                  </div>
                  <button
                    className="text-button"
                    onClick={() => setView("data")}
                  >
                    Inspect decision ledger
                    <ArrowRight size={14} />
                  </button>
                </aside>
              </div>
              <Reasoning forecast={forecast} />
            </>
          )}
          {view === "data" && (
            <>
              <Controls />
              <Provenance forecast={forecast} />
            </>
          )}
          <footer className="page-footer">
            <span>
              <Layers3 size={12} />
              AstraBlend <span className="muted">/</span> Adaptive forecast
              intelligence
            </span>
            <span>
              1° spatial grid <span className="footer-dot" /> Engine v1.0.0{" "}
              <span className="footer-dot" /> All processing on device
            </span>
          </footer>
        </main>
      </div>
      {help && (
        <div className="modal-backdrop" onClick={() => setHelp(false)}>
          <section
            className="guide-modal"
            role="dialog"
            aria-modal="true"
            aria-labelledby="guide-title"
            onClick={(e) => e.stopPropagation()}
            onKeyDown={(e) => {
              if (e.key === "Escape") setHelp(false);
              if (e.key === "Tab") {
                const buttons =
                  e.currentTarget.querySelectorAll<HTMLButtonElement>("button");
                const first = buttons[0];
                const last = buttons[buttons.length - 1];
                if (e.shiftKey && document.activeElement === first) {
                  e.preventDefault();
                  last.focus();
                }
                if (!e.shiftKey && document.activeElement === last) {
                  e.preventDefault();
                  first.focus();
                }
              }
            }}
          >
            <button
              autoFocus
              className="icon-button close-guide"
              aria-label="Close workspace guide"
              onClick={() => setHelp(false)}
            >
              <X size={20} />
            </button>
            <div className="brand-mark">
              <Layers3 size={25} />
            </div>
            <h2 id="guide-title">Your forecast, explained.</h2>
            <p>
              Start with a location or a briefing scenario. Every view follows
              the same forecast selection.
            </p>
            <ol>
              <li>
                <b>Agent workspace</b> — run the source evaluators, pause
                playback, and inspect each decision.
              </li>
              <li>
                <b>Model comparison</b> — hover, zoom, toggle models, and replay
                the held-out evidence.
              </li>
              <li>
                <b>Risk desk</b> — compare adaptive guidance with the equal
                average.
              </li>
              <li>
                <b>Provenance</b> — inspect the calculation or upload local
                forecasts.
              </li>
            </ol>
            <p className="muted">
              Indigo is physics-based guidance, teal is ensemble guidance, and
              violet is the AI model. Forecast values use UTC and the units
              shown next to each measurement.
            </p>
            <button className="button primary" onClick={() => setHelp(false)}>
              Start exploring
              <ArrowRight size={15} />
            </button>
          </section>
        </div>
      )}
    </div>
  );
}
