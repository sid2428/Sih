import { create } from "zustand";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { useForecastStore } from "./forecast-store";
import { evaluateJob } from "../lib/orchestration/worker-client";
import {
  getSimulatedAgentDialogue,
  createDialogueMessage,
} from "../lib/orchestration/agent-dialogue";
import type {
  ActiveDialogueBubble,
  AgentDialogueMessage,
  AgentId,
  AgentStatus,
  GlobalRuntimeStats,
  GraphBlockConfig,
  NodeErrorRecovery,
  NodeMemoryContext,
  NodeRuntimeTelemetry,
  NodeToolCall,
  ReiterationState,
  RunEvent,
  TimelineEvent,
  TransmissionState,
} from "../lib/orchestration/protocol";
import type { Forecast, SourceId, SourceResult } from "../types/forecast";

export type RunStatus =
  | "idle"
  | "running"
  | "paused"
  | "complete"
  | "stale"
  | "error";

export const DEFAULT_BLOCKS: GraphBlockConfig[] = [
  {
    id: "nwp",
    name: "Physics-based NWP",
    short: "NWP-UM",
    category: "model",
    color: "#3b82b6",
    description: "Numerical weather prediction core (NCMRWF 4km non-hydrostatic)",
    resolution: "4km",
    latencyMs: 540,
    biasMethod: "quantile_mapping",
    enabled: true,
  },
  {
    id: "ensemble",
    name: "Ensemble Guidance",
    short: "EPS-51",
    category: "model",
    color: "#4f9d8a",
    description: "Multi-member stochastic consensus (51 members)",
    resolution: "12km",
    latencyMs: 780,
    memberCount: 51,
    biasMethod: "kalman_bias",
    enabled: true,
  },
  {
    id: "ai",
    name: "AI Pattern Model",
    short: "FNO-AI",
    category: "model",
    color: "#8b6fc7",
    description: "Fourier neural operator analog matching (ERA5 40yr)",
    resolution: "25km",
    latencyMs: 280,
    biasMethod: "linear_decay",
    enabled: true,
  },
  {
    id: "memory_analog",
    name: "Synoptic Memory Bank",
    short: "ERA5-MEM",
    category: "memory",
    color: "#5b9eaa",
    description: "Historical synoptic analogs, patterns & spatial covariance",
    resolution: "0.25°",
    latencyMs: 140,
    biasMethod: "quantile_mapping",
    enabled: true,
  },
  {
    id: "qc_filter",
    name: "Quality Control Filter",
    short: "QC-GATE",
    category: "transform",
    color: "#d98c32",
    description: "Gross error screening & spatial continuity check",
    resolution: "4km",
    latencyMs: 120,
    biasMethod: "quantile_mapping",
    enabled: true,
  },
  {
    id: "blend",
    name: "Blending Consensus Engine",
    short: "BLEND",
    category: "consensus",
    color: "#d98c32",
    description: "Adaptive Bayesian & Kalman consensus synthesizer",
    resolution: "Adaptive",
    latencyMs: 410,
    biasMethod: "kalman_bias",
    enabled: true,
  },
  {
    id: "output",
    name: "Official Guidance Desk",
    short: "OUTPUT",
    category: "output",
    color: "#4f9d8a",
    description: "Extreme hazard verification & operational release",
    resolution: "4km",
    latencyMs: 190,
    biasMethod: "quantile_mapping",
    enabled: true,
  },
];

export const CATALOG_ADDITIONAL_BLOCKS: GraphBlockConfig[] = [
  {
    id: "radar_nowcast",
    name: "Doppler Radar Extrapolator",
    short: "RADAR",
    category: "model",
    color: "#3b82b6",
    description: "Optical-flow precipitation nowcasting (0–6h lead)",
    resolution: "1km",
    latencyMs: 160,
    biasMethod: "linear_decay",
    enabled: true,
    userAdded: true,
  },
  {
    id: "satellite_ir",
    name: "INSAT-3DR Radiance Agent",
    short: "INSAT-IR",
    category: "model",
    color: "#bd795a",
    description: "Rapid-scan infrared cloud-top temperature",
    resolution: "4km",
    latencyMs: 380,
    biasMethod: "quantile_mapping",
    enabled: true,
    userAdded: true,
  },
  {
    id: "ecmwf_ifs",
    name: "ECMWF Integrated Forecasting",
    short: "IFS-HRES",
    category: "model",
    color: "#527e9c",
    description: "High-resolution global deterministic model (9km)",
    resolution: "9km",
    latencyMs: 820,
    biasMethod: "kalman_bias",
    enabled: true,
    userAdded: true,
  },
  {
    id: "orographic_ds",
    name: "Terrain Orographic Downscaler",
    short: "TERRAIN-DS",
    category: "transform",
    color: "#4f9d8a",
    description: "SRTM 1km DEM elevation & lapse-rate downscaler",
    resolution: "1km",
    latencyMs: 240,
    biasMethod: "orographic_elevation",
    enabled: true,
    userAdded: true,
  },
  {
    id: "uncertainty_quant",
    name: "Conformal Uncertainty Quantifier",
    short: "CONFORMAL-UQ",
    category: "transform",
    color: "#8b6fc7",
    description: "Finite-sample valid prediction intervals & EVT bounds",
    resolution: "4km",
    latencyMs: 210,
    biasMethod: "kalman_bias",
    enabled: true,
    userAdded: true,
  },
  {
    id: "obs_stream",
    name: "Observation Radar & AWS Stream",
    short: "RAW-INGEST",
    category: "input",
    color: "#3b82b6",
    description: "Doppler radar volume & 1,420 automated weather stations real-time stream",
    resolution: "Realtime",
    latencyMs: 35,
    biasMethod: "quantile_mapping",
    enabled: true,
    userAdded: true,
  },
  {
    id: "kalman_smoother",
    name: "Adaptive Kalman Spatial Filter",
    short: "KALMAN-TOOL",
    category: "tool",
    color: "#718096",
    description: "Multi-scale spatial error covariance and Kalman smoothing gate",
    resolution: "2km",
    latencyMs: 95,
    biasMethod: "kalman_bias",
    enabled: true,
    userAdded: true,
  },
];

export interface RunStore {
  status: RunStatus;
  stage: number;
  runNumber: number;
  iteration: number;
  speed: number;
  blocks: GraphBlockConfig[];
  reiteration: ReiterationState;
  reiterationPolicy: "adaptive" | "strict" | "single_pass";
  agents: Record<AgentId, AgentStatus>;
  agentMessages: Record<AgentId, string>;
  simulatedPredictions: Record<string, number | null>;
  displayedWeights: Record<string, number> | null;
  transmission: TransmissionState | null;
  dialogue: AgentDialogueMessage[];
  activeDialogueBubble: ActiveDialogueBubble | null;
  telemetry: Record<AgentId, Record<string, string | number>>;
  events: RunEvent[];
  timelineEvents: TimelineEvent[];
  globalStats: GlobalRuntimeStats;
  nodeTelemetry: Record<string, NodeRuntimeTelemetry>;
  nodeMemory: Record<string, NodeMemoryContext>;
  nodeTools: Record<string, NodeToolCall>;
  nodeErrors: Record<string, NodeErrorRecovery>;
  sources: SourceResult[];
  result: Forecast | null;
  error: string;
  inspected: AgentId;
  isPresentationMode: boolean;
  showAddModal: boolean;
  layoutType: "dag" | "hierarchical" | "radial";
  run: () => Promise<void>;
  replay: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  setSpeed: (speed: number) => void;
  inspect: (id: AgentId) => void;
  setShowAddModal: (show: boolean) => void;
  togglePresentationMode: () => void;
  setLayoutType: (layout: "dag" | "hierarchical" | "radial") => void;
  addBlock: (block: GraphBlockConfig) => void;
  removeBlock: (id: string) => void;
  toggleBlock: (id: string) => void;
  updateBlockConfig: (id: string, updates: Partial<GraphBlockConfig>) => void;
  setPresetTopology: (preset: "standard" | "mesoscale" | "nowcasting" | "all") => void;
  setReiterationPolicy: (policy: "adaptive" | "strict" | "single_pass") => void;
}

export const defaultAgentMessages = (): Record<string, string> => ({
  nwp: "Standby — Ready for simulation",
  ensemble: "Standby — Ready for simulation",
  ai: "Standby — Ready for simulation",
  memory_analog: "Standby — 40yr archive indexed",
  radar_nowcast: "Standby — Radar optical flow ready",
  satellite_ir: "Standby — INSAT-3DR radiance locked",
  ecmwf_ifs: "Standby — IFS 9km boundary loaded",
  qc_filter: "Standby — Spatial gates armed",
  orographic_ds: "Standby — 1km SRTM elevation loaded",
  uncertainty_quant: "Standby — EVT bounds armed",
  blend: "Waiting for sources",
  output: "Waiting for consensus guidance",
});

const waiting = (blocks: GraphBlockConfig[]): Record<string, AgentStatus> => {
  const result: Record<string, AgentStatus> = {};
  for (const b of blocks) {
    result[b.id] = "waiting";
  }
  result.nwp = "waiting";
  result.ensemble = "waiting";
  result.ai = "waiting";
  result.blend = "waiting";
  result.output = "waiting";
  return result;
};

export const initialNodeTelemetry = (blocks: GraphBlockConfig[]): Record<string, NodeRuntimeTelemetry> => {
  const map: Record<string, NodeRuntimeTelemetry> = {};
  for (const b of blocks) {
    map[b.id] = {
      latencyMs: b.latencyMs,
      tokens: b.category === "model" ? 1800 : 920,
      confidence: 94,
      progressPct: 0,
      iterationText: "01/01",
      inputPayload: "0 KB",
      outputPayload: "0 KB",
    };
  }
  return map;
};

export function normalizePercentageWeights(weights: number[]): number[] {
  if (!weights.length) return [];
  const raw = weights.map((w) => Math.round(w * 100));
  const sum = raw.reduce((a, b) => a + b, 0);
  const diff = 100 - sum;
  if (diff !== 0 && raw.length > 0) {
    let maxIdx = 0;
    for (let i = 1; i < raw.length; i++) {
      if (raw[i] > raw[maxIdx]) maxIdx = i;
    }
    raw[maxIdx] += diff;
  }
  return raw;
}

let controller: AbortController | null = null;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));

async function playbackDelay(ms: number, signal: AbortSignal) {
  const store = useRunStore.getState();
  const speed = store.speed || 1;
  let remaining = (ms * 0.95) / speed;
  const step = 40;
  while (remaining > 0) {
    if (signal.aborted) throw new DOMException("Run cancelled", "AbortError");
    await sleep(Math.min(remaining, step));
    while (useRunStore.getState().status === "paused") {
      if (signal.aborted) throw new DOMException("Run cancelled", "AbortError");
      await sleep(step);
    }
    remaining -= step;
  }
  if (signal.aborted) throw new DOMException("Run cancelled", "AbortError");
}

export const useRunStore = create<RunStore>((set, get) => ({
  status: "idle",
  stage: 0,
  runNumber: 0,
  iteration: 0,
  speed: 1,
  blocks: DEFAULT_BLOCKS,
  reiteration: {
    active: false,
    pass: 1,
    maxPasses: 2,
    delta: 0,
    tolerance: 0.05,
    converged: false,
    reason: "",
    feedbackEdge: null,
  },
  reiterationPolicy: "adaptive",
  agents: waiting(DEFAULT_BLOCKS),
  agentMessages: defaultAgentMessages(),
  simulatedPredictions: { nwp: null, ensemble: null, ai: null },
  displayedWeights: null,
  transmission: null,
  dialogue: [],
  activeDialogueBubble: null,
  telemetry: {
    nwp: {},
    ensemble: {},
    ai: {},
    qc_filter: {},
    blend: {},
    output: {},
  },
  events: [],
  timelineEvents: [],
  globalStats: {
    totalAgents: DEFAULT_BLOCKS.length,
    activeAgents: 0,
    completedAgents: 0,
    failedAgents: 0,
    totalTokens: 0,
    avgLatencyMs: 0,
    memoryUsagePct: 15,
  },
  nodeTelemetry: initialNodeTelemetry(DEFAULT_BLOCKS),
  nodeMemory: {
    memory_analog: {
      shortTermCount: 12,
      retrievedDocs: [
        "ERA5 Monsoonal Synoptic Vector #2021-07",
        "Western Ghats Orographic Convection Pattern",
        "Arabian Sea Low-Level Jet Boundary",
      ],
      contextWindowPct: 78,
    },
    ai: {
      shortTermCount: 8,
      retrievedDocs: ["ERA5 40yr Fourier Kernel Matrix"],
      contextWindowPct: 82,
    },
  },
  nodeTools: {},
  nodeErrors: {},
  sources: [],
  result: null,
  error: "",
  inspected: "blend",
  isPresentationMode: false,
  showAddModal: false,
  layoutType: "dag",
  setSpeed: (speed) => set({ speed }),
  inspect: (inspected) => set({ inspected }),
  setShowAddModal: (showAddModal) => set({ showAddModal }),
  togglePresentationMode: () => set((s) => ({ isPresentationMode: !s.isPresentationMode })),
  setLayoutType: (layoutType) => set({ layoutType }),
  setReiterationPolicy: (reiterationPolicy) => set({ reiterationPolicy }),
  addBlock: (newBlock) => {
    set((state) => {
      if (state.blocks.some((b) => b.id === newBlock.id)) return state;
      const updated = [...state.blocks, { ...newBlock, userAdded: true }];
      return {
        blocks: updated,
        agents: { ...state.agents, [newBlock.id]: "waiting" },
        agentMessages: {
          ...state.agentMessages,
          [newBlock.id]: `Standby — ${newBlock.short} initialized`,
        },
        globalStats: { ...state.globalStats, totalAgents: updated.length },
      };
    });
  },
  removeBlock: (id) => {
    if (id === "nwp" || id === "ensemble" || id === "ai" || id === "blend" || id === "output") {
      return;
    }
    set((state) => {
      const filtered = state.blocks.filter((b) => b.id !== id);
      return {
        blocks: filtered,
        inspected: state.inspected === id ? "blend" : state.inspected,
        globalStats: { ...state.globalStats, totalAgents: filtered.length },
      };
    });
  },
  toggleBlock: (id) => {
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === id ? { ...b, enabled: !b.enabled } : b,
      ),
    }));
  },
  updateBlockConfig: (id, updates) => {
    set((state) => ({
      blocks: state.blocks.map((b) =>
        b.id === id ? { ...b, ...updates } : b,
      ),
    }));
  },
  setPresetTopology: (preset) => {
    let newBlocks: GraphBlockConfig[] = [];
    if (preset === "standard") {
      newBlocks = DEFAULT_BLOCKS;
    } else if (preset === "mesoscale") {
      newBlocks = [
        ...DEFAULT_BLOCKS,
        CATALOG_ADDITIONAL_BLOCKS.find((b) => b.id === "orographic_ds")!,
        CATALOG_ADDITIONAL_BLOCKS.find((b) => b.id === "satellite_ir")!,
        CATALOG_ADDITIONAL_BLOCKS.find((b) => b.id === "uncertainty_quant")!,
      ].filter(Boolean);
    } else if (preset === "nowcasting") {
      newBlocks = [
        ...DEFAULT_BLOCKS,
        CATALOG_ADDITIONAL_BLOCKS.find((b) => b.id === "radar_nowcast")!,
        CATALOG_ADDITIONAL_BLOCKS.find((b) => b.id === "satellite_ir")!,
      ].filter(Boolean);
    } else {
      newBlocks = [...DEFAULT_BLOCKS, ...CATALOG_ADDITIONAL_BLOCKS];
    }
    set({
      blocks: newBlocks,
      agents: waiting(newBlocks),
      nodeTelemetry: initialNodeTelemetry(newBlocks),
      globalStats: {
        totalAgents: newBlocks.length,
        activeAgents: 0,
        completedAgents: 0,
        failedAgents: 0,
        totalTokens: 0,
        avgLatencyMs: 0,
        memoryUsagePct: 15,
      },
      status: "stale",
    });
  },
  pause: () => {
    if (get().status === "running") set({ status: "paused" });
  },
  resume: () => {
    if (get().status === "paused") set({ status: "running" });
  },
  cancel: () => {
    controller?.abort();
    controller = null;
    set((s) => ({
      status: "stale",
      stage: 0,
      agents: waiting(s.blocks),
      agentMessages: defaultAgentMessages(),
      simulatedPredictions: { nwp: null, ensemble: null, ai: null },
      displayedWeights: null,
      transmission: null,
      reiteration: {
        active: false,
        pass: 1,
        maxPasses: 2,
        delta: 0,
        tolerance: 0.05,
        converged: false,
        reason: "",
        feedbackEdge: null,
      },
      globalStats: {
        ...s.globalStats,
        activeAgents: 0,
        completedAgents: 0,
        failedAgents: 0,
      },
      activeDialogueBubble: null,
      sources: [],
      result: null,
      error: "",
      events: [],
      timelineEvents: [],
    }));
  },
  replay: async () => {
    get().cancel();
    await sleep(80);
    await get().run();
  },
  run: async () => {
    controller?.abort();
    const owned = new AbortController();
    controller = owned;
    const signal = owned.signal;
    const { selection, records } = useForecastStore.getState();
    const snapshot = structuredClone(selection);
    const rows = structuredClone(records);
    const unit = VARIABLES[snapshot.variable].unit;

    let msgCounter = 0;
    const startTime = Date.now();
    const formatElapsed = () => {
      const ms = Date.now() - startTime;
      const secs = Math.floor(ms / 1000);
      const remMs = ms % 1000;
      return `00:${String(secs).padStart(2, "0")}.${String(remMs).padStart(3, "0")}`;
    };

    const appendDialogue = (
      sender: AgentId | "system",
      recipient: AgentId | undefined,
      text: string,
      payload?: string,
      kind: AgentDialogueMessage["kind"] = "data",
    ) => {
      if (signal.aborted) return;
      msgCounter += 1;
      const msg = createDialogueMessage(
        msgCounter,
        sender,
        recipient,
        text,
        payload,
        kind,
      );
      set((s) => ({
        dialogue: [...s.dialogue, msg],
        activeDialogueBubble:
          sender !== "system" ? { sender, recipient, text, payload } : null,
      }));
    };

    const emit = (agent: RunEvent["agent"], title: string, detail: string) => {
      if (signal.aborted) return;
      set((s) => ({
        events: [
          ...s.events,
          { id: s.events.length + 1, agent, title, detail },
        ],
      }));
    };

    const logTimeline = (
      agentId: string,
      agentName: string,
      st: TimelineEvent["status"],
      detail: string,
      durationMs?: number,
    ) => {
      if (signal.aborted) return;
      set((s) => ({
        timelineEvents: [
          ...s.timelineEvents,
          {
            id: s.timelineEvents.length + 1,
            timestamp: formatElapsed(),
            agentId,
            agentName,
            status: st,
            detail,
            durationMs,
          },
        ],
      }));
    };

    const agentState = (id: AgentId, st: AgentStatus) => {
      if (!signal.aborted)
        set((s) => {
          const updated = { ...s.agents, [id]: st };
          const active = Object.values(updated).filter(
            (v) =>
              v === "processing" ||
              v === "working" ||
              v === "sending" ||
              v === "receiving" ||
              v === "blending" ||
              v === "generating" ||
              v === "reiterating",
          ).length;
          const completed = Object.values(updated).filter(
            (v) => v === "complete" || v === "ready" || v === "completed",
          ).length;
          const failed = Object.values(updated).filter((v) => v === "error").length;

          return {
            agents: updated,
            globalStats: {
              ...s.globalStats,
              activeAgents: active,
              completedAgents: completed,
              failedAgents: failed,
            },
          };
        });
    };

    const updateNodeTelemetry = (
      id: string,
      updates: Partial<NodeRuntimeTelemetry>,
    ) => {
      if (signal.aborted) return;
      set((s) => ({
        nodeTelemetry: {
          ...s.nodeTelemetry,
          [id]: { ...(s.nodeTelemetry[id] || {}), ...updates },
        },
      }));
    };

    const setAgentMsg = (id: AgentId, msg: string) => {
      if (!signal.aborted)
        set((s) => ({
          agentMessages: { ...s.agentMessages, [id]: msg },
        }));
    };

    const nextIteration = get().iteration + 1;
    const currentBlocks = get().blocks;
    const activeModels = currentBlocks.filter((b) => b.category === "model" && b.enabled);

    // 1. RESET previous run & start clean simulation
    set((s) => ({
      status: "running",
      stage: 1,
      runNumber: s.runNumber + 1,
      iteration: nextIteration,
      agents: waiting(s.blocks),
      agentMessages: defaultAgentMessages(),
      simulatedPredictions: { nwp: null, ensemble: null, ai: null },
      displayedWeights: null,
      transmission: null,
      reiteration: {
        active: false,
        pass: 1,
        maxPasses: s.reiterationPolicy === "single_pass" ? 1 : 2,
        delta: 0,
        tolerance: 0.05,
        converged: false,
        reason: "",
        feedbackEdge: null,
      },
      dialogue: [],
      activeDialogueBubble: null,
      telemetry: {
        nwp: { status: "Initializing" },
        ensemble: { status: "Initializing" },
        ai: { status: "Initializing" },
        blend: { status: "Standby" },
        output: { status: "Standby" },
      },
      events: [],
      timelineEvents: [],
      globalStats: {
        totalAgents: currentBlocks.length,
        activeAgents: activeModels.length,
        completedAgents: 0,
        failedAgents: 0,
        totalTokens: 4200,
        avgLatencyMs: 140,
        memoryUsagePct: 24,
      },
      nodeTelemetry: initialNodeTelemetry(currentBlocks),
      nodeTools: {},
      nodeErrors: {},
      sources: [],
      result: null,
      error: "",
      inspected: "blend",
    }));

    appendDialogue(
      "system",
      undefined,
      `[Run #${nextIteration}] Orchestrating real-time collaborative forecasting for ${snapshot.location} (Variable: ${VARIABLES[snapshot.variable].label}, Lead: T+${snapshot.lead}h). ${activeModels.length} active models connected.`,
      `Context: ${snapshot.location} · +${snapshot.lead}h`,
      "system",
    );

    emit(
      "system",
      `Simulation Run #${nextIteration}`,
      `Target: ${snapshot.location} · Lead: +${snapshot.lead}h · Policy: ${get().reiterationPolicy.toUpperCase()}. Active blocks: ${currentBlocks.filter((b) => b.enabled).length}.`,
    );

    logTimeline("system", "Orchestrator", "processing", `Job initialization for ${snapshot.location}`);

    try {
      // 2. Start source models (test expects processing state at 1000ms)
      for (const model of activeModels) {
        agentState(model.id, "processing");
        updateNodeTelemetry(model.id, { progressPct: 15 });
      }

      setAgentMsg("nwp", "Solving Navier-Stokes atmospheric fluid dynamics...");
      setAgentMsg("ensemble", "Sampling 51 perturbed ensemble members...");
      setAgentMsg("ai", "Inverting Fourier neural operator across ERA5 analogs...");

      logTimeline("nwp", "Physics NWP", "processing", "Solving 4km non-hydrostatic dynamical equations");
      logTimeline("ensemble", "Ensemble Core", "processing", "Simulating 51 perturbed ensemble trajectories");
      logTimeline("ai", "AI Pattern Model", "processing", "Evaluating Fourier neural operator pattern");

      // Memory stream (synoptic analog bank)
      if (currentBlocks.some((b) => b.id === "memory_analog" && b.enabled)) {
        agentState("memory_analog", "processing");
        setAgentMsg("memory_analog", "Searching 40yr ERA5 analog archive...");
        set({
          transmission: {
            edgeId: "memory-ai",
            source: "memory_analog",
            target: "ai",
            message: "Context: 12 historical analogs",
            value: "12 Analogs",
            packetType: "memory",
          },
        });
        await playbackDelay(450, signal);
        agentState("memory_analog", "complete");
        setAgentMsg("memory_analog", "12 Synoptic analogs retrieved (Correlation 0.94)");
        logTimeline("memory_analog", "Synoptic Memory", "completed", "Loaded 12 analog cases from ERA5", 140);
        set({ transmission: null });
      } else {
        await playbackDelay(450, signal);
      }

      // Tool call: NCMRWF dynamical core calls DEM Orographic Downscaler
      set({
        nodeTools: {
          nwp: {
            toolName: "SRTM_DEM_Downscaler",
            query: "downscale_elevation(grid=4km, target=1km, lat=18.9, lon=72.8)",
            response: "elevation_gradient: +480m, lapse_rate: -6.5C/km",
            durationMs: 128,
            status: "invoking",
          },
        },
      });
      await playbackDelay(350, signal);
      set((s) => ({
        nodeTools: {
          ...s.nodeTools,
          nwp: { ...s.nodeTools.nwp, status: "completed" },
        },
      }));

      // Fetch actual worker computations for all sources in parallel
      const sourceReplies = await Promise.all(
        SOURCES.map((source) =>
          evaluateJob(
            {
              kind: "source",
              source: source.id,
              selection: snapshot,
              records: rows,
            },
            signal,
          ),
        ),
      );

      const nwpResult = sourceReplies[0]?.source;
      const ensResult = sourceReplies[1]?.source;
      const aiResult = sourceReplies[2]?.source;

      if (!nwpResult || !ensResult || !aiResult) {
        throw new Error("One or more source evaluators failed to return data.");
      }

      // Compute blend forecast from worker ahead of time
      const blendReply = await evaluateJob(
        { kind: "blend", selection: snapshot, records: rows },
        signal,
      );
      if (!blendReply.forecast) {
        throw new Error("Blending agent returned no forecast.");
      }
      const forecast = blendReply.forecast;

      // Dynamic weights normalization guaranteeing exact 100% sum
      const rawWeights = forecast.sources.map((s) => s.weight);
      const exactPercents = normalizePercentageWeights(rawWeights);
      const finalWeightsRecord: Record<SourceId, number> = {
        nwp: exactPercents[0] / 100,
        ensemble: exactPercents[1] / 100,
        ai: exactPercents[2] / 100,
      };

      const narrative = getSimulatedAgentDialogue(
        snapshot,
        nwpResult,
        ensResult,
        aiResult,
        forecast,
        finalWeightsRecord,
      );

      // --- SEQUENCE 3A: PHYSICS AGENT COMPLETES ---
      await playbackDelay(500, signal);

      set((s) => ({
        simulatedPredictions: {
          ...s.simulatedPredictions,
          nwp: nwpResult.corrected,
        },
        sources: [...s.sources, nwpResult],
        telemetry: {
          ...s.telemetry,
          nwp: narrative.physicsDispatch.telemetry,
        },
      }));
      updateNodeTelemetry("nwp", {
        progressPct: 100,
        outputPayload: `${nwpResult.corrected.toFixed(1)} ${unit}`,
      });
      agentState("nwp", "sending");
      setAgentMsg(
        "nwp",
        `Prediction: ${nwpResult.corrected.toFixed(1)} ${unit} → Dispatching`,
      );

      appendDialogue(
        "nwp",
        "blend",
        narrative.physicsDispatch.text,
        narrative.physicsDispatch.payload,
        "data",
      );

      set({
        transmission: {
          edgeId: "nwp-blend",
          source: "nwp",
          target: "blend",
          message: `NWP: ${nwpResult.corrected.toFixed(1)} ${unit}`,
          value: `${nwpResult.corrected.toFixed(1)} ${unit}`,
          packetType: "data",
        },
      });

      emit(
        "nwp",
        "Physics prediction dispatched",
        narrative.physicsDispatch.text,
      );
      logTimeline("nwp", "Physics NWP", "completed", `Calibrated prediction ${nwpResult.corrected.toFixed(1)} ${unit}`, 540);

      await playbackDelay(400, signal);

      appendDialogue(
        "blend",
        "nwp",
        narrative.blendAckPhysics.text,
        narrative.blendAckPhysics.payload,
        "ack",
      );

      set({ transmission: null });
      agentState("nwp", nwpResult.available ? "complete" : "unavailable");
      setAgentMsg(
        "nwp",
        nwpResult.available
          ? `${nwpResult.corrected.toFixed(1)} ${unit} · Calibrated`
          : "Excluded (No input)",
      );
      setAgentMsg("blend", "Physics prediction received (1/3)");

      await playbackDelay(250, signal);

      // --- SEQUENCE 3B: ENSEMBLE AGENT COMPLETES ---
      await playbackDelay(400, signal);

      set((s) => ({
        simulatedPredictions: {
          ...s.simulatedPredictions,
          ensemble: ensResult.corrected,
        },
        sources: [...s.sources, ensResult],
        telemetry: {
          ...s.telemetry,
          ensemble: narrative.ensembleDispatch.telemetry,
        },
      }));
      updateNodeTelemetry("ensemble", {
        progressPct: 100,
        outputPayload: `${ensResult.corrected.toFixed(1)} ${unit}`,
      });
      agentState("ensemble", "sending");
      setAgentMsg(
        "ensemble",
        `Prediction: ${ensResult.corrected.toFixed(1)} ${unit} → Dispatching`,
      );

      appendDialogue(
        "ensemble",
        "blend",
        narrative.ensembleDispatch.text,
        narrative.ensembleDispatch.payload,
        "data",
      );

      set({
        transmission: {
          edgeId: "ensemble-blend",
          source: "ensemble",
          target: "blend",
          message: `Ensemble: ${ensResult.corrected.toFixed(1)} ${unit}`,
          value: `${ensResult.corrected.toFixed(1)} ${unit}`,
          packetType: "data",
        },
      });

      emit(
        "ensemble",
        "Ensemble spread transmitted",
        narrative.ensembleDispatch.text,
      );
      logTimeline("ensemble", "Ensemble Core", "completed", `Spread distribution ${ensResult.corrected.toFixed(1)} ${unit}`, 780);

      await playbackDelay(400, signal);

      appendDialogue(
        "blend",
        "ensemble",
        narrative.blendAckEnsemble.text,
        narrative.blendAckEnsemble.payload,
        "ack",
      );

      set({ transmission: null });
      agentState("ensemble", ensResult.available ? "complete" : "unavailable");
      setAgentMsg(
        "ensemble",
        ensResult.available
          ? `${ensResult.corrected.toFixed(1)} ${unit} · Calibrated`
          : "Excluded (No input)",
      );
      setAgentMsg("blend", "Ensemble prediction received (2/3)");

      await playbackDelay(250, signal);

      // --- SEQUENCE 3C: AI PATTERN AGENT COMPLETES ---
      await playbackDelay(400, signal);

      set((s) => ({
        simulatedPredictions: {
          ...s.simulatedPredictions,
          ai: aiResult.corrected,
        },
        sources: [...s.sources, aiResult],
        telemetry: {
          ...s.telemetry,
          ai: narrative.aiDispatch.telemetry,
        },
      }));
      updateNodeTelemetry("ai", {
        progressPct: 100,
        outputPayload: `${aiResult.corrected.toFixed(1)} ${unit}`,
      });
      agentState("ai", "sending");
      setAgentMsg(
        "ai",
        `Prediction: ${aiResult.corrected.toFixed(1)} ${unit} → Dispatching`,
      );

      appendDialogue(
        "ai",
        "blend",
        narrative.aiDispatch.text,
        narrative.aiDispatch.payload,
        "data",
      );

      set({
        transmission: {
          edgeId: "ai-blend",
          source: "ai",
          target: "blend",
          message: `AI: ${aiResult.corrected.toFixed(1)} ${unit}`,
          value: `${aiResult.corrected.toFixed(1)} ${unit}`,
          packetType: "data",
        },
      });

      emit(
        "ai",
        "Deep pattern analog delivered",
        narrative.aiDispatch.text,
      );
      logTimeline("ai", "AI Pattern Model", "completed", `Neural projection ${aiResult.corrected.toFixed(1)} ${unit}`, 280);

      await playbackDelay(400, signal);

      appendDialogue(
        "blend",
        "ai",
        narrative.blendAckAi.text,
        narrative.blendAckAi.payload,
        "ack",
      );

      set({ transmission: null });
      agentState("ai", aiResult.available ? "complete" : "unavailable");
      setAgentMsg(
        "ai",
        aiResult.available
          ? `${aiResult.corrected.toFixed(1)} ${unit} · Calibrated`
          : "Excluded (No input)",
      );
      setAgentMsg("blend", "All 3 predictions received (3/3)");

      // --- INTERMEDIATE BLOCKS: QC FILTER & FAILURE RECOVERY ---
      const hasQc = currentBlocks.some((b) => b.id === "qc_filter" && b.enabled);
      if (hasQc) {
        agentState("qc_filter", "processing");
        setAgentMsg("qc_filter", "Validating spatial gradient & boundary gates...");
        updateNodeTelemetry("qc_filter", { progressPct: 40 });
        await playbackDelay(300, signal);

        // Failure demonstration: If high extreme threshold detected, trigger transient error & self-recovery
        if (forecast.tailStrength > 0.4) {
          agentState("qc_filter", "error");
          setAgentMsg("qc_filter", "Anomaly: Local gradient spike 3.4σ > 3.0σ limit");
          set((s) => ({
            nodeErrors: {
              ...s.nodeErrors,
              qc_filter: {
                errorMsg: "Spatial continuity threshold exceeded (3.4σ > 3.0σ)",
                retryCount: 1,
                maxRetries: 2,
                recovering: true,
              },
            },
          }));
          logTimeline("qc_filter", "QC Filter", "failed", "Spatial gradient outlier detected (3.4σ > 3.0σ)");
          appendDialogue(
            "qc_filter",
            "blend",
            "Local gradient outlier detected across Western Ghats boundary. Initiating Kalman smoothing retry.",
            "Retry #1",
            "alert",
          );

          await playbackDelay(400, signal);
          agentState("qc_filter", "retrying");
          setAgentMsg("qc_filter", "Retrying with Gaussian spatial kernel smoothing...");
          logTimeline("qc_filter", "QC Filter", "retrying", "Retrying with Gaussian smoothing filter");
          await playbackDelay(350, signal);
        }

        agentState("qc_filter", "complete");
        updateNodeTelemetry("qc_filter", { progressPct: 100 });
        setAgentMsg("qc_filter", "Passed WMO gross-error filter (Recovered · 0 anomalies)");
        logTimeline("qc_filter", "QC Filter", "completed", "Passed gross error & boundary check", 120);
        emit("system", "QC Gate Passed", "Spatial gradient within 3-sigma tolerance. No gross outliers.");
      }

      // --- REITERATION CHECK & LOOP ---
      const policy = get().reiterationPolicy;
      const modelSpread = Math.abs(nwpResult.corrected - aiResult.corrected);
      const relativeDispersion = modelSpread / Math.max(forecast.value, 1);
      const shouldReiterate =
        policy !== "single_pass" &&
        (relativeDispersion > 0.04 || forecast.tailStrength > 0 || policy === "strict");

      if (shouldReiterate) {
        const initialDelta = Math.min(0.095, +(relativeDispersion * 0.45).toFixed(3));
        set({
          reiteration: {
            active: true,
            pass: 2,
            maxPasses: 2,
            delta: initialDelta,
            tolerance: 0.05,
            converged: false,
            reason: `Inter-model spread (Δ = ${initialDelta}) exceeds tolerance. Initiating covariance re-weighting pass.`,
            feedbackEdge: {
              source: "blend",
              target: "nwp",
              message: "REITERATION LOOP: Re-evaluating local orographic covariance",
            },
          },
        });

        agentState("blend", "reiterating");
        agentState("nwp", "reiterating");
        agentState("ensemble", "reiterating");
        agentState("ai", "reiterating");

        setAgentMsg("blend", `Reiteration Pass 2/2 · Dispersion Δ = ${initialDelta} > 0.050`);
        appendDialogue(
          "blend",
          undefined,
          `[Reiteration Pass 2/2] Inter-model spread Δ = ${initialDelta} exceeds convergence tolerance. Re-evaluating localized orographic priors & covariance matrices.`,
          `Reiteration Δ = ${initialDelta}`,
          "reiteration",
        );

        emit(
          "blend",
          "Reiteration Pass 2 Triggered",
          `Model divergence Δ = ${initialDelta}. Re-evaluating with elevation constraints.`,
        );
        logTimeline("blend", "Consensus Engine", "processing", `Reiteration Pass 2: Covariance minimization (Δ = ${initialDelta})`);

        // Reverse feedback transmission back to solvers
        set({
          transmission: {
            edgeId: "blend-nwp-feedback",
            source: "blend",
            target: "nwp",
            message: "Refining covariance matrix",
            value: `Δ ${initialDelta}`,
            packetType: "feedback",
            isFeedback: true,
          },
        });

        await playbackDelay(500, signal);
        set({ transmission: null });

        // Convergence achieved
        const convergedDelta = +(initialDelta * 0.38).toFixed(3);
        set({
          reiteration: {
            active: true,
            pass: 2,
            maxPasses: 2,
            delta: convergedDelta,
            tolerance: 0.05,
            converged: true,
            reason: `Reiteration Pass 2 converged: residual error Δ = ${convergedDelta} < 0.050. Covariance matrix stabilized.`,
            feedbackEdge: null,
          },
        });

        agentState("nwp", "complete");
        agentState("ensemble", "complete");
        agentState("ai", "complete");
        agentState("blend", "converging");

        appendDialogue(
          "blend",
          undefined,
          `Reiteration converged: Residual spread reduced to Δ = ${convergedDelta} (Tolerance: 0.050). Statistical agreement achieved.`,
          `Converged Δ = ${convergedDelta}`,
          "ack",
        );
        emit(
          "blend",
          "Reiteration Converged",
          `Residual error Δ = ${convergedDelta} is within tolerance threshold (0.050). Proceeding to consensus.`,
        );
        logTimeline("blend", "Consensus Engine", "completed", `Reiteration converged (Δ = ${convergedDelta} < 0.050)`);
        await playbackDelay(300, signal);
      }

      // --- 4. BLENDING AGENT SYNTHESIS & WEIGHT SETTLING ---
      set({ stage: 2 });
      agentState("blend", "receiving");
      setAgentMsg("blend", "Active models synchronized · Evaluating reliability matrix");
      emit(
        "blend",
        "Evaluating model reliability",
        "Assessing recent RMSE error scale, member spread dispersion, and local regime compatibility.",
      );

      await playbackDelay(350, signal);

      agentState("blend", "blending");
      setAgentMsg("blend", "Synthesizing dynamic Kalman weights...");
      updateNodeTelemetry("blend", { progressPct: 60 });

      appendDialogue(
        "blend",
        undefined,
        narrative.blendSynthesis.text,
        narrative.blendSynthesis.payload,
        "synthesis",
      );

      // Animate weights settling smoothly across steps
      set({
        displayedWeights: {
          nwp: 0.33,
          ensemble: 0.33,
          ai: 0.34,
        },
      });
      await playbackDelay(150, signal);

      set({
        displayedWeights: {
          nwp: +(0.33 + (finalWeightsRecord.nwp - 0.33) * 0.55).toFixed(2),
          ensemble: +(
            0.33 +
            (finalWeightsRecord.ensemble - 0.33) * 0.55
          ).toFixed(2),
          ai: +(0.34 + (finalWeightsRecord.ai - 0.34) * 0.55).toFixed(2),
        },
      });
      await playbackDelay(150, signal);

      set({
        displayedWeights: finalWeightsRecord,
        sources: forecast.sources.map((s, i) => ({
          ...s,
          weight: exactPercents[i] / 100,
        })),
        telemetry: {
          ...get().telemetry,
          blend: narrative.blendSynthesis.telemetry,
        },
      });

      updateNodeTelemetry("blend", {
        progressPct: 100,
        outputPayload: `${forecast.value.toFixed(1)} ${unit}`,
      });
      setAgentMsg("blend", "Consensus blend synthesized with adaptive policy");
      emit(
        "blend",
        "Dynamic weights resolved",
        `NWP: ${exactPercents[0]}% · Ensemble: ${exactPercents[1]}% · AI: ${exactPercents[2]}% (Sum: 100%)`,
      );
      logTimeline("blend", "Consensus Engine", "completed", `Dynamic Kalman weights resolved (NWP ${exactPercents[0]}%, ENS ${exactPercents[1]}%, AI ${exactPercents[2]}%)`, 410);

      await playbackDelay(350, signal);

      set({ stage: 3 });
      agentState("blend", "complete");
      setAgentMsg("blend", "Consensus resolved · Dispatching to output");

      // --- 5. FINAL FORECAST RESULT ---
      agentState("blend", "sending");
      appendDialogue(
        "blend",
        "output",
        narrative.blendDispatch.text,
        narrative.blendDispatch.payload,
        "data",
      );

      set({
        transmission: {
          edgeId: "blend-output",
          source: "blend",
          target: "output",
          message: `Consensus: ${forecast.value.toFixed(1)} ${unit}`,
          value: `${forecast.value.toFixed(1)} ${unit}`,
          packetType: "result",
        },
      });

      await playbackDelay(400, signal);

      set({ transmission: null });
      agentState("blend", "complete");
      agentState("output", "generating");
      updateNodeTelemetry("output", { progressPct: 50 });
      setAgentMsg("output", "Assembling official consensus guidance...");

      emit(
        "output",
        "Validating extreme hazard thresholds",
        forecast.tailStrength > 0
          ? `${forecast.agreement} sources exceed hazard threshold (${forecast.threshold} ${unit}). Tail adjustment active.`
          : "Threshold evidence checked. Standard adaptive blend retained.",
      );

      await playbackDelay(400, signal);

      // Cross-checking QC pass
      agentState("output", "processing");
      setAgentMsg("output", "Cross-checking spread, threshold risk, and source agreement...");
      emit(
        "output",
        "Quality Control Verification",
        "Comparing blended guidance against calibrated source spread and recent local skill.",
      );
      await playbackDelay(350, signal);

      agentState("output", "complete");
      updateNodeTelemetry("output", {
        progressPct: 100,
        outputPayload: `${forecast.value.toFixed(1)} ${unit}`,
      });
      setAgentMsg("output", `Official: ${forecast.value.toFixed(1)} ${unit}`);
      set({
        result: forecast,
        status: "complete",
        stage: 4,
        inspected: "output",
        telemetry: {
          ...get().telemetry,
          output: narrative.outputPublish.telemetry,
        },
        globalStats: {
          totalAgents: currentBlocks.length,
          activeAgents: 0,
          completedAgents: currentBlocks.filter((b) => b.enabled).length,
          failedAgents: 0,
          totalTokens: 42800,
          avgLatencyMs: 182,
          memoryUsagePct: 78,
        },
      });

      appendDialogue(
        "output",
        undefined,
        narrative.outputPublish.text,
        narrative.outputPublish.payload,
        "output",
      );

      emit(
        "output",
        "Forecast ready",
        `Final: ${forecast.value.toFixed(1)} ${unit} · Range: ${forecast.lower.toFixed(0)}–${forecast.upper.toFixed(0)} ${unit} · ${forecast.confidence} confidence.`,
      );
      logTimeline("output", "Guidance Desk", "completed", `Official guidance released: ${forecast.value.toFixed(1)} ${unit} (${forecast.confidence} confidence)`, 190);
    } catch (error) {
      if (!signal.aborted) {
        set({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "This simulation run failed. Please retry.",
        });
        emit(
          "system",
          "Run interrupted",
          "No completed result was published. Replay to try again.",
        );
        logTimeline("system", "Orchestrator", "failed", "Run interrupted: pipeline execution aborted");
        owned.abort();
      }
    } finally {
      if (controller === owned) controller = null;
    }
  },
}));

// A new input invalidates the previous run immediately
useForecastStore.subscribe((state, previous) => {
  if (
    state.selection !== previous.selection ||
    state.records !== previous.records
  ) {
    useRunStore.getState().cancel();
  }
});
