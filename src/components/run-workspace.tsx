import { lazy, Suspense, useEffect, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  GitBranch,
  Globe2,
  Layers3,
  MapPin,
  Pause,
  Play,
  RotateCcw,
  SlidersHorizontal,
  Terminal,
  X,
} from "lucide-react";
import AgentCanvas from "./agent-canvas";
import { WeightBars } from "./charts";
import IndiaMap from "./india-map";
import { Controls } from "./controls";
import { PRESETS } from "../data/presets";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { useForecastStore } from "../store/forecast-store";
import { useRunStore } from "../store/run-store";
import { deriveForecast } from "../lib/blending/engine";
const Pipeline = lazy(() => import("./pipeline"));
const stages = [
  "Evaluate sources",
  "Resolve weights",
  "Check extremes",
  "Forecast ready",
];
export default function RunWorkspace() {
  const { selection, preset, applyPreset, setView, records } =
    useForecastStore();
  const run = useRunStore();
  const [layer, setLayer] = useState<"agents" | "map" | "3d">("agents");
  const [settings, setSettings] = useState(false);
  const [fullTrace, setFullTrace] = useState(false);
  const meta = VARIABLES[selection.variable];
  const selectedSource = run.sources.find((s) => s.id === run.inspected);
  const sourceMeta = SOURCES.find((s) => s.id === run.inspected);
  useEffect(() => {
    if (useRunStore.getState().status === "idle")
      void useRunStore.getState().run();
  }, []);
  return (
    <div className="run-workspace">
      <div className="mission-control">
        <div className="mission-selection">
          <span className="mission-icon">
            <Globe2 size={19} />
          </span>
          <label>
            Weather scenario
            <select
              aria-label="Weather scenario"
              value={preset}
              onChange={(e) => {
                const p = PRESETS.find((x) => x.id === e.target.value);
                if (p) applyPreset(p.selection, p.id);
              }}
            >
              <option value="" disabled>
                {records.length ? "Imported forecast" : "Custom forecast"}
              </option>
              {PRESETS.map((p) => (
                <option value={p.id} key={p.id}>
                  {p.label}
                </option>
              ))}
            </select>
          </label>
          <div className="mission-context">
            <span>
              <MapPin size={12} />
              {selection.location}
            </span>
            <span className="mono">+{selection.lead} h</span>
            <span>{meta.label}</span>
          </div>
        </div>
        <div className="mission-actions">
          <button
            className={`button configure-button ${settings ? "active" : ""}`}
            aria-expanded={settings}
            onClick={() => setSettings((x) => !x)}
          >
            <SlidersHorizontal size={15} />
            Configure
          </button>
          {run.status === "running" || run.status === "paused" ? (
            <>
              <button
                className="button"
                onClick={run.status === "paused" ? run.resume : run.pause}
              >
                {run.status === "paused" ? (
                  <Play size={15} />
                ) : (
                  <Pause size={15} />
                )}{" "}
                {run.status === "paused" ? "Resume" : "Pause"}
              </button>
              <button
                className="icon-button"
                aria-label="Cancel run"
                onClick={run.cancel}
              >
                <X size={15} />
              </button>
            </>
          ) : (
            <button
              className="button run-button"
              onClick={() => void run.run()}
            >
              {run.status === "complete" ? (
                <RotateCcw size={15} />
              ) : (
                <Play size={15} />
              )}{" "}
              {run.status === "complete" ? "Replay run" : "Run forecast"}
            </button>
          )}
        </div>
      </div>
      {settings && (
        <div className="workspace-settings">
          <Controls expanded />
        </div>
      )}
      <div className="run-workspace-body">
        <section className="orchestration-panel">
          <div className="orchestration-toolbar">
            <div className="workspace-layers">
              <button
                className={layer === "agents" ? "active" : ""}
                onClick={() => setLayer("agents")}
              >
                <GitBranch size={14} />
                Agent graph
              </button>
              <button
                className={layer === "map" ? "active" : ""}
                onClick={() => setLayer("map")}
              >
                <Globe2 size={14} />
                Regional map
              </button>
              <button
                className={layer === "3d" ? "active" : ""}
                onClick={() => setLayer("3d")}
              >
                <Layers3 size={14} />
                3D pathways
              </button>
            </div>
            <span
              className={`run-status ${run.status}`}
              data-testid="run-status"
            >
              <i />
              {run.status === "running"
                ? "Run in progress"
                : run.status === "paused"
                  ? "Playback paused"
                  : run.status === "complete"
                    ? "Run complete"
                    : run.status === "stale"
                      ? "Inputs changed"
                      : run.status === "error"
                        ? "Run failed"
                        : "Ready to run"}
            </span>
          </div>
          {layer === "agents" ? (
            <AgentCanvas />
          ) : layer === "map" ? (
            <div className="workspace-map">
              <IndiaMap />
            </div>
          ) : (
            <div className="workspace-3d">
              <Suspense fallback={<p>Loading pathways…</p>}>
                <Pipeline
                  forecast={run.result ?? deriveForecast(selection, records)}
                />
              </Suspense>
              <p>
                Source influence for the selected context. Run the agent graph
                to inspect each evaluation stage.
              </p>
            </div>
          )}
          <div className="run-timeline">
            {stages.map((stage, i) => (
              <div
                key={stage}
                className={
                  run.stage > i + 1 || run.status === "complete"
                    ? "done"
                    : run.stage === i + 1
                      ? "current"
                      : ""
                }
              >
                <span>
                  {run.stage > i + 1 || run.status === "complete" ? (
                    <Check size={12} />
                  ) : (
                    i + 1
                  )}
                </span>
                <p>{stage}</p>
                {i < 3 && <ChevronRight size={13} />}
              </div>
            ))}
          </div>
        </section>
        <aside className="run-inspector" aria-label="Agent inspector">
          <div className="inspector-heading">
            <span>
              {sourceMeta
                ? "Source inspection"
                : run.inspected === "blend"
                  ? "Blending intelligence"
                  : "Forecast output"}
            </span>
            <span className="mono">
              0
              {sourceMeta
                ? SOURCES.indexOf(sourceMeta) + 1
                : run.inspected === "blend"
                  ? 4
                  : 5}
            </span>
          </div>
          {sourceMeta ? (
            <>
              <div
                className="inspector-orbit"
                style={{ color: sourceMeta.color }}
              >
                <Layers3 size={27} />
              </div>
              <h2>{sourceMeta.name}</h2>
              <p className="inspector-description">{sourceMeta.description}</p>
              {selectedSource ? (
                <>
                  <div className="inspector-number">
                    {selectedSource.available
                      ? selectedSource.corrected.toFixed(1)
                      : "—"}
                    <small>{meta.unit}</small>
                  </div>
                  <span className="inspector-caption">
                    Bias-corrected forecast
                  </span>
                  <dl className="inspector-facts">
                    <div>
                      <dt>Raw forecast</dt>
                      <dd>
                        {selectedSource.raw.toFixed(1)} {meta.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Bias correction</dt>
                      <dd>
                        {selectedSource.bias.toFixed(1)} {meta.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Recent error</dt>
                      <dd>
                        {selectedSource.rmse.toFixed(1)} {meta.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Assigned weight</dt>
                      <dd>
                        {run.agents.blend === "ready"
                          ? `${(selectedSource.weight * 100).toFixed(1)}%`
                          : "Pending blend"}
                      </dd>
                    </div>
                  </dl>
                  <div className="inspector-insight">
                    {selectedSource.available
                      ? records.length && selectedSource.samples < 20
                        ? "Prior calibration is used because fewer than 20 matching historical cases are available. This upload has no validated skill score."
                        : `${selectedSource.samples} prior cases inform this source’s reliability. Its contribution changes with location, weather regime, and forecast lead.`
                      : "This input is excluded. Other available sources carry the forecast."}
                  </div>
                </>
              ) : (
                <div className="inspector-empty">
                  The evaluation appears here when this source finishes. Select
                  another node to follow the run.
                </div>
              )}
            </>
          ) : run.inspected === "blend" && run.result ? (
            <>
              <div className="inspector-orbit">
                <GitBranch size={26} />
              </div>
              <h2>How trust is assigned.</h2>
              <p className="inspector-description">
                Recent skill determines influence, with unavailable sources
                excluded.
              </p>
              <WeightBars forecast={run.result} />
              <div className="inspector-insight">
                {run.result.reasons.slice(0, 2).join(" ")}
              </div>
              <button
                className="button compare-cta"
                onClick={() => setView("explorer")}
              >
                Verify the result
                <ArrowRight size={15} />
              </button>
            </>
          ) : run.result ? (
            <>
              <div className="result-eyebrow">
                <Check size={14} />
                Forecast assembled
              </div>
              <h2>{selection.location}</h2>
              <div
                className="inspector-number result-number"
                data-testid="forecast-value"
              >
                {run.result.value.toFixed(1)}
                <small>{meta.unit}</small>
              </div>
              <span className="inspector-caption">{meta.period}</span>
              <div className="output-range">
                <span>Central 80% range</span>
                <b>
                  {run.result.lower.toFixed(0)}–{run.result.upper.toFixed(0)}{" "}
                  {meta.unit}
                </b>
              </div>
              <dl className="inspector-facts">
                <div>
                  <dt>Confidence</dt>
                  <dd>{run.result.confidence}</dd>
                </div>
                <div>
                  <dt>
                    Above {run.result.threshold} {meta.unit}
                  </dt>
                  <dd>{(run.result.probability * 100).toFixed(0)}%</dd>
                </div>
              </dl>
              <div className="inspector-insight">{run.result.reasons[0]}</div>
              <button
                className="button compare-cta"
                onClick={() => setView("explorer")}
              >
                Compare all models
                <ArrowRight size={15} />
              </button>
            </>
          ) : (
            <>
              <div
                className={
                  "blending-orbit " +
                  (run.status === "running" ? "is-running" : "")
                }
              >
                <span />
                <span />
                <GitBranch size={29} />
              </div>
              <h2>
                {run.status === "stale"
                  ? "A new context awaits."
                  : run.status === "paused"
                    ? "Take a closer look."
                    : "Different strengths.\nOne decision."}
              </h2>
              <p className="inspector-description">
                {run.status === "stale"
                  ? "Your inputs changed. Run the forecast to evaluate this configuration."
                  : "Each source is evaluated independently. The blending agent combines them using recent skill."}
              </p>
              <div className="agent-checklist">
                {SOURCES.map((source) => (
                  <button
                    key={source.id}
                    onClick={() => run.inspect(source.id)}
                  >
                    <i style={{ background: source.color }} />
                    <span>{source.short}</span>
                    <small>
                      {run.agents[source.id] === "ready"
                        ? "Evaluated"
                        : run.agents[source.id] === "working"
                          ? "Working…"
                          : run.agents[source.id] === "unavailable"
                            ? "Excluded"
                            : "Queued"}
                    </small>
                  </button>
                ))}
              </div>
              <span className="inspector-tip">
                Click any agent to inspect its contribution.
              </span>
            </>
          )}
        </aside>
      </div>
      <section
        className={`execution-trace ${fullTrace ? "trace-expanded" : ""}`}
      >
        <div className="trace-header">
          <h2>
            <Terminal size={15} />
            Execution trace
          </h2>
          <span>
            {run.runNumber
              ? `Run ${String(run.runNumber).padStart(3, "0")}`
              : "No active run"}
          </span>
          <button
            className="trace-toggle"
            onClick={() => setFullTrace((x) => !x)}
            aria-expanded={fullTrace}
          >
            {fullTrace ? "Collapse trace" : "Full trace"}
          </button>
          <label>
            Playback
            <select
              aria-label="Run playback speed"
              value={run.speed}
              onChange={(e) => run.setSpeed(Number(e.target.value))}
            >
              <option value="1">1×</option>
              <option value="2">2×</option>
              <option value="4">4×</option>
            </select>
          </label>
        </div>
        <div
          className="trace-events"
          role="log"
          aria-label="Agent execution events"
        >
          {run.events.length === 0 ? (
            <p className="trace-empty">
              Choose your context and run the forecast. Source evaluations and
              blending decisions will appear here.
            </p>
          ) : (
            (fullTrace ? run.events : run.events.slice(-4)).map((event) => (
              <div className="trace-event" key={`${run.runNumber}-${event.id}`}>
                <span className="trace-sequence">
                  {String(event.id).padStart(2, "0")}
                </span>
                <i
                  style={{
                    background:
                      SOURCES.find((s) => s.id === event.agent)?.color ??
                      "#a8b6d7",
                  }}
                />
                <strong>{event.title}</strong>
                <p>{event.detail}</p>
                <Check size={12} />
              </div>
            ))
          )}
        </div>
        {run.error && (
          <p role="alert" className="run-error">
            {run.error}
          </p>
        )}
      </section>
      <div className="workspace-bottom-note">
        <span>
          Three evaluators <i /> One adaptive blending policy <i /> All
          computation stays on your device
        </span>
        <button onClick={() => setView("data")}>
          Inspect methodology
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
