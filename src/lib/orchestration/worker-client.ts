import { deriveForecast, prepareForecast } from "../blending/engine";
import type { WorkerJob, WorkerReply } from "./protocol";
/** Workers are real local computation. Playback pacing is managed independently by the UI. */
export async function evaluateJob(
  job: WorkerJob,
  signal: AbortSignal,
): Promise<Extract<WorkerReply, { ok: true }>> {
  if (signal.aborted) throw new DOMException("Run cancelled", "AbortError");
  try {
    if (typeof Worker === "undefined") return evaluateLocally(job);
    return await new Promise((resolve, reject) => {
      let worker: Worker;
      try {
        worker = new Worker(new URL("./forecast-worker.ts", import.meta.url), {
          type: "module",
        });
      } catch {
        resolve(evaluateLocally(job));
        return;
      }
      const timeout = setTimeout(
        () => finish(new Error("Source evaluation timed out. Replay the run.")),
        15000,
      );
      const abort = () =>
        finish(new DOMException("Run cancelled", "AbortError"));
      const finish = (
        error?: Error,
        reply?: Extract<WorkerReply, { ok: true }>,
      ) => {
        clearTimeout(timeout);
        signal.removeEventListener("abort", abort);
        worker.terminate();
        if (error) reject(error);
        else if (reply) resolve(reply);
      };
      signal.addEventListener("abort", abort, { once: true });
      worker.onmessage = (event: MessageEvent<WorkerReply>) => {
        const reply = event.data;
        if (reply.ok) finish(undefined, reply);
        else finish(new Error(reply.error));
      };
      worker.onerror = (event) => {
        event.preventDefault();
        if (signal.aborted) {
          abort();
          return;
        }
        // Asset loading or browser policy can block workers. The same pure
        // evaluator is already bundled on the main thread, so remain usable.
        try {
          finish(undefined, evaluateLocally(job));
        } catch (error) {
          finish(
            error instanceof Error
              ? error
              : new Error("Local evaluation failed"),
          );
        }
      };
      worker.postMessage(job);
    });
  } catch (error) {
    throw error instanceof Error
      ? error
      : new Error("Could not evaluate this forecast");
  }
}
function evaluateLocally(job: WorkerJob): Extract<WorkerReply, { ok: true }> {
  return job.kind === "source"
    ? {
        ok: true,
        source: prepareForecast(job.selection, job.records).sources.find(
          (s) => s.id === job.source,
        ),
      }
    : { ok: true, forecast: deriveForecast(job.selection, job.records) };
}
