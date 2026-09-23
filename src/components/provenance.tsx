import { useRef, useState } from "react";
import {
  UploadCloud,
  Download,
  FileCheck2,
  Check,
  X,
  Database,
  ArrowUpRight,
} from "lucide-react";
import { SOURCES, VARIABLES } from "../data/mock-profile";
import { parseForecastCsv, downloadFile } from "../lib/csv/parse";
import { useForecastStore } from "../store/forecast-store";
import type { Forecast, ForecastRecord } from "../types/forecast";
const template =
  "timestamp,lat,lon,lead_time,source,variable,forecast_value,observed_value\n2026-07-18T06:00:00Z,19.5,73.5,48,nwp,rainfall,108,\n2026-07-18T06:00:00Z,19.5,73.5,48,ensemble,rainfall,62,\n2026-07-18T06:00:00Z,19.5,73.5,48,ai,rainfall,96,\n";
export default function Provenance({ forecast: f }: { forecast: Forecast }) {
  const {
    selection: s,
    records,
    fileName,
    setRecords,
    reset,
  } = useForecastStore();
  const ref = useRef<HTMLInputElement>(null);
  const [errors, setErrors] = useState<string[]>([]);
  const [pending, setPending] = useState<ForecastRecord[]>([]);
  const [name, setName] = useState("");
  const [busy, setBusy] = useState(false);
  const [drag, setDrag] = useState(false);
  const meta = VARIABLES[s.variable];
  async function read(file: File) {
    setBusy(true);
    setErrors([]);
    setPending([]);
    try {
      if (file.size > 10 * 1024 * 1024)
        throw new Error("The file must be smaller than 10 MB.");
      if (!file.name.toLowerCase().endsWith(".csv"))
        throw new Error("Choose a .csv file.");
      const result = parseForecastCsv(await file.text());
      setErrors(result.errors);
      setPending(result.records);
      setName(file.name);
    } catch (error) {
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
  const preview = pending.length ? pending : records;
  const steps = [
    {
      title: "Bias correction",
      detail: `Subtract fitted mean error before blending. Current offsets: ${f.sources.map((r, i) => `${SOURCES[i].short} ${r.bias.toFixed(1)} ${meta.unit}`).join("; ")}.`,
    },
    {
      title: "Recent skill",
      detail: `Fit bias on the first 60% of history; score corrected forecasts on the next 20%. Cost combines normalized mean-square error${s.variable === "rainfall" ? " and threshold misses" : ""}.`,
    },
    {
      title: "Adaptive weighting",
      detail: `Stable softmax with temperature ${s.temperature.toFixed(2)}. Missing sources receive zero weight. Current weights: ${f.sources.map((r) => `${r.id} ${(r.weight * 100).toFixed(1)}%`).join(", ")}.`,
    },
    {
      title: "Central forecast",
      detail: `Weighted corrected forecast: ${f.routine.toFixed(1)} ${meta.unit}. Equal-weight baseline: ${f.baseline.toFixed(1)} ${meta.unit}.`,
    },
    {
      title: "Tail-aware guidance",
      detail: `${f.agreement} sources exceed ${f.threshold} ${meta.unit}. Tail guard strength ${(f.tailStrength * 100).toFixed(1)}%. Final guidance ${f.value.toFixed(1)} ${meta.unit}. Exceedance probability is an empirical residual-mixture estimate; scenario calibration does not establish real-world probability reliability.`,
    },
  ];
  return (
    <div className="provenance-layout">
      <div>
        <section className="panel cycle-panel">
          <div className="panel-heading">
            <div>
              <h2>Forecast record</h2>
              <p>Every output has a traceable origin</p>
            </div>
            <Database size={19} />
          </div>
          <dl className="record-grid">
            <div>
              <dt>Dataset</dt>
              <dd>
                {records.length ? fileName : "Monsoon reference scenarios"}
              </dd>
            </div>
            <div>
              <dt>Engine version</dt>
              <dd>1.0.0</dd>
            </div>
            <div>
              <dt>History starts</dt>
              <dd>{f.historyStart.slice(0, 10)}</dd>
            </div>
            <div>
              <dt>History ends</dt>
              <dd>{f.historyEnd.slice(0, 10)}</dd>
            </div>
            <div>
              <dt>Spatial cell</dt>
              <dd>
                {s.cell.lat}°N / {s.cell.lon}°E
              </dd>
            </div>
            <div>
              <dt>Coverage</dt>
              <dd>{f.coverage}</dd>
            </div>
          </dl>
          <div className="provenance-note">
            {records.length
              ? "Uploaded data stays in this browser session. Where fewer than 20 earlier matching observations exist, scenario calibration is used as a prior; skill uplift is unavailable."
              : "The demo dataset is generated from a seeded weather-error profile. Source strengths, correlated errors, and extreme episodes are documented in the profile. These are scenario results, not operational model forecasts."}
          </div>
        </section>
        <section className="panel ledger">
          <div className="panel-heading">
            <div>
              <h2>Decision ledger</h2>
              <p>Follow the calculation from input to guidance</p>
            </div>
            <span className="subtle-tag">5 stages</span>
          </div>
          {steps.map((step, i) => (
            <details key={step.title} open={i === 0}>
              <summary>
                <span className="step-number">0{i + 1}</span>
                {step.title}
                <span className="ledger-plus">+</span>
              </summary>
              <p>{step.detail}</p>
            </details>
          ))}
        </section>
        <section className="panel input-health">
          <div className="panel-heading">
            <h2>Source health</h2>
            <span className="muted">Selected forecast group</span>
          </div>
          {f.sources.map((source, i) => (
            <div className="health-row" key={source.id}>
              <span>
                <i style={{ background: SOURCES[i].color }} />
                {SOURCES[i].name}
              </span>
              <span className={source.available ? "healthy" : "delayed"}>
                {source.available ? <Check size={13} /> : <X size={13} />}{" "}
                {source.available ? "Available" : "Unavailable"}
              </span>
              <span className="mono muted">{source.samples} cases</span>
            </div>
          ))}
        </section>
      </div>
      <div>
        <section className="panel upload-panel">
          <div className="panel-heading">
            <div>
              <h2>Use your dataset</h2>
              <p>Bring forecasts into the same workflow</p>
            </div>
            <ArrowUpRight size={19} />
          </div>
          <div
            className={"drop-zone " + (drag ? "dragging" : "")}
            onDragOver={(e) => {
              e.preventDefault();
              setDrag(true);
            }}
            onDragLeave={() => setDrag(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDrag(false);
              if (e.dataTransfer.files[0]) void read(e.dataTransfer.files[0]);
            }}
          >
            <UploadCloud size={34} />
            <h3>
              {busy ? "Validating your file…" : "Drop a forecast CSV here"}
            </h3>
            <p>Up to 10 MB · files stay on your device</p>
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
              onChange={(e) => {
                if (e.target.files?.[0]) void read(e.target.files[0]);
              }}
            />
          </div>
          <button
            className="text-button"
            onClick={() =>
              downloadFile("astrablend-template.csv", template, "text/csv")
            }
          >
            <Download size={14} /> Download CSV template
          </button>
          <div className="upload-spec">
            <h3>Expected fields</h3>
            <p>
              Timestamp, latitude, longitude, lead time, source, variable, and
              forecast value. Observations are optional.
            </p>
            <p>
              Units: rainfall in mm per 24 h, temperature in °C, wind in km/h.
              Timestamp is the initialization time; lead hours locate the
              forecast window start.
            </p>
          </div>
          {errors.length > 0 && (
            <div className="validation-errors" role="alert">
              <strong>File needs a correction</strong>
              {errors.map((error, i) => (
                <p key={i}>{error}</p>
              ))}
            </div>
          )}
          {pending.length > 0 && (
            <div className="upload-success">
              <FileCheck2 size={19} />
              <div>
                <strong>{pending.length} rows validated</strong>
                <p>{name}</p>
              </div>
              <button
                className="button primary"
                onClick={() => {
                  setRecords(pending, name);
                  setPending([]);
                }}
              >
                Use dataset
              </button>
            </div>
          )}
          {records.length > 0 && (
            <button
              className="text-button"
              onClick={() => {
                reset();
                setPending([]);
                setErrors([]);
              }}
            >
              Return to demo dataset
            </button>
          )}
        </section>
        {preview.length > 0 && (
          <section className="panel preview-panel">
            <div className="panel-heading">
              <h2>Dataset preview</h2>
              <span className="subtle-tag">{preview.length} rows</span>
            </div>
            <div className="table-scroll">
              <table>
                <thead>
                  <tr>
                    <th>Source</th>
                    <th>Variable</th>
                    <th>Lead</th>
                    <th>Forecast</th>
                    <th>Observed</th>
                  </tr>
                </thead>
                <tbody>
                  {preview.slice(0, 8).map((r, i) => (
                    <tr key={i}>
                      <td>{r.source}</td>
                      <td>{r.variable}</td>
                      <td>{r.lead_time} h</td>
                      <td>{r.forecast_value}</td>
                      <td>{r.observed_value ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>
        )}
        <section className="panel methodology">
          <h3>Designed to be reproducible</h3>
          <p>
            Calibration excludes observations whose valid windows finish after
            the selected forecast initialization. Uploaded groups remain
            separate by location, variable, date, and lead time.
          </p>
          <p>
            Map outline: Natural Earth via world.geo.json. Coarse contextual
            geography; not an administrative or jurisdictional map.
          </p>
        </section>
      </div>
    </div>
  );
}
