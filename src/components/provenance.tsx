import { useRef, useState } from "react";
import { Download, FileCheck2, UploadCloud } from "lucide-react";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { downloadFile } from "../lib/csv/parse";
import { useForecastStore } from "../store/forecast-store";
import type { Forecast } from "../types/forecast";

const template =
  "timestamp,lat,lon,lead_time,source,variable,forecast_value,observed_value\n2026-07-18T06:00:00Z,19.5,73.5,48,nwp,rainfall,108,\n2026-07-18T06:00:00Z,19.5,73.5,48,ensemble,rainfall,62,\n2026-07-18T06:00:00Z,19.5,73.5,48,ai,rainfall,96,\n";

const processingStages = [
  "CSV file selected",
  "Scenario context applied",
  "Forecast blend recalculated",
  "Workspace results synchronized",
];

export default function Provenance({ forecast: f }: { forecast: Forecast }) {
  const {
    selection: s,
    demoUploadName,
    setDemoUpload,
    reset,
  } = useForecastStore();
  const ref = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);
  const [processingStep, setProcessingStep] = useState(-1);
  const [uploadName, setUploadName] = useState("");
  const [drag, setDrag] = useState(false);
  const meta = VARIABLES[s.variable];
  const hasUploadedCsv = !!demoUploadName && !busy;

  async function read(file: File) {
    if (busy) return;
    setBusy(true);
    setErrors([]);
    setUploadName(file.name);
    setProcessingStep(0);
    try {
      if (!file.name.toLowerCase().endsWith(".csv"))
        throw new Error("Choose a .csv file.");
      await new Promise((resolve) => setTimeout(resolve, 380));
      setProcessingStep(1);
      await new Promise((resolve) => setTimeout(resolve, 420));
      setProcessingStep(2);
      await new Promise((resolve) => setTimeout(resolve, 460));
      setDemoUpload(file.name);
      setProcessingStep(3);
      await new Promise((resolve) => setTimeout(resolve, 260));
    } catch (error) {
      setUploadName("");
      setProcessingStep(-1);
      setErrors([
        error instanceof Error
          ? error.message
          : "Could not read this file. Please try again.",
      ]);
    } finally {
      setBusy(false);
      if (ref.current) ref.current.value = "";
    }
  }

  return (
    <div className="provenance-page">
      {hasUploadedCsv && (
        <section
          className="panel mock-results-panel mock-results-featured"
          aria-live="polite"
        >
          <div className="mock-results-header">
            <div>
              <span className="eyebrow">CSV FORECAST OUTPUT</span>
              <h2>Blended forecast</h2>
              <p>
                {s.location} · {meta.label} · +{s.lead} h ·{" "}
                {s.cell.lat.toFixed(1)}°N / {s.cell.lon.toFixed(1)}°E
              </p>
            </div>
            <span className={`mock-risk-pill ${f.risk.toLowerCase()}`}>
              {f.risk} risk
            </span>
          </div>

          <div className="mock-result-layout">
            <div className="mock-result-lead">
              <span>Adaptive guidance</span>
              <strong>
                {f.value.toFixed(1)} <small>{meta.unit}</small>
              </strong>
              <p>
                {f.confidence} confidence · {Math.round(f.probability * 100)}%{" "}
                threshold exceedance
              </p>
              <div className="result-insight">
                <span>Forecast signal</span>
                <p>{f.reasons[0]}</p>
              </div>
            </div>

            <div className="mock-result-metrics">
              <div>
                <span>Equal-weight baseline</span>
                <strong>
                  {f.baseline.toFixed(1)} <small>{meta.unit}</small>
                </strong>
              </div>
              <div>
                <span>Central 80% range</span>
                <strong>
                  {f.lower.toFixed(1)}–{f.upper.toFixed(1)}{" "}
                  <small>{meta.unit}</small>
                </strong>
              </div>
              <div>
                <span>Review threshold</span>
                <strong>
                  {f.threshold.toFixed(1)} <small>{meta.unit}</small>
                </strong>
              </div>
            </div>
          </div>

          <div className="mock-source-table">
            <div className="mock-source-heading">
              <span>Forecast source</span>
              <span>Guidance</span>
              <span>Blend weight</span>
            </div>
            {f.sources.map((source) => {
              const sourceMeta = SOURCES.find((item) => item.id === source.id)!;
              return (
                <div className="mock-source-row" key={source.id}>
                  <span>
                    <i style={{ background: sourceMeta.color }} />
                    {sourceMeta.short}
                  </span>
                  <strong>
                    {source.corrected.toFixed(1)} {meta.unit}
                  </strong>
                  <div className="blend-weight">
                    <strong>{(source.weight * 100).toFixed(0)}%</strong>
                    <i>
                      <span style={{ width: `${source.weight * 100}%` }} />
                    </i>
                  </div>
                </div>
              );
            })}
          </div>
          <p className="mock-results-footnote">
            Shared scenario forecast values also power the workspace charts.
            This is a scenario result, not an operational forecast.
          </p>
        </section>
      )}

      <section className="panel upload-panel upload-panel-secondary">
        <div className="panel-heading">
          <div>
            <h2>Try a CSV with this scenario</h2>
            <p>Any column layout is accepted. The file stays on your device.</p>
          </div>
        </div>
        <div
          className={`drop-zone ${drag ? "dragging" : ""}`}
          onDragOver={(event) => {
            event.preventDefault();
            setDrag(true);
          }}
          onDragLeave={() => setDrag(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDrag(false);
            if (event.dataTransfer.files[0])
              void read(event.dataTransfer.files[0]);
          }}
        >
          <UploadCloud size={30} />
          <h3>{busy ? "Preparing scenario results…" : "Drop a CSV here"}</h3>
          <p>Any CSV format · forecast results use the current scenario</p>
          <button
            className="button"
            onClick={() => ref.current?.click()}
            disabled={busy}
          >
            Browse files
          </button>
          <input
            ref={ref}
            type="file"
            accept=".csv,text/csv"
            aria-label="Upload forecast CSV"
            hidden
            onChange={(event) => {
              if (event.target.files?.[0]) void read(event.target.files[0]);
            }}
          />
        </div>
        <div className="upload-secondary-actions">
          <button
            className="text-button"
            onClick={() =>
              downloadFile("astrablend-template.csv", template, "text/csv")
            }
          >
            <Download size={14} /> Download CSV template
          </button>
          {hasUploadedCsv && (
            <button
              className="text-button"
              onClick={() => {
                reset();
                setErrors([]);
              }}
            >
              Clear uploaded filename
            </button>
          )}
        </div>
        {errors.length > 0 && (
          <div className="validation-errors" role="alert">
            <strong>Choose a CSV file</strong>
            {errors.map((error, index) => (
              <p key={index}>{error}</p>
            ))}
          </div>
        )}
        {busy && (
          <div className="upload-processing" role="status" aria-live="polite">
            <div className="upload-processing-heading">
              <span className="processing-spinner" aria-hidden="true" />
              <div>
                <strong>Preparing your demo forecast</strong>
                <p>{uploadName}</p>
              </div>
              <span className="processing-percent">
                {Math.round(
                  ((processingStep + 1) / processingStages.length) * 100,
                )}
                %
              </span>
            </div>
            <div className="processing-track">
              <span
                style={{
                  width: `${((processingStep + 1) / processingStages.length) * 100}%`,
                }}
              />
            </div>
            <ol>
              {processingStages.map((stage, index) => (
                <li
                  className={
                    index < processingStep
                      ? "complete"
                      : index === processingStep
                        ? "active"
                        : ""
                  }
                  key={stage}
                >
                  <span>{index < processingStep ? "✓" : `0${index + 1}`}</span>
                  {stage}
                </li>
              ))}
            </ol>
            <p className="processing-caption">
              Demo processing uses the selected scenario; CSV contents are not
              parsed.
            </p>
          </div>
        )}
        {hasUploadedCsv && (
          <div className="upload-success">
            <FileCheck2 size={19} />
            <div>
              <strong>CSV accepted · forecast ready</strong>
              <p>{demoUploadName}</p>
            </div>
          </div>
        )}
      </section>
    </div>
  );
}
