import { lazy, Suspense, useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  Check,
  ChevronRight,
  Flame,
  GitBranch,
  Globe2,
  Layers3,
  Maximize2,
  MessagesSquare,
  Pause,
  Play,
  Plus,
  CloudRain,
  Repeat,
  RotateCcw,
  SlidersHorizontal,
  Sparkles,
  Terminal,
  Wind,
  X,
  Zap,
} from "lucide-react";
import AgentCanvas from "./agent-canvas";
import { WeightBars } from "./charts";
import IndiaMap from "./india-map";
import { Controls } from "./controls";
import { PRESETS } from "../data/presets";
import { LOCATIONS } from "../data/geography";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { useForecastStore } from "../store/forecast-store";
import { useRunStore } from "../store/run-store";
import { AGENT_PERSONAS } from "../lib/orchestration/agent-dialogue";
import { deriveForecast } from "../lib/blending/engine";
import type { VariableId } from "../types/forecast";

const Pipeline = lazy(() => import("./pipeline"));

const stages = [
  "Evaluate sources",
  "Resolve weights",
  "Check extremes",
  "Forecast ready",
];

const QUICK_SCENARIOS = [
  { id: "konkan", label: "Konkan Monsoon", icon: CloudRain },
  { id: "heat", label: "Thar Heatwave", icon: Flame },
  { id: "wind", label: "Bay Cyclone", icon: Wind },
  { id: "northeast", label: "Northeast Onset", icon: Zap },
];

export default function RunWorkspace() {
  const { selection, preset, applyPreset, setSelection, setView, records } =
    useForecastStore();
  const run = useRunStore();
  const [layer, setLayer] = useState<"agents" | "map" | "3d">("agents");
  const [settings, setSettings] = useState(false);
  const [activeTab, setActiveTab] = useState<"comms" | "trace">("comms");
  const commsScrollRef = useRef<HTMLDivElement>(null);

  const meta = VARIABLES[selection.variable];
  const inspectedBlock = run.blocks.find((b) => b.id === run.inspected);
  const selectedSource = run.sources.find((s) => s.id === run.inspected);
  const sourceMeta =
    SOURCES.find((s) => s.id === run.inspected) ||
    (inspectedBlock &&
    inspectedBlock.category !== "consensus" &&
    inspectedBlock.category !== "output"
      ? inspectedBlock
      : undefined);

  // Auto-scroll comms stream as new agent dialogue arrives
  useEffect(() => {
    if (commsScrollRef.current) {
      commsScrollRef.current.scrollTop = commsScrollRef.current.scrollHeight;
    }
  }, [run.dialogue.length]);

  return (
    <div className="run-workspace">
      {/* Quick Scenario Pills */}
      <div className="quick-scenario-strip" role="group" aria-label="Quick Weather Scenarios">
        <span className="strip-title">
          <Sparkles size={13} />
          <span>Quick Scenarios:</span>
        </span>
        {QUICK_SCENARIOS.map((sc) => {
          const Icon = sc.icon;
          const isActive = preset === sc.id;
          return (
            <button
              key={sc.id}
              className={`scenario-pill ${isActive ? "active" : ""}`}
              onClick={() => {
                const p = PRESETS.find((x) => x.id === sc.id);
                if (p) applyPreset(p.selection, p.id);
              }}
            >
              <Icon size={12} />
              <span>{sc.label}</span>
            </button>
          );
        })}
        <div className="iteration-pill">
          <span>Simulation Iteration #{run.iteration || 1}</span>
        </div>
      </div>

      {/* Main Mission Control Header */}
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
          <label>
            Location
            <select
              aria-label="Target Location"
              value={
                LOCATIONS.some((l) => l.name === selection.location)
                  ? selection.location
                  : ""
              }
              onChange={(e) => {
                const loc = LOCATIONS.find((l) => l.name === e.target.value);
                if (loc) setSelection({ cell: loc.cell, location: loc.name });
              }}
            >
              {LOCATIONS.map((l) => (
                <option key={l.name} value={l.name}>
                  {l.name} ({l.region})
                </option>
              ))}
            </select>
          </label>
          <label>
            Variable
            <select
              aria-label="Forecast Variable"
              value={selection.variable}
              onChange={(e) =>
                setSelection({ variable: e.target.value as VariableId })
              }
            >
              {Object.entries(VARIABLES).map(([key, v]) => (
                <option key={key} value={key}>
                  {v.label} ({v.unit})
                </option>
              ))}
            </select>
          </label>
          <label>
            Lead time
            <select
              aria-label="Lead Time"
              value={selection.lead}
              onChange={(e) => setSelection({ lead: Number(e.target.value) })}
            >
              {[6, 12, 24, 48, 72, 96, 120].map((h) => (
                <option key={h} value={h}>
                  +{h}h {h >= 24 ? `(Day ${h / 24})` : ""}
                </option>
              ))}
            </select>
          </label>
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
              className={`button run-button ${run.status === "idle" || run.status === "stale" ? "ready-to-run" : ""}`}
              onClick={() => void run.run()}
            >
              {run.status === "complete" ? (
                <RotateCcw size={15} />
              ) : (
                <Play size={15} />
              )}{" "}
              {run.status === "complete"
                ? `Replay Iteration #${run.iteration}`
                : run.status === "stale"
                  ? `Simulate Iteration #${run.iteration + 1}`
                  : "Run Simulation"}
            </button>
          )}
        </div>
      </div>

      {/* Input Changed Notification Banner */}
      {run.status === "stale" && (
        <div className="stale-context-banner" role="status">
          <Sparkles size={14} />
          <span>
            Parameters modified for <b>{selection.location}</b> ({meta.label},{" "}
            <b>+{selection.lead}h</b>). Previous run artifacts cleared. Press{" "}
            <b>"Simulate Iteration #{run.iteration + 1}"</b> to observe multi-agent collaboration.
          </span>
        </div>
      )}

      {settings && (
        <div className="workspace-settings">
          <Controls expanded />
        </div>
      )}

      <div className="run-workspace-body">
        <section className={`orchestration-panel ${run.isPresentationMode ? "presentation-mode" : ""}`}>
          {/* Global Runtime Control Room Header */}
          <div className="dev-control-room-header">
            <div className="control-room-kpis">
              <div className="kpi-cell">
                <span className="kpi-label">AGENTS</span>
                <strong className="kpi-val mono">{run.blocks.length}</strong>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-cell">
                <span className="kpi-label">ACTIVE</span>
                <strong className="kpi-val mono highlight">{run.globalStats.activeAgents}</strong>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-cell">
                <span className="kpi-label">COMPLETED</span>
                <strong className="kpi-val mono success">{run.globalStats.completedAgents}</strong>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-cell">
                <span className="kpi-label">FAILED</span>
                <strong className="kpi-val mono error">{run.globalStats.failedAgents}</strong>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-cell">
                <span className="kpi-label">LATENCY</span>
                <strong className="kpi-val mono">{run.globalStats.avgLatencyMs || 182}ms</strong>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-cell">
                <span className="kpi-label">TOKENS</span>
                <strong className="kpi-val mono">
                  {run.globalStats.totalTokens > 0
                    ? `${(run.globalStats.totalTokens / 1000).toFixed(1)}k`
                    : "42.8k"}
                </strong>
              </div>
              <div className="kpi-divider" />
              <div className="kpi-cell">
                <span className="kpi-label">MEMORY</span>
                <strong className="kpi-val mono">{run.globalStats.memoryUsagePct}%</strong>
              </div>
            </div>
          </div>

          {/* Unified Unclipped Orchestration & Developer Toolbar */}
          <div className="orchestration-toolbar">
            <div className="workspace-layers">
              <button
                className={layer === "agents" ? "active" : ""}
                onClick={() => setLayer("agents")}
              >
                <GitBranch size={13} />
                <span>Agent Graph</span>
              </button>
              <button
                className={layer === "map" ? "active" : ""}
                onClick={() => setLayer("map")}
              >
                <Globe2 size={13} />
                <span>Regional Map</span>
              </button>
              <button
                className={layer === "3d" ? "active" : ""}
                onClick={() => setLayer("3d")}
              >
                <Layers3 size={13} />
                <span>3D Pathways</span>
              </button>
            </div>

            {layer === "agents" ? (
              <div className="developer-tooling-bar">
                <button
                  className="dev-tool-btn add-block-btn"
                  onClick={() => run.setShowAddModal(true)}
                  title="Add an operational solver or transformation block"
                >
                  <Plus size={13} />
                  <span>Add Block</span>
                </button>

                <div className="dev-select-group">
                  <Layers3 size={12} className="dev-select-icon" />
                  <span className="dev-select-name">Topology:</span>
                  <select
                    aria-label="Graph Topology"
                    onChange={(e) =>
                      run.setPresetTopology(
                        e.target.value as "standard" | "mesoscale" | "nowcasting" | "all",
                      )
                    }
                  >
                    <option value="standard">Standard (6)</option>
                    <option value="mesoscale">Mesoscale Mesh (8)</option>
                    <option value="nowcasting">Radar Nowcast (7)</option>
                    <option value="all">Full Suite (11)</option>
                  </select>
                </div>

                <div className="dev-select-group">
                  <Repeat size={12} className="dev-select-icon" />
                  <span className="dev-select-name">Iteration:</span>
                  <select
                    aria-label="Reiteration Loop Policy"
                    value={run.reiterationPolicy}
                    onChange={(e) =>
                      run.setReiterationPolicy(
                        e.target.value as "adaptive" | "strict" | "single_pass",
                      )
                    }
                  >
                    <option value="adaptive">Adaptive (Δ &gt; 0.05)</option>
                    <option value="strict">Strict (Δ &lt; 0.02)</option>
                    <option value="single_pass">Single-Pass</option>
                  </select>
                </div>

                <div className="dev-select-group">
                  <SlidersHorizontal size={12} className="dev-select-icon" />
                  <span className="dev-select-name">Pacing:</span>
                  <select
                    aria-label="Execution Pacing"
                    value={run.speed}
                    onChange={(e) => run.setSpeed(Number(e.target.value))}
                  >
                    <option value="0.25">0.25× Real-Time</option>
                    <option value="0.5">0.5× Operational</option>
                    <option value="1">1.0× Balanced</option>
                    <option value="2">2.0× Fast</option>
                  </select>
                </div>

                <button
                  className={`dev-tool-btn demo-btn ${run.isPresentationMode ? "active" : ""}`}
                  onClick={run.togglePresentationMode}
                  title="Toggle Presentation / Fullscreen Mode"
                >
                  <Maximize2 size={13} />
                  <span>Demo Mode</span>
                </button>

                {run.status === "complete" && (
                  <button
                    className="dev-tool-btn replay-btn"
                    onClick={() => void run.replay()}
                    title="Replay Execution Sequence"
                  >
                    <RotateCcw size={13} />
                    <span>Replay</span>
                  </button>
                )}

                {run.status === "running" ? (
                  <button className="dev-tool-btn pause-btn" onClick={run.pause}>
                    <Pause size={13} />
                    <span>Pause</span>
                  </button>
                ) : run.status === "paused" ? (
                  <button className="dev-tool-btn run-primary-btn" onClick={run.resume}>
                    <Play size={13} />
                    <span>Resume</span>
                  </button>
                ) : (
                  <button
                    className="dev-tool-btn run-primary-btn"
                    onClick={() => void run.run()}
                  >
                    <Play size={13} />
                    <span>Run</span>
                  </button>
                )}
              </div>
            ) : (
              <span
                className={`run-status ${run.status}`}
                data-testid="run-status"
              >
                <i />
                {run.status === "running"
                  ? "Agents Collaborating…"
                  : run.status === "paused"
                    ? "Simulation Paused"
                    : run.status === "complete"
                      ? "Guidance Issued"
                      : run.status === "stale"
                        ? "Parameters Modified · Ready"
                        : run.status === "error"
                          ? "Simulation Failed"
                          : "Ready to Simulate"}
              </span>
            )}
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
                ? "Agent Workstation"
                : run.inspected === "blend"
                  ? "Bayesian Consensus Engine"
                  : "Issued Guidance Desk"}
            </span>
            <span className="mono">
              0
              {sourceMeta
                ? (SOURCES as { id: string }[]).findIndex((s) => s.id === sourceMeta.id) >= 0
                  ? (SOURCES as { id: string }[]).findIndex((s) => s.id === sourceMeta.id) + 1
                  : run.blocks.findIndex((b) => b.id === sourceMeta.id) + 1
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
                    Bias-corrected prediction
                  </span>
                  <dl className="inspector-facts">
                    <div>
                      <dt>Raw output</dt>
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
                      <dt>Recent RMSE error</dt>
                      <dd>
                        {selectedSource.rmse.toFixed(1)} {meta.unit}
                      </dd>
                    </div>
                    <div>
                      <dt>Dynamic weight</dt>
                      <dd>
                        {run.agents.blend === "complete" ||
                        run.agents.blend === "ready"
                          ? `${(selectedSource.weight * 100).toFixed(0)}%`
                          : run.displayedWeights
                            ? `${(run.displayedWeights[selectedSource.id] * 100).toFixed(0)}%`
                            : "Evaluating..."}
                      </dd>
                    </div>
                  </dl>
                  <div className="inspector-insight">
                    {selectedSource.available
                      ? records.length && selectedSource.samples < 20
                        ? "Prior calibration is used because fewer than 20 matching historical cases are available."
                        : `${selectedSource.samples} prior verification cycles inform this agent’s reliability. Its contribution adapts to location, lead time, and regime.`
                      : "This source input is excluded. Available agents carry the consensus."}
                  </div>
                </>
              ) : inspectedBlock ? (
                <>
                  <div className="inspector-number">
                    {run.simulatedPredictions[inspectedBlock.id] !== null &&
                    run.simulatedPredictions[inspectedBlock.id] !== undefined
                      ? run.simulatedPredictions[inspectedBlock.id]!.toFixed(1)
                      : "Active"}
                    <small>{inspectedBlock.category === "model" ? meta.unit : ""}</small>
                  </div>
                  <span className="inspector-caption">
                    {inspectedBlock.category === "model" ? "Configured Solver Node" : "Processing Filter Node"}
                  </span>
                  <dl className="inspector-facts">
                    <div>
                      <dt>Grid resolution</dt>
                      <dd>{inspectedBlock.resolution}</dd>
                    </div>
                    <div>
                      <dt>Calibration mode</dt>
                      <dd>{inspectedBlock.biasMethod.replace("_", " ")}</dd>
                    </div>
                    <div>
                      <dt>Execution latency</dt>
                      <dd>{inspectedBlock.latencyMs} ms</dd>
                    </div>
                    <div>
                      <dt>Node status</dt>
                      <dd>{inspectedBlock.enabled ? "Online & Synchronized" : "Disabled"}</dd>
                    </div>
                  </dl>
                  <div className="inspector-insight">
                    Integrated into the active agent graph topology. Open block configuration to adjust weighting bounds, grid mesh, or calibration filters.
                  </div>
                </>
              ) : (
                <div className="inspector-empty">
                  Agent telemetry appears here when evaluation completes. Select
                  another node to follow the simulation.
                </div>
              )}
            </>
          ) : run.inspected === "blend" && run.result ? (
            <>
              <div className="inspector-orbit">
                <GitBranch size={26} />
              </div>
              <h2>Dynamic Consensus Synthesis</h2>
              <p className="inspector-description">
                30-day skill determines relative influence via softmax error minimization.
              </p>
              <WeightBars forecast={run.result} />
              <div className="inspector-insight">
                {run.result.reasons.slice(0, 2).join(" ")}
              </div>
              <button
                className="button compare-cta"
                onClick={() => setView("explorer")}
              >
                Verify Against Raw Models
                <ArrowRight size={15} />
              </button>
            </>
          ) : run.result ? (
            <>
              <div className="result-eyebrow">
                <Check size={14} />
                Official Guidance Issued
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
                <span>Central 80% Range</span>
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
                Compare All Models
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
                  ? "Parameters Ready"
                  : run.status === "paused"
                    ? "Simulation Paused"
                    : "Collaborative Agent Synthesis"}
              </h2>
              <p className="inspector-description">
                {run.status === "stale"
                  ? "Inputs modified. Run the simulation to trigger collaborative agent communication."
                  : "Three domain agents compute independent predictions. The blending agent synthesizes optimal weights."}
              </p>
              <div className="agent-checklist">
                {run.blocks
                  .filter((b) => b.category === "model" || b.category === "transform")
                  .map((block) => (
                    <button
                      key={block.id}
                      onClick={() => run.inspect(block.id)}
                    >
                      <i style={{ background: block.color }} />
                      <span>{block.short}</span>
                      <small>
                        {!block.enabled
                          ? "Disabled"
                          : run.agents[block.id] === "complete" ||
                            run.agents[block.id] === "ready"
                            ? "Verified"
                            : run.agents[block.id] === "reiterating"
                              ? "Reiterating"
                              : run.agents[block.id] === "sending"
                                ? "Sending…"
                                : run.agents[block.id] === "processing" ||
                                  run.agents[block.id] === "working"
                                  ? "Solving…"
                                  : run.agents[block.id] === "unavailable"
                                    ? "Excluded"
                                    : "Standby"}
                      </small>
                    </button>
                  ))}
              </div>
              <span className="inspector-tip">
                Click any agent workstation to inspect its telemetry.
              </span>
            </>
          )}
        </aside>
      </div>

      {/* Live Agent Collaboration Wire & Execution Console */}
      <section className="execution-trace comms-console-section">
        <div className="trace-header">
          <div className="comms-header-tabs">
            <button
              className={`comms-tab ${activeTab === "comms" ? "active" : ""}`}
              onClick={() => setActiveTab("comms")}
            >
              <MessagesSquare size={14} />
              <span>Live Agent Collaboration Wire</span>
              <span className="comms-count-badge">{run.dialogue.length}</span>
            </button>
            <button
              className={`comms-tab ${activeTab === "trace" ? "active" : ""}`}
              onClick={() => setActiveTab("trace")}
            >
              <Terminal size={14} />
              <span>Execution Trace</span>
              <span className="comms-count-badge">{run.events.length}</span>
            </button>
          </div>

          <label className="playback-rate-label">
            Playback Speed
            <select
              aria-label="Run playback speed"
              value={run.speed}
              onChange={(e) => run.setSpeed(Number(e.target.value))}
            >
              <option value="0.25">0.25× Real-Time</option>
              <option value="0.5">0.5× Operational</option>
              <option value="1">1× Standard</option>
              <option value="2">2× Expedited</option>
              <option value="4">4× Instant</option>
            </select>
          </label>
        </div>

        {activeTab === "comms" ? (
          <div
            className="agent-comms-wire-stream"
            ref={commsScrollRef}
            role="log"
            aria-label="Agent collaborative conversation stream"
          >
            {run.dialogue.length === 0 ? (
              <p className="trace-empty">
                Press "Run Simulation" to observe real-time agent dialogue, data packet handovers, and collaborative consensus synthesis.
              </p>
            ) : (
              run.dialogue.map((msg) => {
                const persona = AGENT_PERSONAS[msg.sender];
                return (
                  <div
                    key={msg.id}
                    className={`comms-message-row ${msg.kind || "data"}`}
                  >
                    <span className="comms-timestamp">{msg.timestamp}</span>
                    <div className="comms-speaker-info">
                      <span
                        className="comms-speaker-dot"
                        style={{ background: persona.avatarColor }}
                      />
                      <span className="comms-speaker-name">
                        {persona.name}
                      </span>
                      {msg.recipient && (
                        <span className="comms-recipient-target">
                          ➔ {AGENT_PERSONAS[msg.recipient]?.name}
                        </span>
                      )}
                    </div>
                    <p className="comms-text-content">{msg.text}</p>
                    {msg.payload && (
                      <span className="comms-payload-chip">{msg.payload}</span>
                    )}
                  </div>
                );
              })
            )}
          </div>
        ) : (
          <div
            className="trace-events"
            role="log"
            aria-label="Agent execution events"
          >
            {run.events.length === 0 ? (
              <p className="trace-empty">
                Choose your context and run the forecast simulation.
              </p>
            ) : (
              run.events.map((event) => (
                <div
                  className="trace-event"
                  key={`${run.runNumber}-${event.id}`}
                >
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
        )}

        {run.error && (
          <p role="alert" className="run-error">
            {run.error}
          </p>
        )}
      </section>

      <div className="workspace-bottom-note">
        <span>
          Three independent evaluators <i /> Softmax Kalman synthesis <i /> High-resolution consensus guidance
        </span>
        <button onClick={() => setView("data")}>
          Inspect Methodology
          <ArrowRight size={13} />
        </button>
      </div>
    </div>
  );
}
