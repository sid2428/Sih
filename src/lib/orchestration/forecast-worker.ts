import { deriveForecast, prepareForecast } from "../blending/engine";
import type { WorkerJob, WorkerReply } from "./protocol";
self.onmessage = (event: MessageEvent<WorkerJob>) => {
  try {
    const job = event.data;
    const reply: WorkerReply =
      job.kind === "source"
        ? {
            ok: true,
            source: prepareForecast(job.selection, job.records).sources.find(
              (s) => s.id === job.source,
            ),
          }
        : { ok: true, forecast: deriveForecast(job.selection, job.records) };
    self.postMessage(reply);
  } catch (error) {
    self.postMessage({
      ok: false,
      error:
        error instanceof Error ? error.message : "Forecast evaluation failed",
    } satisfies WorkerReply);
  }
};
