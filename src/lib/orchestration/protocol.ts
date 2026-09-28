import type {
  Forecast,
  ForecastRecord,
  Selection,
  SourceId,
  SourceResult,
} from "../../types/forecast";

export type BuiltInModelId =
  | SourceId
  | "radar_nowcast"
  | "satellite_ir"
  | "ecmwf_ifs";

export type TransformBlockId =
  | "qc_filter"
  | "orographic_ds"
  | "uncertainty_quant";

export type CoreOrchestratorId = "blend" | "output";

export type AgentId = string;

export type ExecutionLifecycleState =
  | "idle"
  | "queued"
  | "processing"
  | "completed"
  | "waiting"
  | "error"
  | "retrying"
  | "paused";

export type AgentStatus =
  | ExecutionLifecycleState
  | "sending"
  | "receiving"
  | "blending"
  | "generating"
  | "reiterating"
  | "converging"
  | "qc_check"
  | "complete"
  | "unavailable"
  | "working"
  | "ready";

export type PacketType =
  | "data"
  | "context"
  | "memory"
  | "tool"
  | "result"
  | "feedback"
  | "error";

export interface TransmissionState {
  edgeId: string;
  source: AgentId;
  target: AgentId;
  message: string;
  value?: string;
  packetType?: PacketType;
  isFeedback?: boolean;
  sourceHandle?: string;
  targetHandle?: string;
}

export interface NodeRuntimeTelemetry {
  latencyMs: number;
  tokens: number;
  confidence: number;
  progressPct: number;
  iterationText?: string;
  inputPayload?: string;
  outputPayload?: string;
}

export interface NodeMemoryContext {
  shortTermCount: number;
  retrievedDocs: string[];
  contextWindowPct: number;
}

export interface NodeToolCall {
  toolName: string;
  query: string;
  response: string;
  durationMs: number;
  status: "invoking" | "completed" | "failed";
}

export interface NodeErrorRecovery {
  errorMsg?: string;
  retryCount: number;
  maxRetries: number;
  recovering: boolean;
}

export interface TimelineEvent {
  id: number;
  timestamp: string;
  agentId: string;
  agentName: string;
  status: "completed" | "processing" | "waiting" | "failed" | "retrying";
  detail: string;
  durationMs?: number;
}

export interface GlobalRuntimeStats {
  totalAgents: number;
  activeAgents: number;
  completedAgents: number;
  failedAgents: number;
  totalTokens: number;
  avgLatencyMs: number;
  memoryUsagePct: number;
}

export interface ReiterationState {
  active: boolean;
  pass: number;
  maxPasses: number;
  delta: number;
  tolerance: number;
  converged: boolean;
  reason: string;
  feedbackEdge?: {
    source: string;
    target: string;
    message: string;
  } | null;
}

export interface GraphBlockConfig {
  id: string;
  name: string;
  short: string;
  category: "model" | "transform" | "consensus" | "output" | "memory" | "tool" | "input";
  color: string;
  description: string;
  resolution: string; // e.g. "4km", "1km", "9km", "0.25°"
  latencyMs: number;
  biasMethod: "quantile_mapping" | "kalman_bias" | "linear_decay" | "orographic_elevation";
  memberCount?: number;
  enabled: boolean;
  userAdded?: boolean;
  minWeight?: number;
  maxWeight?: number;
  group?: string;
}

export interface WorkerJob {
  kind: "source" | "blend";
  source?: SourceId;
  selection: Selection;
  records: ForecastRecord[];
}

export type WorkerReply =
  | { ok: true; source?: SourceResult; forecast?: Forecast }
  | { ok: false; error: string };

export interface AgentDialogueMessage {
  id: number;
  timestamp: string;
  sender: AgentId | "system";
  senderName: string;
  senderRole: string;
  recipient?: AgentId;
  text: string;
  payload?: string;
  kind?: "data" | "ack" | "synthesis" | "alert" | "system" | "output" | "reiteration" | "tool" | "memory";
}

export interface ActiveDialogueBubble {
  sender: AgentId;
  recipient?: AgentId;
  text: string;
  payload?: string;
}

export interface RunEvent {
  id: number;
  agent: AgentId | "system";
  title: string;
  detail: string;
}
