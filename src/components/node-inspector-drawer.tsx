import {
  AlertTriangle,
  Cpu,
  Database,
  FileText,
  Gauge,
  Terminal,
  Wrench,
  X,
} from "lucide-react";
import { useRunStore } from "../store/run-store";
import { useForecastStore } from "../store/forecast-store";
import { VARIABLES } from "../data/mock-profile";

interface NodeInspectorDrawerProps {
  nodeId: string;
  onClose: () => void;
}

export default function NodeInspectorDrawer({
  nodeId,
  onClose,
}: NodeInspectorDrawerProps) {
  const {
    blocks,
    agents,
    simulatedPredictions,
    displayedWeights,
    nodeTelemetry,
    nodeMemory,
    nodeTools,
    nodeErrors,
    timelineEvents,
    result,
  } = useRunStore();

  const selection = useForecastStore((s) => s.selection);
  const unit = VARIABLES[selection.variable].unit;

  const block = blocks.find((b) => b.id === nodeId);
  if (!block) return null;

  const status = agents[nodeId] || "waiting";
  const telemetry = nodeTelemetry[nodeId] || {
    latencyMs: block.latencyMs,
    tokens: 1800,
    confidence: 94,
    progressPct: 100,
    iterationText: "01/01",
    inputPayload: "3.2 KB",
    outputPayload: "1.4 KB",
  };
  const memory = nodeMemory[nodeId];
  const tool = nodeTools[nodeId];
  const errorRec = nodeErrors[nodeId];
  const prediction = simulatedPredictions[nodeId];
  const weight = displayedWeights ? displayedWeights[nodeId] : undefined;

  const nodeEvents = timelineEvents.filter((e) => e.agentId === nodeId);

  return (
    <aside className="node-inspector-drawer" role="complementary" aria-label={`Inspector for ${block.name}`}>
      <div className="drawer-header" style={{ "--node-color": block.color } as React.CSSProperties}>
        <div className="drawer-header-info">
          <span className="drawer-tag" style={{ background: block.color, color: "#080c14" }}>
            {block.short}
          </span>
          <div>
            <h3>{block.name}</h3>
            <p className="drawer-category">
              {block.category.toUpperCase()} NODE · {block.resolution}
            </p>
          </div>
        </div>
        <button className="icon-button" onClick={onClose} aria-label="Close inspector">
          <X size={16} />
        </button>
      </div>

      <div className="drawer-body">
        {/* Status Pill & Progress */}
        <div className={`drawer-status-card ${status}`}>
          <div className="status-indicator-row">
            <span className={`status-beacon ${status}`}>
              <i /> {status.toUpperCase()}
            </span>
            <span className="telemetry-progress-text mono">{telemetry.progressPct}%</span>
          </div>
          <div className="drawer-progress-bar">
            <div
              className="drawer-progress-fill"
              style={{
                width: `${telemetry.progressPct}%`,
                background: status === "error" ? "#ef4444" : block.color,
              }}
            />
          </div>
        </div>

        {/* Error / Recovery Alert */}
        {errorRec && (
          <div className="drawer-error-box">
            <div className="error-header">
              <AlertTriangle size={14} />
              <strong>{errorRec.recovering ? "Recovery Active" : "Execution Anomaly"}</strong>
            </div>
            <p>{errorRec.errorMsg}</p>
            <div className="retry-stats mono">
              Attempt: {errorRec.retryCount} / {errorRec.maxRetries} · Auto-smoothing applied
            </div>
          </div>
        )}

        {/* Real Computational Telemetry Grid */}
        <div className="drawer-section">
          <h4>
            <Gauge size={13} /> Runtime Telemetry
          </h4>
          <div className="telemetry-stat-grid">
            <div className="telemetry-stat">
              <span className="stat-label">Execution Latency</span>
              <strong className="stat-value mono">{telemetry.latencyMs}ms</strong>
            </div>
            <div className="telemetry-stat">
              <span className="stat-label">Token Footprint</span>
              <strong className="stat-value mono">{telemetry.tokens} tok</strong>
            </div>
            <div className="telemetry-stat">
              <span className="stat-label">Confidence Score</span>
              <strong className="stat-value mono">{telemetry.confidence}%</strong>
            </div>
            <div className="telemetry-stat">
              <span className="stat-label">Horizontal Grid</span>
              <strong className="stat-value mono">{block.resolution}</strong>
            </div>
          </div>
        </div>

        {/* Inbound & Outbound Data Payloads */}
        <div className="drawer-section">
          <h4>
            <Cpu size={13} /> Data Stream Payloads
          </h4>
          <dl className="payload-facts">
            <div>
              <dt>Computed Prediction</dt>
              <dd className="mono">
                {prediction !== null && prediction !== undefined
                  ? `${prediction.toFixed(1)} ${unit}`
                  : block.id === "output" && result
                    ? `${result.value.toFixed(1)} ${unit}`
                    : "Awaiting resolution"}
              </dd>
            </div>
            {weight !== undefined && (
              <div>
                <dt>Consensus Weight</dt>
                <dd className="mono">{(weight * 100).toFixed(0)}%</dd>
              </div>
            )}
            <div>
              <dt>Calibration Method</dt>
              <dd className="mono">{block.biasMethod.replace(/_/g, " ")}</dd>
            </div>
            <div>
              <dt>Input Payload Size</dt>
              <dd className="mono">{telemetry.inputPayload || "3.2 KB"}</dd>
            </div>
          </dl>
        </div>

        {/* Memory Context (if present) */}
        {memory && (
          <div className="drawer-section">
            <h4>
              <Database size={13} /> Context & Memory Bank
            </h4>
            <div className="memory-card">
              <div className="memory-header">
                <span>Short-Term Context</span>
                <span className="mono">{memory.shortTermCount} items</span>
              </div>
              <div className="memory-window-bar">
                <span>Context Window: {memory.contextWindowPct}%</span>
                <div className="bar-track">
                  <div
                    className="bar-fill"
                    style={{ width: `${memory.contextWindowPct}%`, background: "#67e8f9" }}
                  />
                </div>
              </div>
              <ul className="retrieved-docs-list">
                {memory.retrievedDocs.map((doc, idx) => (
                  <li key={idx}>
                    <FileText size={11} /> {doc}
                  </li>
                ))}
              </ul>
            </div>
          </div>
        )}

        {/* Tool Execution Invocation (if present) */}
        {tool && (
          <div className="drawer-section">
            <h4>
              <Wrench size={13} /> Active Tool Invocation
            </h4>
            <div className="tool-call-box">
              <div className="tool-call-top">
                <span className="tool-name mono">{tool.toolName}</span>
                <span className={`tool-badge ${tool.status}`}>{tool.status.toUpperCase()}</span>
              </div>
              <div className="tool-query mono">Query: {tool.query}</div>
              <div className="tool-response mono">Response: {tool.response}</div>
              <span className="tool-latency mono">Latency: {tool.durationMs}ms</span>
            </div>
          </div>
        )}

        {/* Chronological Execution Trace */}
        <div className="drawer-section">
          <h4>
            <Terminal size={13} /> Execution Trace Log
          </h4>
          <div className="drawer-trace-list">
            {nodeEvents.length === 0 ? (
              <p className="trace-empty">Execution events will register when this node activates.</p>
            ) : (
              nodeEvents.map((evt) => (
                <div key={evt.id} className="trace-line">
                  <span className="trace-stamp mono">{evt.timestamp}</span>
                  <span className="trace-text">{evt.detail}</span>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </aside>
  );
}
