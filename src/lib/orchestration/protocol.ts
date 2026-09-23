import type {
  Forecast,
  ForecastRecord,
  Selection,
  SourceId,
  SourceResult,
} from "../../types/forecast";
export type AgentId = SourceId | "blend" | "output";
export type AgentStatus = "waiting" | "working" | "ready" | "unavailable";
export interface WorkerJob {
  kind: "source" | "blend";
  source?: SourceId;
  selection: Selection;
  records: ForecastRecord[];
}
export type WorkerReply =
  | { ok: true; source?: SourceResult; forecast?: Forecast }
  | { ok: false; error: string };
export interface RunEvent {
  id: number;
  agent: AgentId | "system";
  title: string;
  detail: string;
}
