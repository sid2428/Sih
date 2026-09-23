import { create } from "zustand";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { useForecastStore } from "./forecast-store";
import { evaluateJob } from "../lib/orchestration/worker-client";
import type {
  AgentId,
  AgentStatus,
  RunEvent,
} from "../lib/orchestration/protocol";
import type { Forecast, SourceResult } from "../types/forecast";
type RunStatus = "idle" | "running" | "paused" | "complete" | "stale" | "error";
interface RunStore {
  status: RunStatus;
  stage: number;
  runNumber: number;
  speed: number;
  agents: Record<AgentId, AgentStatus>;
  events: RunEvent[];
  sources: SourceResult[];
  result: Forecast | null;
  error: string;
  inspected: AgentId;
  run: () => Promise<void>;
  pause: () => void;
  resume: () => void;
  cancel: () => void;
  setSpeed: (speed: number) => void;
  inspect: (id: AgentId) => void;
}
const waiting = (): Record<AgentId, AgentStatus> => ({
  nwp: "waiting",
  ensemble: "waiting",
  ai: "waiting",
  blend: "waiting",
  output: "waiting",
});
let controller: AbortController | null = null;
const sleep = (ms: number) =>
  new Promise<void>((resolve) => setTimeout(resolve, ms));
async function playbackDelay(ms: number, signal: AbortSignal) {
  let left = ms;
  while (left > 0) {
    if (signal.aborted) throw new DOMException("Run cancelled", "AbortError");
    await sleep(40);
    if (useRunStore.getState().status !== "paused")
      left -= 40 * useRunStore.getState().speed;
  }
  if (signal.aborted) throw new DOMException("Run cancelled", "AbortError");
}
export const useRunStore = create<RunStore>((set, get) => ({
  status: "idle",
  stage: 0,
  runNumber: 0,
  speed: 1,
  agents: waiting(),
  events: [],
  sources: [],
  result: null,
  error: "",
  inspected: "blend",
  setSpeed: (speed) => set({ speed }),
  inspect: (inspected) => set({ inspected }),
  pause: () => {
    if (get().status === "running") set({ status: "paused" });
  },
  resume: () => {
    if (get().status === "paused") set({ status: "running" });
  },
  cancel: () => {
    controller?.abort();
    controller = null;
    set({
      status: "stale",
      stage: 0,
      agents: waiting(),
      sources: [],
      result: null,
      error: "",
      events: [],
    });
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
    const emit = (agent: RunEvent["agent"], title: string, detail: string) => {
      if (signal.aborted) return;
      set((s) => ({
        events: [
          ...s.events,
          { id: s.events.length + 1, agent, title, detail },
        ],
      }));
    };
    const agentState = (id: AgentId, status: AgentStatus) => {
      if (!signal.aborted)
        set((s) => ({ agents: { ...s.agents, [id]: status } }));
    };
    set((s) => ({
      status: "running",
      stage: 1,
      runNumber: s.runNumber + 1,
      agents: waiting(),
      events: [],
      sources: [],
      result: null,
      error: "",
      inspected: "blend",
    }));
    emit(
      "system",
      "Forecast context locked",
      `${snapshot.location} / ${snapshot.lead} h / ${VARIABLES[snapshot.variable].label}. Three local source evaluators dispatched.`,
    );
    try {
      SOURCES.forEach((source) => agentState(source.id, "working"));
      await Promise.all(
        SOURCES.map(async (source, index) => {
          const reply = await evaluateJob(
            {
              kind: "source",
              source: source.id,
              selection: snapshot,
              records: rows,
            },
            signal,
          );
          await playbackDelay(850 + index * 650, signal);
          if (!reply.source)
            throw new Error(`${source.name} returned no evaluation.`);
          const result = reply.source;
          set((s) => ({ sources: [...s.sources, result] }));
          agentState(source.id, result.available ? "ready" : "unavailable");
          emit(
            source.id,
            result.available ? "Source evaluation complete" : "Source excluded",
            result.available
              ? `${result.corrected.toFixed(1)} ${unit} after bias correction; ${result.samples} historical cases assessed.`
              : "This source is unavailable for the selected forecast. It receives zero influence.",
          );
        }),
      );
      set({ stage: 2 });
      agentState("blend", "working");
      emit(
        "blend",
        "Comparing recent skill",
        "Normalize error costs, apply source availability, and assign adaptive weights.",
      );
      const reply = await evaluateJob(
        { kind: "blend", selection: snapshot, records: rows },
        signal,
      );
      await playbackDelay(1100, signal);
      if (!reply.forecast)
        throw new Error("The blending evaluator returned no forecast.");
      const result = reply.forecast;
      agentState("blend", "ready");
      set({ sources: result.sources, stage: 3 });
      emit(
        "blend",
        "Weights resolved",
        result.sources
          .map((s, i) => `${SOURCES[i].short} ${(s.weight * 100).toFixed(1)}%`)
          .join(" / "),
      );
      agentState("output", "working");
      emit(
        "output",
        "Checking extreme evidence",
        result.tailStrength > 0
          ? `${result.agreement} sources cross the threshold. Bounded tail adjustment applied.`
          : "Threshold evidence checked. Ordinary adaptive guidance retained.",
      );
      await playbackDelay(850, signal);
      agentState("output", "ready");
      set({ result, status: "complete", stage: 4, inspected: "output" });
      emit(
        "output",
        "Forecast ready",
        `${result.value.toFixed(1)} ${unit}; ${result.confidence.toLowerCase()} confidence. Open the comparison to inspect every model.`,
      );
    } catch (error) {
      if (!signal.aborted) {
        set({
          status: "error",
          error:
            error instanceof Error
              ? error.message
              : "This run failed. Please retry.",
        });
        emit(
          "system",
          "Run interrupted",
          "No completed result was published. Replay to try again.",
        );
        owned.abort();
      }
    } finally {
      if (controller === owned) controller = null;
    }
  },
}));
// A new input invalidates the previous run, including in-flight worker replies.
useForecastStore.subscribe((state, previous) => {
  if (
    state.selection !== previous.selection ||
    state.records !== previous.records
  )
    useRunStore.getState().cancel();
});
