import { useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  ReactFlow,
  getBezierPath,
  useNodesState,
} from "@xyflow/react";
import type {
  Edge,
  EdgeProps,
  ReactFlowInstance,
} from "@xyflow/react";
import {
  Activity,
  Check,
  Grid3X3,
  Maximize2,
  Repeat,
  ZoomIn,
  ZoomOut,
} from "lucide-react";
import { VARIABLES } from "../data/mock-profile";
import { useRunStore } from "../store/run-store";
import { useForecastStore } from "../store/forecast-store";
import type {
  AgentId,
  GraphBlockConfig,
  PacketType,
} from "../lib/orchestration/protocol";
import NodeConfigModal from "./node-config-modal";
import AddBlockModal from "./add-block-modal";
import NodeInspectorDrawer from "./node-inspector-drawer";
import ExecutionTimeline from "./execution-timeline";
import GeometricAgentNodeView, {
  type GeometricAgentNode,
} from "./geometric-node";
import "@xyflow/react/dist/style.css";

type AgentNode = GeometricAgentNode;

const nodeTypes = { agent: GeometricAgentNodeView };

function SignalEdge(props: EdgeProps) {
  const [path] = getBezierPath(props);
  const data = props.data as
    | {
        color: string;
        isTransmitting: boolean;
        packetType?: PacketType;
        isFeedback?: boolean;
        transmissionMessage: string;
        reduced: boolean;
      }
    | undefined;

  const isTransmitting = data?.isTransmitting ?? false;
  const isFeedback = data?.isFeedback ?? false;
  const packetType = data?.packetType || (isFeedback ? "feedback" : "data");

  return (
    <>
      {isTransmitting && (
        <>
          <path
            d={path}
            className={`signal-edge-glow ${isFeedback ? "feedback-glow" : ""}`}
            stroke={isFeedback ? "#f59e0b" : data?.color ?? "#38bdf8"}
            strokeWidth={isFeedback ? "14" : "10"}
            fill="none"
          />
          <path
            d={path}
            className={`signal-edge-flow-dash ${isFeedback ? "feedback-dash" : ""}`}
            stroke={isFeedback ? "#fbbf24" : data?.color ?? "#38bdf8"}
            strokeWidth={isFeedback ? "2.5" : "2"}
            strokeDasharray={isFeedback ? "4 4" : "6 6"}
            fill="none"
          />
        </>
      )}
      <BaseEdge
        path={path}
        style={{
          stroke: isFeedback ? "#f59e0b" : data?.color ?? "#334460",
          strokeWidth: isTransmitting ? 2.5 : isFeedback ? 1.8 : 1.4,
          strokeDasharray: isFeedback ? "4 4" : undefined,
          opacity: isTransmitting ? 1 : 0.5,
          transition: "stroke-width 0.3s ease, opacity 0.3s ease",
        }}
      />
      {/* Animated Data Packets / Particles */}
      {isTransmitting && !data?.reduced && (
        <g className="data-packet-group">
          <animateMotion
            dur={isFeedback ? "0.8s" : "1.0s"}
            repeatCount="indefinite"
            path={path}
            calcMode="linear"
            keyPoints={isFeedback ? "1; 0" : undefined}
            keyTimes={isFeedback ? "0; 1" : undefined}
          />
          <animate
            attributeName="opacity"
            values="0; 1; 1; 0.95; 0"
            keyTimes="0; 0.1; 0.8; 0.92; 1"
            dur="1.0s"
            repeatCount="indefinite"
          />

          {packetType === "memory" ? (
            // Context/Memory retrieval packet: clustered cyan particles
            <g>
              <circle cx="-12" cy="0" r="2.5" fill="#67e8f9" opacity="0.6" />
              <circle cx="0" cy="0" r="3.5" fill="#22d3ee" />
              <circle cx="12" cy="0" r="2.5" fill="#67e8f9" opacity="0.6" />
            </g>
          ) : packetType === "tool" ? (
            // Structured compact tool packet
            <g>
              <rect x="-18" y="-7" width="36" height="14" rx="4" fill="#0f172a" stroke="#a78bfa" strokeWidth="1.2" />
              <circle cx="-10" cy="0" r="2" fill="#c084fc" />
              <line x1="-5" y1="0" x2="12" y2="0" stroke="#a78bfa" strokeWidth="1.5" />
            </g>
          ) : packetType === "feedback" ? (
            // Amber looping particle
            <g>
              <rect x="-24" y="-8" width="48" height="16" rx="8" fill="#1c1308" stroke="#f59e0b" strokeWidth="1.2" />
              <circle cx="-14" cy="0" r="2.5" fill="#fbbf24" />
              <text x="-8" y="3" fill="#fef3c7" fontSize="7" fontWeight="700" fontFamily="'IBM Plex Mono', monospace">
                RETRY
              </text>
            </g>
          ) : (
            // Standard data packet
            <g>
              <circle cx="-14" cy="0" r="1.8" fill={data?.color ?? "#38bdf8"} opacity="0.4" />
              <rect x="-16" y="-7" width="32" height="14" rx="7" fill="#09101c" stroke={data?.color ?? "#38bdf8"} strokeWidth="1.2" />
              <circle cx="-8" cy="0" r="2.2" fill={data?.color ?? "#fff"}>
                <animate attributeName="r" values="2; 3; 2" dur="0.5s" repeatCount="indefinite" />
              </circle>
              <text x="-2" y="3" fill="#f0f5ff" fontSize="7.5" fontWeight="600" fontFamily="'IBM Plex Mono', monospace">
                DATA
              </text>
            </g>
          )}
        </g>
      )}
    </>
  );
}

const edgeTypes = { signal: SignalEdge };

export default function AgentCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const flow = useRef<ReactFlowInstance<AgentNode, Edge> | null>(null);

  const {
    agents,
    simulatedPredictions,
    displayedWeights,
    transmission,
    sources,
    result,
    status,
    inspected,
    inspect,
    blocks,
    reiteration,
    nodeTelemetry,
    nodeTools,
    nodeErrors,
    layoutType,
    setLayoutType,
    showAddModal,
    setShowAddModal,
  } = useRunStore();

  const selection = useForecastStore((s) => s.selection);
  const unit = VARIABLES[selection.variable].unit;

  const [configuringBlock, setConfiguringBlock] =
    useState<GraphBlockConfig | null>(null);
  const [activeInspectorNode, setActiveInspectorNode] = useState<string | null>(null);

  const [reduced, setReduced] = useState(
    () => matchMedia("(prefers-reduced-motion: reduce)").matches,
  );

  useEffect(() => {
    if (!host.current) return;
    let frame = 0;
    const observer = new ResizeObserver(() => {
      cancelAnimationFrame(frame);
      frame = requestAnimationFrame(() => {
        void flow.current
          ?.fitView({ padding: 0.08 })
          .catch((error) =>
            console.warn("Unable to fit the agent graph", error),
          );
      });
    });
    observer.observe(host.current);
    return () => {
      observer.disconnect();
      cancelAnimationFrame(frame);
    };
  }, []);

  useEffect(() => {
    const media = matchMedia("(prefers-reduced-motion: reduce)");
    const change = () => setReduced(media.matches);
    media.addEventListener("change", change);
    return () => media.removeEventListener("change", change);
  }, []);

  // Compute dynamic layout based on active blocks and categories
  const layout = useMemo(() => {
    const inputs = blocks.filter((b) => b.category === "input");
    const models = blocks.filter((b) => b.category === "model");
    const memories = blocks.filter((b) => b.category === "memory");
    const transforms = blocks.filter(
      (b) => b.category === "transform" || b.category === "tool",
    );
    const consensus = blocks.filter((b) => b.category === "consensus");
    const outputs = blocks.filter((b) => b.category === "output");

    const positions: {
      block: GraphBlockConfig;
      x: number;
      y: number;
    }[] = [];

    const hasInputs = inputs.length > 0;
    const hasTransforms = transforms.length > 0;

    const inputX = 0;
    const modelX = hasInputs ? 290 : 0;
    const transformX = modelX + 320;
    const blendX = hasTransforms ? transformX + 320 : modelX + 340;
    const outX = blendX + 340;

    // Inputs (if configured)
    inputs.forEach((inp, i) => {
      positions.push({
        block: inp,
        x: inputX,
        y: Math.max(90, ((models.length - 1) * 185) / 2) + i * 185,
      });
    });

    // Column: Memories (top) and Models
    memories.forEach((mem, i) => {
      positions.push({
        block: mem,
        x: modelX,
        y: i * 185 - 145,
      });
    });

    models.forEach((m, i) => {
      positions.push({
        block: m,
        x: modelX,
        y: (memories.length > 0 ? 35 : 0) + i * 185,
      });
    });

    // Column: Transforms / Tools
    transforms.forEach((t, i) => {
      positions.push({
        block: t,
        x: transformX,
        y: i * 185 + 40,
      });
    });

    // Column: Consensus Synthesizer Core
    consensus.forEach((c, i) => {
      positions.push({
        block: c,
        x: blendX,
        y: Math.max(90, ((models.length - 1) * 185) / 2) + i * 185,
      });
    });

    // Column: Guidance Output Console
    outputs.forEach((o, i) => {
      positions.push({
        block: o,
        x: outX,
        y: Math.max(90, ((models.length - 1) * 185) / 2) + i * 185,
      });
    });

    return positions;
  }, [blocks]);

  const mapped = useMemo(
    () =>
      layout.map(({ block, x, y }) => {
        const agentStatus = agents[block.id] || "waiting";
        const isBlendDone =
          agents.blend === "complete" || agents.blend === "ready";
        const isSource = block.category === "model";
        const sourceData = sources.find((s) => s.id === block.id);
        const pred = simulatedPredictions[block.id] ?? null;

        const assignedWeight =
          isSource && displayedWeights
            ? displayedWeights[block.id] ?? 0
            : isSource && sourceData
              ? sourceData.weight
              : 0;

        let valueDisplay = "";
        let weightDisplay = "";
        let detailDisplay = "";

        if (block.category === "output") {
          if (agentStatus === "complete" || agentStatus === "ready") {
            valueDisplay = result
              ? `${result.value.toFixed(1)} ${unit}`
              : "130.9 mm";
            detailDisplay = "Official guidance released";
          } else if (agentStatus === "generating") {
            valueDisplay = "Assembling…";
            detailDisplay = "Validating extreme thresholds";
          } else {
            valueDisplay = "Awaiting consensus";
            detailDisplay = "Operations desk standby";
          }
        } else if (block.category === "consensus") {
          if (isBlendDone) {
            valueDisplay = "Weights resolved";
            detailDisplay = "Kalman consensus locked";
          } else if (agentStatus === "blending") {
            valueDisplay = "Synthesizing weights…";
            detailDisplay = "Kalman innovation update";
          } else if (agentStatus === "reiterating") {
            valueDisplay = `Reiteration (Pass ${reiteration.pass})`;
            detailDisplay = `Δ = ${reiteration.delta.toFixed(3)} > ${reiteration.tolerance}`;
          } else if (agentStatus === "receiving") {
            valueDisplay = "Receiving predictions";
            detailDisplay = "Assessing model covariance";
          } else {
            valueDisplay = "Ready to orchestrate";
            detailDisplay = "Adaptive Bayesian policy";
          }
        } else if (block.category === "memory") {
          if (agentStatus === "complete" || agentStatus === "ready") {
            valueDisplay = "12 Analogs active";
            detailDisplay = "ERA5 historical index";
          } else if (agentStatus === "processing") {
            valueDisplay = "Retrieving…";
            detailDisplay = "Nearest neighbor synoptic scan";
          } else {
            valueDisplay = "Indexed";
            detailDisplay = "40yr synoptic database";
          }
        } else if (block.category === "transform" || block.category === "tool") {
          if (agentStatus === "complete" || agentStatus === "ready") {
            valueDisplay = "Verified OK";
            detailDisplay = `${block.resolution} spatial grid applied`;
          } else if (agentStatus === "error") {
            valueDisplay = "Anomaly Flagged";
            detailDisplay = "3.4σ gradient exceeded";
          } else if (agentStatus === "retrying") {
            valueDisplay = "Retrying #1";
            detailDisplay = "Gaussian kernel smoothing";
          } else if (agentStatus === "processing") {
            valueDisplay = "Filtering…";
            detailDisplay = "Boundary layer analysis";
          } else {
            valueDisplay = "Standby";
            detailDisplay = `${block.latencyMs}ms execution budget`;
          }
        } else if (block.category === "input") {
          if (agentStatus === "complete" || agentStatus === "ready") {
            valueDisplay = "Stream Active";
            detailDisplay = "Doppler & AWS packets synced";
          } else if (agentStatus === "processing" || agentStatus === "sending") {
            valueDisplay = "Broadcasting…";
            detailDisplay = "1,420 AWS + radar telemetry";
          } else {
            valueDisplay = "Telemetry Online";
            detailDisplay = "Ingest buffer standby";
          }
        } else {
          // Model Solvers
          if (
            agentStatus === "sending" ||
            agentStatus === "complete" ||
            agentStatus === "ready" ||
            agentStatus === "reiterating" ||
            agentStatus === "converging"
          ) {
            valueDisplay =
              pred !== null ? `${pred.toFixed(1)} ${unit}` : "Evaluated";
            if (
              (isBlendDone || displayedWeights) &&
              assignedWeight > 0
            ) {
              weightDisplay = `${(assignedWeight * 100).toFixed(0)}% weight`;
            }
            detailDisplay = `${sourceData?.samples ?? 120} verification cycles`;
          } else if (
            agentStatus === "processing" ||
            agentStatus === "working"
          ) {
            valueDisplay = "Solving dynamics…";
            detailDisplay = `${block.resolution} resolution solver`;
          } else if (agentStatus === "unavailable" || !block.enabled) {
            valueDisplay = "No input";
            detailDisplay = "Excluded from consensus";
          } else {
            valueDisplay = "Standby";
            detailDisplay = `${block.resolution} dx · ${block.latencyMs}ms`;
          }
        }

        const activeTool = nodeTools[block.id]?.toolName;
        const errorMessage = nodeErrors[block.id]?.errorMsg;

        return {
          id: block.id,
          type: "agent" as const,
          position: { x, y },
          selected: inspected === block.id || activeInspectorNode === block.id,
          ariaLabel: `Inspect ${block.name}`,
          data: {
            agent: block.id,
            block,
            title: block.name,
            subtitle: block.description,
            color: block.color,
            status: agentStatus,
            value: valueDisplay,
            paused: status === "paused",
            weight: weightDisplay,
            detail: detailDisplay,
            telemetry: nodeTelemetry[block.id],
            activeTool,
            errorMessage,
            onConfigure: (b: GraphBlockConfig) => setConfiguringBlock(b),
            onInspect: (id: string) => {
              inspect(id);
              setActiveInspectorNode(id);
            },
          },
        };
      }),
    [
      layout,
      agents,
      simulatedPredictions,
      displayedWeights,
      sources,
      result,
      status,
      inspected,
      activeInspectorNode,
      unit,
      reiteration,
      nodeTelemetry,
      nodeTools,
      nodeErrors,
      inspect,
    ],
  );

  const [nodes, setNodes, onNodesChange] = useNodesState<AgentNode>(mapped);

  useEffect(() => {
    setNodes((current) =>
      mapped.map((n) => ({
        ...n,
        position: current.find((x) => x.id === n.id)?.position ?? n.position,
      })),
    );
  }, [mapped, setNodes]);

  // Construct dynamic edges between inputs, models, transforms, consensus, and output
  const edges: Edge[] = useMemo(() => {
    const list: Edge[] = [];
    const inputs = blocks.filter((b) => b.category === "input" && b.enabled);
    const models = blocks.filter((b) => b.category === "model" && b.enabled);
    const memories = blocks.filter((b) => b.category === "memory" && b.enabled);
    const transforms = blocks.filter(
      (b) => (b.category === "transform" || b.category === "tool") && b.enabled,
    );
    const hasTransforms = transforms.length > 0;
    const primaryTransform = transforms[0];

    // Inputs -> Models
    if (inputs.length > 0) {
      for (const inp of inputs) {
        for (const model of models) {
          const edgeId = `${inp.id}-${model.id}`;
          const isTransmitting =
            (transmission?.edgeId === edgeId ||
              transmission?.source === inp.id) &&
            status === "running";
          list.push({
            id: edgeId,
            source: inp.id,
            target: model.id,
            sourceHandle: "data_out",
            targetHandle: "data_in",
            type: "signal",
            data: {
              color: inp.color,
              isTransmitting,
              packetType: "data",
              transmissionMessage: isTransmitting
                ? transmission?.message || "Telemetry feed"
                : "",
              reduced,
            },
          });
        }
      }
    }

    // Memory -> AI Model
    if (memories.length > 0 && blocks.some((b) => b.id === "ai" && b.enabled)) {
      const isMemoryTransmitting =
        transmission?.edgeId === "memory-ai" && status === "running";
      list.push({
        id: "memory-ai",
        source: memories[0].id,
        target: "ai",
        sourceHandle: "data_out",
        targetHandle: "memory_in",
        type: "signal",
        data: {
          color: "#67e8f9",
          isTransmitting: isMemoryTransmitting,
          packetType: "memory",
          transmissionMessage: "Context loaded",
          reduced,
        },
      });
    }

    // Model -> Intermediate Filter OR Model -> Blend
    for (const model of models) {
      const targetId = hasTransforms ? primaryTransform.id : "blend";
      const edgeId = `${model.id}-${targetId}`;
      const isTransmitting =
        transmission?.edgeId === edgeId && status === "running";

      list.push({
        id: edgeId,
        source: model.id,
        target: targetId,
        sourceHandle: "data_out",
        targetHandle: "data_in",
        type: "signal",
        data: {
          color: model.color,
          isTransmitting,
          packetType: "data",
          transmissionMessage: isTransmitting
            ? transmission?.message || "Transmitting"
            : "",
          reduced,
        },
      });
    }

    // Intermediate Filters -> Blend
    if (hasTransforms) {
      for (const trans of transforms) {
        const edgeId = `${trans.id}-blend`;
        const isTransmitting =
          transmission?.edgeId === edgeId && status === "running";

        list.push({
          id: edgeId,
          source: trans.id,
          target: "blend",
          sourceHandle: "data_out",
          targetHandle: "data_in",
          type: "signal",
          data: {
            color: trans.color,
            isTransmitting,
            packetType: "data",
            transmissionMessage: "Filtered payload",
            reduced,
          },
        });
      }
    }

    // Blend -> Output
    const isOutputTransmitting =
      transmission?.edgeId === "blend-output" && status === "running";

    list.push({
      id: "blend-output",
      source: "blend",
      target: "output",
      sourceHandle: "data_out",
      targetHandle: "data_in",
      type: "signal",
      data: {
        color: "#a5adff",
        isTransmitting: isOutputTransmitting,
        packetType: "result",
        transmissionMessage: isOutputTransmitting
          ? transmission?.message || "Consensus"
          : "",
        reduced,
      },
    });

    // REITERATION FEEDBACK EDGE (Reverse looping edge)
    if (reiteration.active && reiteration.feedbackEdge) {
      list.push({
        id: "reiteration-feedback-edge",
        source: "blend",
        target: "nwp",
        sourceHandle: "feedback_out",
        targetHandle: "data_in",
        type: "signal",
        data: {
          color: "#f59e0b",
          isTransmitting: true,
          isFeedback: true,
          packetType: "feedback",
          transmissionMessage: reiteration.feedbackEdge.message,
          reduced,
        },
      });
    }

    return list;
  }, [blocks, transmission, status, reiteration, reduced]);

  const handleZoomIn = () => flow.current?.zoomIn({ duration: 200 });
  const handleZoomOut = () => flow.current?.zoomOut({ duration: 200 });
  const handleFitView = () => flow.current?.fitView({ padding: 0.08, duration: 300 });

  return (
    <div className="agent-canvas" data-testid="agent-canvas" ref={host}>
      {/* Floating Reiteration & Convergence Live HUD */}
      {(reiteration.active || status === "running") && (
        <div className="reiteration-live-hud" role="status" aria-live="polite">
          <div className="hud-badge-row">
            <span
              className={`hud-status-badge ${reiteration.converged ? "converged" : reiteration.active ? "reiterating" : "running"}`}
            >
              {reiteration.converged ? (
                <>
                  <Check size={11} /> Pass {reiteration.pass}/{reiteration.maxPasses} Converged
                </>
              ) : reiteration.active ? (
                <>
                  <Repeat size={11} className="spin-reverse" /> Reiteration Pass {reiteration.pass}/{reiteration.maxPasses}
                </>
              ) : (
                <>
                  <Activity size={11} /> Pass 1/2 Analyzing
                </>
              )}
            </span>
            <span className="hud-metric">
              Residual Δ: <b>{reiteration.delta > 0 ? reiteration.delta.toFixed(3) : "Evaluating"}</b>
              <small>(Tol: {reiteration.tolerance})</small>
            </span>
          </div>
          {reiteration.reason && (
            <p className="hud-reason">{reiteration.reason}</p>
          )}
        </div>
      )}

      {/* Professional Graph Viewport Controls */}
      <div className="canvas-viewport-controls" role="toolbar" aria-label="Graph View Controls">
        <button onClick={handleZoomIn} title="Zoom In">
          <ZoomIn size={14} />
        </button>
        <button onClick={handleZoomOut} title="Zoom Out">
          <ZoomOut size={14} />
        </button>
        <button onClick={handleFitView} title="Fit Entire Graph">
          <Maximize2 size={14} />
        </button>
        <button
          onClick={() => {
            setLayoutType(layoutType === "dag" ? "hierarchical" : "dag");
            setTimeout(handleFitView, 100);
          }}
          title="Auto Layout"
        >
          <Grid3X3 size={14} />
        </button>
      </div>

      <div className="agent-flow-stage">
        <ReactFlow
          onInit={(instance) => {
            flow.current = instance;
          }}
          nodes={nodes}
          edges={edges}
          nodeTypes={nodeTypes}
          edgeTypes={edgeTypes}
          onNodesChange={onNodesChange}
          onNodeClick={(_, node) => {
            inspect(node.id as AgentId);
            setActiveInspectorNode(node.id);
          }}
          nodesFocusable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.08 }}
          minZoom={0.25}
          maxZoom={1.8}
          zoomOnScroll={false}
          panOnScroll={false}
          colorMode="dark"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={22}
            size={1}
            color="#243248"
          />
        </ReactFlow>
      </div>

      {/* Bottom Chronological Execution Timeline */}
      <ExecutionTimeline />

      {/* Slide-Over Node Inspector Drawer */}
      {activeInspectorNode && (
        <NodeInspectorDrawer
          nodeId={activeInspectorNode}
          onClose={() => setActiveInspectorNode(null)}
        />
      )}

      {/* Modals for configuring and adding blocks */}
      {configuringBlock && (
        <NodeConfigModal
          block={configuringBlock}
          onClose={() => setConfiguringBlock(null)}
        />
      )}

      {showAddModal && (
        <AddBlockModal onClose={() => setShowAddModal(false)} />
      )}
    </div>
  );
}
