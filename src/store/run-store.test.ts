import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { INITIAL } from "../data/presets";
import { deriveForecast, prepareForecast } from "../lib/blending/engine";
import { evaluateJob } from "../lib/orchestration/worker-client";
import { useForecastStore } from "./forecast-store";
import { useRunStore } from "./run-store";

vi.mock("../lib/orchestration/worker-client", () => ({ evaluateJob: vi.fn() }));

beforeEach(() => {
  vi.useFakeTimers();
  useForecastStore.getState().reset();
  useRunStore.getState().cancel();
  useRunStore.setState({ status: "idle", speed: 1 });
  vi.mocked(evaluateJob).mockImplementation(async (job) =>
    job.kind === "source"
      ? {
          ok: true,
          source: prepareForecast(job.selection, job.records).sources.find(
            (s) => s.id === job.source,
          ),
        }
      : { ok: true, forecast: deriveForecast(job.selection, job.records) },
  );
});

afterEach(() => {
  useRunStore.getState().cancel();
  vi.useRealTimers();
  vi.clearAllMocks();
});

describe("forecast run lifecycle & simulation", () => {
  it("starts in idle state with waiting agents on initial load", () => {
    const run = useRunStore.getState();
    expect(run.status).toBe("idle");
    expect(run.agents.nwp).toBe("waiting");
    expect(run.agents.ensemble).toBe("waiting");
    expect(run.agents.ai).toBe("waiting");
    expect(run.agents.blend).toBe("waiting");
    expect(run.agents.output).toBe("waiting");
    expect(run.result).toBeNull();
  });

  it("publishes one complete result only after every stage and verifies dynamic weights sum to 100%", async () => {
    const pending = useRunStore.getState().run();
    expect(useRunStore.getState().result).toBeNull();
    // After 1000ms, source agents are processing
    await vi.advanceTimersByTimeAsync(1000);
    expect(useRunStore.getState().agents.nwp).toBe("processing");
    expect(useRunStore.getState().agents.ensemble).toBe("processing");
    expect(useRunStore.getState().agents.ai).toBe("processing");

    // Advance to end of simulation
    await vi.advanceTimersByTimeAsync(15000);
    await pending;

    const run = useRunStore.getState();
    expect(run.status).toBe("complete");
    expect(run.stage).toBe(4);
    expect(run.result).toEqual(deriveForecast(INITIAL));
    expect(evaluateJob).toHaveBeenCalledTimes(4);
    expect(run.events.at(-1)?.title).toBe("Forecast ready");

    // Verify dynamic weights sum to exactly 100%
    if (run.displayedWeights) {
      const sum =
        Math.round(run.displayedWeights.nwp * 100) +
        Math.round(run.displayedWeights.ensemble * 100) +
        Math.round(run.displayedWeights.ai * 100);
      expect(sum).toBe(100);
    }
  });

  it("pauses presentation, then resumes without skipping evaluations", async () => {
    const pending = useRunStore.getState().run();
    useRunStore.getState().pause();
    await vi.advanceTimersByTimeAsync(10000);
    expect(useRunStore.getState().status).toBe("paused");
    expect(useRunStore.getState().result).toBeNull();
    useRunStore.getState().resume();
    await vi.advanceTimersByTimeAsync(15000);
    await pending;
    expect(useRunStore.getState().status).toBe("complete");
  });

  it("invalidates in-flight results when inputs change", async () => {
    const pending = useRunStore.getState().run();
    await vi.advanceTimersByTimeAsync(500);
    useForecastStore.getState().setSelection({ lead: 144 });
    await vi.advanceTimersByTimeAsync(15000);
    await pending;
    expect(useRunStore.getState().status).toBe("stale");
    expect(useRunStore.getState().result).toBeNull();
    expect(useRunStore.getState().events).toEqual([]);
    expect(useRunStore.getState().agents.nwp).toBe("waiting");
  });

  it("a replacement run cannot be overwritten by a cancelled run and produces new forecast", async () => {
    const first = useRunStore.getState().run();
    await vi.advanceTimersByTimeAsync(100);
    useForecastStore.getState().setSelection({ lead: 144 });
    const second = useRunStore.getState().run();
    await vi.advanceTimersByTimeAsync(15000);
    await Promise.all([first, second]);
    expect(useRunStore.getState().result).toEqual(
      deriveForecast({ ...INITIAL, lead: 144 }),
    );
  });

  it("reports worker errors and stops sibling evaluations", async () => {
    vi.mocked(evaluateJob).mockRejectedValueOnce(new Error("Worker failed"));
    const pending = useRunStore.getState().run();
    await vi.advanceTimersByTimeAsync(15000);
    await pending;
    expect(useRunStore.getState().status).toBe("error");
    expect(useRunStore.getState().error).toBe("Worker failed");
    expect(useRunStore.getState().result).toBeNull();
    expect(useRunStore.getState().sources).toEqual([]);
  });
});
