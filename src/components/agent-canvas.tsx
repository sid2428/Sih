import { memo, useEffect, useMemo, useRef, useState } from "react";
import {
  Background,
  BackgroundVariant,
  BaseEdge,
  Controls,
  EdgeLabelRenderer,
  Handle,
  Position,
  ReactFlow,
  getBezierPath,
  useNodesState,
} from "@xyflow/react";
import type {
  Edge,
  EdgeProps,
  Node,
  NodeProps,
  ReactFlowInstance,
} from "@xyflow/react";
import {
  Activity,
  ArrowUpRight,
  BrainCircuit,
  Check,
  Cpu,
  Layers3,
  LoaderCircle,
  Radio,
  ShieldCheck,
} from "lucide-react";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { useRunStore } from "../store/run-store";
import { useForecastStore } from "../store/forecast-store";
import type { AgentId, AgentStatus } from "../lib/orchestration/protocol";
import "@xyflow/react/dist/style.css";

type AgentData = {
  agent: AgentId;
  title: string;
  subtitle: string;
  color: string;
  status: AgentStatus;
  value: string;
  detail: string;
  weight: string;
  paused: boolean;
};
type AgentNode = Node<AgentData, "agent">;
const icons = {
  nwp: Cpu,
  ensemble: Layers3,
  ai: BrainCircuit,
  blend: Activity,
  output: ShieldCheck,
};
const AgentNodeView = memo(function AgentNodeView({
  data,
  selected,
}: NodeProps<AgentNode>) {
  const Icon = icons[data.agent];
  return (
    <div
      className={`agent-node ${data.agent} ${data.status} ${selected ? "selected" : ""}`}
      style={{ "--agent-color": data.color } as React.CSSProperties}
      role="button"
      tabIndex={0}
      aria-label={`Inspect ${data.title}`}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          useRunStore.getState().inspect(data.agent);
        }
      }}
    >
      {data.agent !== "nwp" &&
        data.agent !== "ensemble" &&
        data.agent !== "ai" && (
          <Handle type="target" position={Position.Left} />
        )}
      {data.agent !== "output" && (
        <Handle type="source" position={Position.Right} />
      )}
      <div className="agent-node-top">
        <div className="agent-symbol">
          <Icon size={18} />
        </div>
        <span className={`agent-node-status ${data.status}`}>
          {data.status === "working" ? (
            <LoaderCircle size={11} className={data.paused ? "" : "spin"} />
          ) : data.status === "ready" ? (
            <Check size={11} />
          ) : (
            <i />
          )}
          {data.status === "working"
            ? data.paused
              ? "Paused"
              : "Evaluating"
            : data.status === "ready"
              ? "Complete"
              : data.status === "unavailable"
                ? "Excluded"
                : "Standby"}
        </span>
      </div>
      <h3>{data.title}</h3>
      <p>{data.subtitle}</p>
      <div className="agent-node-value">
        <strong>{data.value}</strong>
        <span>{data.weight}</span>
      </div>
      <div className="agent-node-footer">
        <span>{data.detail}</span>
        <ArrowUpRight size={12} />
      </div>
      {data.status === "working" && !data.paused && (
        <div className="agent-scan" />
      )}
    </div>
  );
});
const nodeTypes = { agent: AgentNodeView };
function SignalEdge(props: EdgeProps) {
  const [path, x, y] = getBezierPath(props);
  const data = props.data as
    | {
        color: string;
        active: boolean;
        weight: number;
        label: string;
        reduced: boolean;
      }
    | undefined;
  return (
    <>
      {data?.active && (
        <path
          d={path}
          className="signal-edge-glow"
          stroke={data.color}
          strokeWidth="9"
          fill="none"
        />
      )}
      <BaseEdge
        path={path}
        style={{
          stroke: data?.color ?? "#506078",
          strokeWidth: 1.2 + (data?.weight ?? 0) * 5,
          opacity: data?.active ? 0.9 : 0.5,
        }}
      />
      {data?.active &&
        !data.reduced &&
        [0, 0.6, 1.2].map((delay) => (
          <circle key={delay} r="3" fill={data.color}>
            <animateMotion
              dur="1.8s"
              begin={`${delay}s`}
              repeatCount="indefinite"
              path={path}
            />
          </circle>
        ))}
      {data?.label && (
        <EdgeLabelRenderer>
          <span
            className="flow-weight-label"
            style={{
              transform: `translate(-50%, -50%) translate(${x}px,${y}px)`,
              color: data.color,
            }}
          >
            {data.label}
          </span>
        </EdgeLabelRenderer>
      )}
    </>
  );
}
const edgeTypes = { signal: SignalEdge };
const layout: {
  id: AgentId;
  x: number;
  y: number;
  title: string;
  subtitle: string;
  color: string;
}[] = [
  {
    id: "nwp",
    x: 0,
    y: 0,
    title: "Physics agent",
    subtitle: "Numerical weather prediction",
    color: SOURCES[0].color,
  },
  {
    id: "ensemble",
    x: 0,
    y: 140,
    title: "Ensemble agent",
    subtitle: "Multi-member guidance",
    color: SOURCES[1].color,
  },
  {
    id: "ai",
    x: 0,
    y: 280,
    title: "AI pattern agent",
    subtitle: "Learned weather patterns",
    color: SOURCES[2].color,
  },
  {
    id: "blend",
    x: 335,
    y: 140,
    title: "Blending agent",
    subtitle: "Evaluate · calibrate · combine",
    color: "#a5adff",
  },
  {
    id: "output",
    x: 662,
    y: 140,
    title: "Forecast result",
    subtitle: "Extreme-aware guidance",
    color: "#75d4b3",
  },
];
export default function AgentCanvas() {
  const host = useRef<HTMLDivElement>(null);
  const flow = useRef<ReactFlowInstance<AgentNode, Edge> | null>(null);
  const { agents, sources, result, status, inspected, inspect } = useRunStore();
  const selection = useForecastStore((s) => s.selection);
  const unit = VARIABLES[selection.variable].unit;
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
          ?.fitView({ padding: 0.045 })
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
  const mapped = useMemo(
    () =>
      layout.map((item) => {
        const source = sources.find((s) => s.id === item.id);
        const resolved = agents.blend === "ready";
        const ready = source?.available && agents[item.id] === "ready";
        const value =
          item.id === "output"
            ? result
              ? `${result.value.toFixed(1)} ${unit}`
              : "Awaiting blend"
            : item.id === "blend"
              ? resolved
                ? "Weights resolved"
                : agents.blend === "working"
                  ? "Finding the balance…"
                  : "Ready to orchestrate"
              : ready
                ? `${source.corrected.toFixed(1)} ${unit}`
                : agents[item.id] === "unavailable"
                  ? "No input"
                  : "Awaiting evaluation";
        return {
          id: item.id,
          type: "agent" as const,
          position: { x: item.x, y: item.y },
          selected: inspected === item.id,
          ariaLabel: `Inspect ${item.title}`,
          data: {
            agent: item.id,
            title: item.title,
            subtitle: item.subtitle,
            color: item.color,
            status: agents[item.id],
            value,
            paused: status === "paused",
            weight:
              source && resolved
                ? `${(source.weight * 100).toFixed(0)}% weight`
                : "",
            detail:
              item.id === "output"
                ? "Inspect final guidance"
                : item.id === "blend"
                  ? "Inspect weight decisions"
                  : ready
                    ? `${source.samples} historical cases`
                    : "Bias correction + recent skill",
          },
        };
      }),
    [agents, sources, result, status, inspected, unit],
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
  const edges: Edge[] = SOURCES.map((source) => {
    const weight = sources.find((s) => s.id === source.id)?.weight ?? 0;
    return {
      id: `${source.id}-blend`,
      source: source.id,
      target: "blend",
      type: "signal",
      data: {
        color: source.color,
        active:
          status === "running" &&
          (agents[source.id] === "working" || agents.blend === "working"),
        weight: agents.blend === "ready" ? weight : 0,
        label: agents.blend === "ready" ? `${(weight * 100).toFixed(0)}%` : "",
        reduced,
      },
    };
  });
  edges.push({
    id: "blend-output",
    source: "blend",
    target: "output",
    type: "signal",
    data: {
      color: "#a5adff",
      active: status === "running" && agents.output === "working",
      weight: agents.output === "ready" ? 0.6 : 0,
      label: agents.output === "ready" ? "Blended" : "",
      reduced,
    },
  });
  return (
    <div className="agent-canvas" data-testid="agent-canvas" ref={host}>
      <div className="canvas-coordinate">
        <Radio size={13} />
        <span>Source evaluators</span>
        <span>Adaptive orchestration</span>
        <span>Forecast</span>
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
          onNodeClick={(_, node) => inspect(node.id as AgentId)}
          nodesFocusable={false}
          nodesConnectable={false}
          edgesFocusable={false}
          deleteKeyCode={null}
          fitView
          fitViewOptions={{ padding: 0.045 }}
          minZoom={0.4}
          maxZoom={1.8}
          zoomOnScroll={false}
          panOnScroll={false}
          colorMode="dark"
        >
          <Background
            variant={BackgroundVariant.Dots}
            gap={21}
            size={1}
            color="#344057"
          />
          <Controls
            showInteractive={false}
            position="bottom-center"
            orientation="horizontal"
          />
        </ReactFlow>
      </div>
      <span className="canvas-hint">
        Select an agent to inspect its reasoning. Drag to arrange · pinch to
        zoom
      </span>
    </div>
  );
}
