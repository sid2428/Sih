import { memo, useMemo } from "react";
import { Handle, Position } from "@xyflow/react";
import type { Node, NodeProps } from "@xyflow/react";
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cpu,
  Database,
  LoaderCircle,
  Radio,
  Repeat,
  RotateCcw,
  Send,
  Settings,
  Wrench,
  Zap,
} from "lucide-react";
import type {
  AgentId,
  AgentStatus,
  GraphBlockConfig,
  NodeRuntimeTelemetry,
} from "../lib/orchestration/protocol";

export type NodeTypeRole =
  | "agent"
  | "consensus"
  | "memory"
  | "tool"
  | "input"
  | "output";

export type GeometricAgentData = {
  agent: AgentId;
  block: GraphBlockConfig;
  title: string;
  subtitle: string;
  color: string;
  status: AgentStatus;
  value: string;
  detail: string;
  weight: string;
  paused: boolean;
  telemetry: NodeRuntimeTelemetry;
  activeTool?: string;
  errorMessage?: string;
  onConfigure: (block: GraphBlockConfig) => void;
  onInspect: (id: string) => void;
};

export type GeometricAgentNode = Node<GeometricAgentData, "agent">;

export function getNodeRole(
  block: GraphBlockConfig,
  agentId: string,
): NodeTypeRole {
  if (block.category === "consensus" || agentId === "blend") return "consensus";
  if (block.category === "memory" || agentId === "memory_analog") return "memory";
  if (
    block.category === "transform" ||
    block.category === "tool" ||
    agentId === "qc_filter" ||
    agentId === "kalman_smoother" ||
    agentId === "orographic_ds" ||
    agentId === "uncertainty_quant"
  ) {
    return "tool";
  }
  if (block.category === "input" || agentId === "obs_stream") return "input";
  if (block.category === "output" || agentId === "output") return "output";
  return "agent";
}

interface GeometrySpec {
  width: number;
  height: number;
  viewBox: string;
  path: string;
  innerPath: string;
  leftPort: { x: number; y: number };
  rightPort: { x: number; y: number };
  topPort?: { x: number; y: number };
  bottomPort?: { x: number; y: number };
}

// Geometric specifications for each distinct computational node type
const GEOMETRIES: Record<NodeTypeRole, GeometrySpec> = {
  // AGENT: Large asymmetric chamfered / hexagonal computational core
  agent: {
    width: 236,
    height: 154,
    viewBox: "0 0 236 154",
    path: "M 18,0 L 214,0 L 236,22 L 236,128 L 214,154 L 22,154 L 0,132 L 0,18 Z",
    innerPath:
      "M 21,4 L 211,4 L 232,25 L 232,125 L 211,150 L 25,150 L 4,129 L 4,21 Z",
    leftPort: { x: 0, y: 77 },
    rightPort: { x: 236, y: 77 },
    topPort: { x: 118, y: 0 },
    bottomPort: { x: 118, y: 154 },
  },

  // CORE / CONSENSUS AGENT: Larger hexagonal-circular hybrid with animated orbital ring
  consensus: {
    width: 260,
    height: 172,
    viewBox: "0 0 260 172",
    path: "M 36,0 L 224,0 A 24,24 0 0 1 248,18 L 260,86 L 248,154 A 24,24 0 0 1 224,172 L 36,172 A 24,24 0 0 1 12,154 L 0,86 L 12,18 A 24,24 0 0 1 36,0 Z",
    innerPath:
      "M 38,4 L 222,4 A 20,20 0 0 1 244,20 L 256,86 L 244,152 A 20,20 0 0 1 222,168 L 38,168 A 20,20 0 0 1 16,152 L 4,86 L 16,20 A 20,20 0 0 1 38,4 Z",
    leftPort: { x: 0, y: 86 },
    rightPort: { x: 260, y: 86 },
    bottomPort: { x: 130, y: 172 },
  },

  // MEMORY: Circular / orbital capsule node with memory retrieval indicators
  memory: {
    width: 220,
    height: 148,
    viewBox: "0 0 220 148",
    path: "M 28,0 L 192,0 A 26,26 0 0 1 220,26 L 220,122 A 26,26 0 0 1 192,148 L 28,148 A 26,26 0 0 1 0,122 L 0,26 A 26,26 0 0 1 28,0 Z",
    innerPath:
      "M 30,4 L 190,4 A 22,22 0 0 1 216,26 L 216,122 A 22,22 0 0 1 190,144 L 30,144 A 22,22 0 0 1 4,122 L 4,26 A 22,22 0 0 1 30,4 Z",
    leftPort: { x: 0, y: 74 },
    rightPort: { x: 220, y: 74 },
    bottomPort: { x: 110, y: 148 },
  },

  // TOOL: Compact geometric octagonal node with dedicated tool icon and input/output ports
  tool: {
    width: 204,
    height: 140,
    viewBox: "0 0 204 140",
    path: "M 20,0 L 184,0 L 204,20 L 204,120 L 184,140 L 20,140 L 0,120 L 0,20 Z",
    innerPath:
      "M 22,4 L 182,4 L 200,22 L 200,118 L 182,136 L 22,136 L 4,118 L 4,22 Z",
    leftPort: { x: 0, y: 70 },
    rightPort: { x: 204, y: 70 },
    topPort: { x: 102, y: 0 },
  },

  // INPUT: Small terminal / origin node with broadcast telemetry antenna
  input: {
    width: 196,
    height: 134,
    viewBox: "0 0 196 134",
    path: "M 0,14 L 14,0 L 176,0 L 196,20 L 196,114 L 176,134 L 14,134 L 0,120 Z",
    innerPath:
      "M 4,16 L 16,4 L 173,4 L 192,23 L 192,111 L 173,130 L 16,130 L 4,118 Z",
    leftPort: { x: 0, y: 67 },
    rightPort: { x: 196, y: 67 },
  },

  // OUTPUT: Distinct terminal / result console with HUD visor and guidance seal
  output: {
    width: 242,
    height: 154,
    viewBox: "0 0 242 154",
    path: "M 24,0 L 242,0 L 242,128 L 216,154 L 0,154 L 0,24 Z",
    innerPath:
      "M 26,4 L 238,4 L 238,126 L 214,150 L 4,150 L 4,26 Z",
    leftPort: { x: 0, y: 77 },
    rightPort: { x: 242, y: 77 },
  },
};

export const GeometricAgentNodeView = memo(function GeometricAgentNodeView({
  data,
  selected,
}: NodeProps<GeometricAgentNode>) {
  const role = useMemo(
    () => getNodeRole(data.block, data.agent),
    [data.block, data.agent],
  );
  const geo = GEOMETRIES[role];

  const isWorking =
    data.status === "processing" ||
    data.status === "working" ||
    data.status === "sending" ||
    data.status === "receiving" ||
    data.status === "blending" ||
    data.status === "generating";

  const isReiterating = data.status === "reiterating";
  const isConverging = data.status === "converging";
  const isComplete =
    data.status === "complete" ||
    data.status === "ready" ||
    data.status === "completed";
  const isError = data.status === "error";
  const isRetrying = data.status === "retrying";
  const isDisabled = !data.block.enabled;

  const categoryLabel = useMemo(() => {
    switch (role) {
      case "consensus":
        return "SYNTHESIZER";
      case "memory":
        return "MEMORY BANK";
      case "tool":
        return "TRANSFORM TOOL";
      case "input":
        return "INGEST ORIGIN";
      case "output":
        return "RESULT TERMINAL";
      default:
        return "SOLVER CORE";
    }
  }, [role]);

  const progress =
    data.telemetry?.progressPct ?? (isComplete ? 100 : isWorking ? 68 : 0);

  // Accessible label for screen readers and Playwright test assertions
  const testAriaLabel = useMemo(() => {
    if (data.agent === "nwp") return "Inspect Physics agent";
    if (data.agent === "ensemble") return "Inspect Ensemble agent";
    if (data.agent === "ai") return "Inspect AI pattern agent";
    if (data.agent === "blend") return "Inspect Blending agent";
    if (data.agent === "output") return "Inspect Forecast result";
    return `Inspect ${data.title}`;
  }, [data.agent, data.title]);

  // Port state calculation
  const isReceiving = data.status === "receiving" || (isWorking && role !== "input");
  const isTransmitting =
    data.status === "sending" || isComplete || (isWorking && role === "input");

  return (
    <div
      className={`geometric-node-container node-role-${role} ${data.agent} ${data.status} ${
        selected ? "selected" : ""
      } ${isDisabled ? "disabled-node" : ""} ${isError ? "execution-broken" : ""}`}
      style={
        {
          width: `${geo.width}px`,
          height: `${geo.height}px`,
          "--node-accent": data.color,
        } as React.CSSProperties
      }
      role="button"
      tabIndex={0}
      aria-label={testAriaLabel}
      onClick={() => data.onInspect(data.agent)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          data.onInspect(data.agent);
        }
      }}
    >
      {/* -------------------------------------------------------------
          SVG COMPUTATIONAL CHASSIS (GEOMETRIC SILHOUETTE)
          ------------------------------------------------------------- */}
      <svg
        className="node-chassis-svg"
        viewBox={geo.viewBox}
        width={geo.width}
        height={geo.height}
        preserveAspectRatio="none"
      >
        <defs>
          <linearGradient
            id={`chassis-grad-${data.agent}`}
            x1="0%"
            y1="0%"
            x2="100%"
            y2="100%"
          >
            <stop offset="0%" stopColor="#fffefa" stopOpacity="1" />
            <stop offset="50%" stopColor="#f8f7f2" stopOpacity="1" />
            <stop offset="100%" stopColor="#f2f4ef" stopOpacity="1" />
          </linearGradient>

          <radialGradient
            id={`core-glow-${data.agent}`}
            cx="50%"
            cy="50%"
            r="50%"
          >
            <stop
              offset="0%"
              stopColor={isError ? "#ef4444" : data.color}
              stopOpacity={isWorking ? "0.35" : "0.15"}
            />
            <stop
              offset="100%"
              stopColor={isError ? "#ef4444" : data.color}
              stopOpacity="0"
            />
          </radialGradient>

          <pattern
            id="hazard-stripes"
            width="8"
            height="8"
            patternUnits="userSpaceOnUse"
            patternTransform="rotate(45)"
          >
            <rect width="4" height="8" fill="#ef4444" opacity="0.4" />
            <rect x="4" width="4" height="8" fill="#1f1214" opacity="0.8" />
          </pattern>
        </defs>



        {/* Memory Retrieval Concentric Sectors for Memory Node */}
        {role === "memory" && (
          <g className="memory-radar-system">
            <circle
              cx="110"
              cy="74"
              r="62"
              className="memory-ring memory-ring-outer"
            />
            <circle
              cx="110"
              cy="74"
              r="44"
              className="memory-ring memory-ring-mid"
            />
            <circle
              cx="110"
              cy="74"
              r="26"
              className="memory-ring memory-ring-inner"
            />
            {isWorking && (
              <line
                x1="110"
                y1="74"
                x2="172"
                y2="74"
                className="memory-radar-scanner"
              />
            )}
          </g>
        )}

        {/* Tool Straight-Through Circuit Micro-Trace */}
        {role === "tool" && (
          <g className="tool-circuit-trace">
            <line
              x1="0"
              y1="70"
              x2="72"
              y2="70"
              className="tool-bus-line"
              stroke={data.color}
            />
            <line
              x1="132"
              y1="70"
              x2="204"
              y2="70"
              className="tool-bus-line"
              stroke={data.color}
            />
            <polygon
              points="60,67 66,70 60,73"
              fill={data.color}
              className="tool-flow-chevron"
            />
            <polygon
              points="144,67 150,70 144,73"
              fill={data.color}
              className="tool-flow-chevron"
            />
          </g>
        )}

        {/* Base Solid Hull (Chassis fill) */}
        <path
          d={geo.path}
          fill={`url(#chassis-grad-${data.agent})`}
          className="chassis-hull"
        />

        {/* Internal Core Radial Glow */}
        <circle
          cx={geo.width / 2}
          cy={geo.height / 2}
          r={geo.width * 0.45}
          fill={`url(#core-glow-${data.agent})`}
          className={`core-radial-field ${isWorking ? "radial-pulsing" : ""}`}
        />

        {/* Inner Technical Bevel Groove */}
        <path
          d={geo.innerPath}
          fill="none"
          className="chassis-inner-groove"
        />

        {/* Corner Telemetry Brackets / Chamfer Ticks */}
        <g className="chassis-corner-ticks">
          <circle
            cx="22"
            cy="12"
            r="1.5"
            className={`tech-rivet ${progress > 20 ? "illuminated" : ""}`}
          />
          <circle
            cx={geo.width - 22}
            cy="12"
            r="1.5"
            className={`tech-rivet ${progress > 50 ? "illuminated" : ""}`}
          />
          <circle
            cx={geo.width - 22}
            cy={geo.height - 12}
            r="1.5"
            className={`tech-rivet ${progress > 75 ? "illuminated" : ""}`}
          />
          <circle
            cx="22"
            cy={geo.height - 12}
            r="1.5"
            className={`tech-rivet ${progress > 95 ? "illuminated" : ""}`}
          />
        </g>

        {/* Error Fracture / Broken State Decoration */}
        {isError && (
          <g className="error-interrupted-circuit">
            <path
              d={`M 14,${geo.height - 14} L ${geo.width - 14},${geo.height - 14}`}
              stroke="url(#hazard-stripes)"
              strokeWidth="6"
              className="hazard-stripe-bar"
            />
            <path
              d={`M 0,${geo.height * 0.5} L 40,${geo.height * 0.45} L 55,${
                geo.height * 0.58
              } L 80,${geo.height * 0.5} M 140,${geo.height * 0.5} L 165,${
                geo.height * 0.44
              } L 180,${geo.height * 0.54} L ${geo.width},${geo.height * 0.5}`}
              stroke="#ef4444"
              strokeWidth="1.6"
              strokeDasharray="3 3"
              fill="none"
              className="fractured-circuit-path"
            />
          </g>
        )}

        {/* Base Perimeter Border Track */}
        <path
          d={geo.path}
          fill="none"
          className={`chassis-perimeter-base ${isError ? "border-broken" : ""}`}
        />

        {/* Geometric Perimeter Progress Fill (Gradually Fills Along Geometry) */}
        <path
          d={geo.path}
          fill="none"
          pathLength="100"
          strokeDasharray="100"
          strokeDashoffset={100 - progress}
          className={`chassis-perimeter-progress ${
            isWorking ? "perimeter-working-pulse" : ""
          } ${isComplete ? "perimeter-complete-glow" : ""} ${
            isError ? "perimeter-error-strobe" : ""
          }`}
          style={{
            stroke: isError
              ? "#ef4444"
              : isRetrying
                ? "#f59e0b"
                : data.color,
          }}
        />

        {/* Active Laser Dash Sweep along the contour during processing */}
        {isWorking && !isError && (
          <path
            d={geo.path}
            fill="none"
            className="chassis-perimeter-dash-flow"
            style={{ stroke: data.color }}
          />
        )}

        {/* -------------------------------------------------------------
            PHYSICALLY INTEGRATED PERIMETER PORTS
            ------------------------------------------------------------- */}
        {/* Left Port Socket (Data Inlet) */}
        {role !== "input" && (
          <g
            className={`physical-port-socket port-left ${
              isReceiving ? "active-inlet" : ""
            }`}
          >
            <circle
              cx={geo.leftPort.x}
              cy={geo.leftPort.y}
              r="7"
              className="port-socket-bezel"
            />
            <circle
              cx={geo.leftPort.x}
              cy={geo.leftPort.y}
              r="4.5"
              className="port-socket-contact"
            />
            <circle
              cx={geo.leftPort.x}
              cy={geo.leftPort.y}
              r="2.5"
              className="port-socket-dot"
              fill={isReceiving ? "#38bdf8" : "#475569"}
            />
            {isReceiving && (
              <circle
                cx={geo.leftPort.x}
                cy={geo.leftPort.y}
                r="10"
                className="port-reception-ring"
              />
            )}
          </g>
        )}

        {/* Right Port Socket (Data Outlet / Emitter) */}
        {role !== "output" && (
          <g
            className={`physical-port-socket port-right ${
              isTransmitting ? "active-outlet" : ""
            }`}
          >
            <circle
              cx={geo.rightPort.x}
              cy={geo.rightPort.y}
              r="7"
              className="port-socket-bezel"
            />
            <circle
              cx={geo.rightPort.x}
              cy={geo.rightPort.y}
              r="4.5"
              className="port-socket-contact"
            />
            <circle
              cx={geo.rightPort.x}
              cy={geo.rightPort.y}
              r="2.5"
              className="port-socket-dot"
              fill={
                isTransmitting
                  ? data.color
                  : isComplete
                    ? "#10b981"
                    : "#475569"
              }
            />
            {isTransmitting && (
              <circle
                cx={geo.rightPort.x}
                cy={geo.rightPort.y}
                r="10"
                className="port-radiation-ring"
              />
            )}
          </g>
        )}

        {/* Top Port Socket (Context / Memory Input) */}
        {geo.topPort && (
          <g
            className={`physical-port-socket port-top ${
              data.status === "receiving" ? "active-inlet" : ""
            }`}
          >
            <circle
              cx={geo.topPort.x}
              cy={geo.topPort.y}
              r="6.5"
              className="port-socket-bezel"
            />
            <circle
              cx={geo.topPort.x}
              cy={geo.topPort.y}
              r="4"
              className="port-socket-contact"
            />
            <circle
              cx={geo.topPort.x}
              cy={geo.topPort.y}
              r="2"
              className="port-socket-dot"
              fill="#67e8f9"
            />
          </g>
        )}

        {/* Bottom Port Socket (Consensus Reiteration Feedback) */}
        {geo.bottomPort && (
          <g
            className={`physical-port-socket port-bottom ${
              isReiterating ? "active-feedback" : ""
            }`}
          >
            <circle
              cx={geo.bottomPort.x}
              cy={geo.bottomPort.y}
              r="6.5"
              className="port-socket-bezel"
            />
            <circle
              cx={geo.bottomPort.x}
              cy={geo.bottomPort.y}
              r="4"
              className="port-socket-contact"
            />
            <circle
              cx={geo.bottomPort.x}
              cy={geo.bottomPort.y}
              r="2"
              className="port-socket-dot"
              fill={isReiterating ? "#f59e0b" : "#475569"}
            />
            {isReiterating && (
              <circle
                cx={geo.bottomPort.x}
                cy={geo.bottomPort.y}
                r="10"
                className="port-reiteration-ring"
              />
            )}
          </g>
        )}
      </svg>

      {/* -------------------------------------------------------------
          REACTFLOW HANDLES (PRECISELY ATTACHED TO PHYSICAL PORTS)
          ------------------------------------------------------------- */}
      {/* Left Data In Handle */}
      {role !== "input" && (
        <Handle
          type="target"
          position={Position.Left}
          id="data_in"
          className="integrated-node-handle handle-left"
          title="Data Input Port"
          style={{
            top: `${geo.leftPort.y}px`,
            left: "0px",
          }}
        />
      )}

      {/* Top Memory / Context Handle */}
      {geo.topPort && (
        <Handle
          type="target"
          position={Position.Top}
          id="memory_in"
          className="integrated-node-handle handle-top"
          title="Memory & Context Stream Port"
          style={{
            top: "0px",
            left: `${geo.topPort.x}px`,
          }}
        />
      )}

      {/* Right Data Out Handle */}
      {role !== "output" && (
        <Handle
          type="source"
          position={Position.Right}
          id="data_out"
          className="integrated-node-handle handle-right"
          title="Data Output Port"
          style={{
            top: `${geo.rightPort.y}px`,
            right: "0px",
          }}
        />
      )}

      {/* Bottom Feedback Handle */}
      {geo.bottomPort && (
        <Handle
          type="source"
          position={Position.Bottom}
          id="feedback_out"
          className="integrated-node-handle handle-bottom"
          title="Reiteration Feedback Port"
          style={{
            bottom: "0px",
            left: `${geo.bottomPort.x}px`,
          }}
        />
      )}

      {/* -------------------------------------------------------------
          INTERNAL COMPUTATIONAL MODULE INTERFACE
          ------------------------------------------------------------- */}
      <div className="module-interior-content">
        {/* Header row: Core reactor glyph, Category Pill, Status indicator, Config button */}
        <div className="module-header-row">
          <div className="module-header-left">
            <span
              className={`core-reactor-glyph ${
                isWorking ? "pulsing-reactor" : ""
              } ${isComplete ? "settled-reactor" : ""}`}
            >
              {role === "consensus" ? (
                <Cpu size={12} className="reactor-icon" />
              ) : role === "memory" ? (
                <Database size={12} className="reactor-icon" />
              ) : role === "tool" ? (
                <Wrench size={12} className="reactor-icon" />
              ) : role === "input" ? (
                <Radio size={12} className="reactor-icon" />
              ) : role === "output" ? (
                <CheckCircle2 size={12} className="reactor-icon" />
              ) : (
                <Zap size={12} className="reactor-icon" />
              )}
            </span>
            <div className="module-badge-stack">
              <span className="module-category-pill">{categoryLabel}</span>
              <span className="module-res-tag">{data.block.resolution}</span>
            </div>
          </div>

          <div className="module-header-right">
            <span
              className={`module-status-pill ${data.status} ${
                isError ? "status-anomaly" : ""
              }`}
            >
              {isError ? (
                <AlertTriangle size={10} className="status-ico-error" />
              ) : isRetrying ? (
                <RotateCcw size={10} className="spin-reverse status-ico-retry" />
              ) : isReiterating ? (
                <Repeat size={10} className="spin-reverse status-ico-reiterate" />
              ) : isConverging ? (
                <CheckCircle2 size={10} className="status-ico-converge" />
              ) : isWorking ? (
                data.status === "sending" ? (
                  <Send size={10} className={data.paused ? "" : "sending-pulse"} />
                ) : data.status === "receiving" ? (
                  <Radio size={10} className={data.paused ? "" : "receiving-pulse"} />
                ) : (
                  <LoaderCircle size={10} className={data.paused ? "" : "spin"} />
                )
              ) : isComplete ? (
                <Check size={10} className="status-ico-check" />
              ) : (
                <i className="status-idle-dot" />
              )}
              <span className="status-label-text">
                {isDisabled
                  ? "Disabled"
                  : isError
                    ? "Anomaly"
                    : isRetrying
                      ? "Retrying"
                      : isReiterating
                        ? "Reiterating"
                        : isConverging
                          ? "Converged"
                          : isComplete
                            ? "Complete"
                            : data.status === "processing" ||
                                data.status === "working"
                              ? "Processing"
                              : data.status === "sending"
                                ? "Streaming"
                                : data.status === "receiving"
                                  ? "Receiving"
                                  : data.status === "blending"
                                    ? "Synthesizing"
                                    : data.status === "generating"
                                      ? "Assembling"
                                      : data.status === "unavailable"
                                        ? "Excluded"
                                        : "Standby"}
              </span>
            </span>

            <button
              className="module-config-trigger"
              title={`Configure ${data.title}`}
              aria-label={`Configure ${data.title}`}
              onClick={(e) => {
                e.stopPropagation();
                data.onConfigure(data.block);
              }}
            >
              <Settings size={11} />
            </button>
          </div>
        </div>

        {/* Module Title */}
        <h3 className="module-title" title={data.title}>
          {data.title}
        </h3>

        {/* Dedicated Tool Chip or Error Diagnostics Banner */}
        {data.activeTool && isWorking && (
          <div className="module-tool-chip mono">
            <Wrench size={9} /> {data.activeTool}
          </div>
        )}
        {data.errorMessage && (
          <div className="module-error-chip mono">
            <AlertTriangle size={9} /> {data.errorMessage}
          </div>
        )}

        {/* Primary Value Readout & Weight Gauge */}
        <div className="module-value-row">
          <strong className="module-primary-value" title={data.value}>
            {data.value}
          </strong>
          {data.weight && (
            <span className="module-weight-badge mono">{data.weight}</span>
          )}
        </div>

        {/* Segmented Micro Progress Track */}
        <div className="module-progress-track">
          <div
            className="module-progress-fill"
            style={{
              width: `${progress}%`,
              background: isError
                ? "#ef4444"
                : isRetrying
                  ? "#f59e0b"
                  : data.color,
            }}
          />
        </div>

        {/* Computational Telemetry Instrumentation Grid */}
        <div className="module-telemetry-grid mono">
          <div className="telemetry-bracket-cell">
            <span className="telemetry-label">LAT</span>
            <span className="telemetry-val">
              {data.telemetry?.latencyMs ?? data.block.latencyMs}ms
            </span>
          </div>
          <div className="telemetry-bracket-cell">
            <span className="telemetry-label">TOK</span>
            <span className="telemetry-val">
              {data.telemetry?.tokens ?? 1800}
            </span>
          </div>
          <div className="telemetry-bracket-cell">
            <span className="telemetry-label">CONF</span>
            <span className="telemetry-val">
              {data.telemetry?.confidence ?? 94}%
            </span>
          </div>
        </div>
      </div>
    </div>
  );
});

export default GeometricAgentNodeView;
