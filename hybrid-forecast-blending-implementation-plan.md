# Hybrid AI–NWP Forecast Blending System
## Locked frontend implementation blueprint — SIH 2026 · PS 26081

> 23 September update: frontend-only scope is unchanged. The overview/explorer interaction design below is superseded by [interaction-redesign.md](interaction-redesign.md): Agent workspace → Model comparison → Extreme risk desk → Data & provenance. The revised implementation uses React Flow, module Web Workers, and Apache ECharts; this document retains the original scientific and delivery scope.

## 1. Product outcome

Build **AstraBlend**, a laptop-first forecast decision instrument for NCMRWF-style operations. It answers one operational question clearly:

> Which forecast source should lead at this location, for this lead time and weather regime—and how does that change the resulting rainfall risk?

The application is a self-contained Vite + React + TypeScript frontend. It has no API, server, authentication, live data connection, database, or deployment dependency. All data, profiles, derived skill scores, and forecast calculations run in the browser. The upload flow is local-only and never sends a file anywhere.

The primary story is **heavy rainfall during monsoon conditions**. Temperature and wind are real selectable variables, but they are supporting modes, not competing narratives.

### Locked decisions

| Decision | Final choice |
|---|---|
| Application scope | Frontend-only, browser-computed, offline-demo safe |
| Map resolution | Fixed 1° latitude/longitude cells clipped to India |
| Fast navigation | Six named, high-impact locations snap to their nearest grid cell |
| Main interaction | Guided briefing presets plus full advanced controls |
| Forecast emphasis | Rainfall risk first; temperature and wind selectable |
| Primary device | 1366px+ laptop/projector; tablet-safe; mobile is not a target workflow |
| View sequence | Operations Overview → Blend Explorer → Extreme Risk Desk → Data & Provenance |

## 2. Research findings translated into product decisions

This is not a copy of another dashboard. The following established patterns make the concept more operational and more defensible.

| Research signal | Product decision |
|---|---|
| IMD’s MausamGram lets a user select a location directly on the map, then provides localized forecasts and warning-oriented information. | The India grid is selectable, and named locations provide immediate, rehearsable demo entry points. The location always remains visible in the context bar. |
| ECMWF operational products use exceedance probabilities, plumes/meteograms, and ensemble spread rather than treating a mean as certainty. | Rainfall output shows a 24-hour total *and* a threshold-exceedance risk, confidence band, and source agreement. The interface never implies that one deterministic number is certain. |
| WeatherBench 2 explicitly uses different metrics for different variables; precipitation is evaluated differently from temperature and wind. | The engine uses variable-aware skill scoring: rainfall uses a precipitation-sensitive error score with threshold verification; temperature and wind use normalized rolling MSE. There is no misleading universal “accuracy” score. |
| Multi-model precipitation work combines bias correction and dynamically updated weights, but simple pixel-wise averages can broaden rain areas and suppress peaks. | The ordinary forecast is a reliability-weighted blend. A separate tail-aware risk path activates only under defined rainfall evidence, preserving risk guidance without silently replacing every forecast by the largest source. |
| Operational multi-model systems account for delayed or unavailable inputs by rescaling available sources. | Missing sources are excluded, remaining weights are renormalized, a visible source-health state is raised, and the explanation says what changed. |
| IMD’s impact-based warning practice connects a weather signal to a warning/action context. | Extreme Risk Desk pairs the meteorological signal with a restrained alert level and a one-line operational implication—never an unexplained red number. |

### Ideas deliberately not copied

- No public-weather tiled map, decorative clouds, or stock imagery.
- No card-grid “analytics” layout; dense values live on calibrated panels with clear hierarchy.
- No all-model spaghetti plot as the default. It can be useful to experts, but obscures the central blending decision in a 90-second judging demo.
- No claim that AI is universally superior, and no hard-coded “improvement” figure. Any uplift displayed is calculated from the selected historical profile against the equal-weight baseline.

## 3. Demonstration story

The opening state is a rainfall briefing, not an empty dashboard.

1. **Start at Mumbai / Konkan cloudburst.** The map focuses on the selected 1° cell. The AI Pattern Model and Physics-based NWP connections visibly carry more influence than Ensemble Guidance. The forecast reads: location, 24-hour rainfall, confidence, threshold risk, and a single plain-language reason.
2. **Open Blend Explorer.** Select the *Monsoon onset* preset, then move lead time from Day 2 to Day 6. Weight bars, skill curves, reasoning trace, map, and pipeline change together in under one second.
3. **Open Extreme Risk Desk.** Compare a naive equal average with the tail-aware adaptive guidance on the same axis. The latter preserves the risk signal and explains why it was escalated.
4. **Open Data & Provenance.** Show forecast-cycle context, all source health states, calibration coverage, the five decision steps, and a local-file upload preview. This closes the credibility loop.

The six quick-select locations are: **Mumbai, Guwahati, Mangaluru, Kolkata, Delhi, and Chennai**. They are chosen to make the rainfall, heat, and wind modes visually distinct; they are not claims about current conditions.

## 4. Information architecture and screen specifications

### Persistent shell

**Left workflow rail**

1. Operations Overview
2. Blend Explorer
3. Extreme Risk Desk
4. Data & Provenance

Use numbers, a short label, and one precise line icon. The active view has an indigo 2px rule and brighter text; do not put every navigation item inside a rounded tile.

**Top context bar**

- Selected location and grid coordinate
- Variable: `Rainfall · 24 h` by default
- Valid time and lead time
- Data label: `Demo dataset · Cycle 06Z`
- Source-health indicator: `3/3 inputs available`, or a concise delayed-source state

The persistent data label prevents users from reading scenario values as a live public warning, while keeping the interface focused on its operational workflow.

### 4.1 Operations Overview — “What is the current cycle saying?”

**Purpose:** orient a forecaster in ten seconds.

**Layout:** a 12-column desktop canvas, with the map taking 5 columns, the rendered pipeline 4, and forecast/rationale 3. At tablet width, map and pipeline stack; the reading panel remains adjacent to the active context.

- **India dominance grid:** 1° clipped square cells. Fill uses the leading source hue. If the top two weights differ by less than 8 percentage points, render a neutral, lightly hatched contested state rather than inventing dominance. Selecting a cell updates the entire shared forecast state.
- **Pipeline hero:** three source nodes → Blending Agent → Forecast Output in shallow 3D. Tube radius, restrained emissive intensity, and particle density all encode the same current weight. One meaning per visual channel; the dominant path receives the only subtle bloom.
- **Forecast readout:** `24 h rainfall`, `likely range`, `exceedance risk`, and `confidence`. Values are monospace/tabular and are accompanied by a plain-language interpretation.
- **Decision sentence:** e.g. “At this lead time, the physics-based forecast leads because its recent monsoon error is lowest in this grid cell.” The wording is generated from the actual selected factors.
- **Briefing presets:** six compact controls: Konkan cloudburst, Northeast convergence, Bay low-pressure system, Day-6 uncertainty, Heat dome, and Coastal high wind. Each is a named state bundle; no hidden special rendering is allowed.

### 4.2 Blend Explorer — “Why did the weights change?”

**Purpose:** show causal, inspectable adaptation rather than a magic forecast.

**Control strip:** Location (quick-select or map), variable, season/date, lead time 6–240 h, weather regime, and blend temperature. The advanced strip opens from a single *Explore parameters* control after the presets, so the first view remains approachable.

- **Weight panel:** three large horizontal bars with exact percentages. The bar labels are `Physics-based NWP`, `Ensemble Guidance`, and `AI Pattern Model`; acronyms appear only in tooltips after their expanded labels.
- **Skill-by-lead chart:** source skill and adaptive blend skill on a shared normalized error scale. The baseline equal-weight series is a thin dashed neutral reference. The selected lead time is an anchored vertical rule, not a floating tooltip-only state.
- **Pipeline echo:** use the existing Three.js canvas when desktop space permits; otherwise show a lightweight SVG wiring summary with the same weight values. Do not instantiate two WebGL scenes.
- **Reasoning trace:** exactly 2–3 ranked, plain-language facts. Each maps to a true engine input: regional skill, lead-time trend, season/regime factor, source availability, or tail evidence.
- **“What changed?” delta:** before/after text appears whenever a control moves, such as “AI Pattern Model −14 points after Day 5; Physics-based NWP +11 points.” It is more informative than animation alone.

### 4.3 Extreme Risk Desk — “Does the blend preserve the high-impact signal?”

**Purpose:** make the disaster-management value unmissable.

- **Mode selector:** Heavy rainfall (default), heatwave, high wind.
- **Shared-axis comparison:** left, equal-weight baseline; right, adaptive guidance. Both show the same 24-hour/forecast-window axis, source values, a threshold rule, and the selected blended result. No different y-axis scales.
- **Risk interpretation:** probability of exceeding the event threshold, forecast confidence, and source agreement. For rainfall, use a configurable heavy-rain threshold appropriate to the current profile; never imply an official issued warning.
- **Risk level:** `Monitor`, `Elevated`, or `High` with alert coral reserved only for High. A short implication sits alongside it: “A concentrated high-rainfall signal remains after blending; prioritize local review.”
- **Method disclosure:** a collapsible “How this preserves tails” explanation shows the evidence criteria and the interpolation used. It must not expose raw implementation jargon by default.

### 4.4 Data & Provenance — “Can I reproduce this answer?”

**Purpose:** establish operational discipline without becoming a developer console.

- **Cycle record:** selected profile, valid time, lead, spatial cell, variable, calibration window, sample count, and engine version.
- **Input health:** each source’s availability, coverage, and timestamp. A delayed source shows the exact weight renormalization behavior.
- **Decision ledger:** five expandable rows—bias correction, skill scoring, adaptive weighting, blend, tail-aware risk—with one sentence and actual selected values.
- **Local upload:** drag/drop or file picker for CSV. Validate before accepting and render an in-style preview table.
- **Upload behavior:** a file with forecasts only can be explored against the bundled skill profile. A file with both forecast and observation values enables local recalibration. Nothing leaves the browser.

## 5. Design system

### Visual tokens

```css
--ink: #0B0D11;
--surface: #12151B;
--surface-raised: #181C24;
--surface-line: #28303D;
--fog: #8A93A6;
--text: #E8ECF4;
--paper: #F4F5F7;
--signal-nwp: #4C6FFF;
--signal-ensemble: #2FB8A6;
--signal-ai: #B06AE0;
--alert: #FF5C4D;
--success: #80C98D;
```

Use dark canvas by default. The only light surface is a deliberate dense data readout, not a floating white card. Elevation comes from a 1px line, background shift, and spacing—not blurred drop shadows. Corner radii are restrained: 4px for fields, 8px for panels, and fully round only for tiny status dots.

### Type and hierarchy

- **Interface/display:** `Manrope Variable`, self-hosted through the app bundle. Its humanist geometry is distinctive without appearing decorative.
- **Measurements:** `IBM Plex Mono`, `font-variant-numeric: tabular-nums`.
- **Scale:** 32–40px overview forecast value; 24–28px view title; 15–16px primary labels; 12–13px metadata. Avoid uppercase eyebrow-label patterns and arbitrary tracking.
- **Copy rule:** each important number gets one useful sentence adjacent to it. A tooltip may add detail, but it must not be the only explanation.

### Interaction and motion

- One state update drives map, graph, bars, prose, and pipeline from a shared derived snapshot.
- Use GSAP `power2.out` / a matching cubic-bezier; settle standard changes in 350–600ms. Never use bounce, parallax scrolling, or autonomous camera rotation.
- The pipeline camera has a near-imperceptible idle drift only when visible and motion is allowed.
- Respect `prefers-reduced-motion`; disable particle travel and tweened chart transitions. If WebGL fails, render the SVG pipeline automatically.
- Keyboard behavior: tab order follows reading order; cells and controls are focusable; every color encoding also has a textual label; charts expose a summary and data table alternative.

## 6. Data model and deterministic scenario profile

### Canonical frontend types

```ts
type SourceId = 'nwp' | 'ensemble' | 'ai';
type VariableId = 'rainfall' | 'temperature' | 'wind';
type RegimeId =
  | 'monsoon-onset'
  | 'active-monsoon'
  | 'low-pressure-system'
  | 'western-disturbance'
  | 'heat-dome'
  | 'quiescent';

interface ForecastRecord {
  timestamp: string;
  lat: number;
  lon: number;
  leadTimeHours: number;
  source: SourceId;
  variable: VariableId;
  forecastValue: number;
  observedValue?: number;
}

interface Selection {
  cellId: string;
  variable: VariableId;
  validDate: string;
  leadTimeHours: number;
  regime: RegimeId;
  blendTemperature: number;
}
```

### Spatial profile

- Bounds: 6–37°N and 68–98°E; generate 1° cells and retain cells whose centers are inside the bundled India polygon. This produces a coarse, legible grid and avoids a fabricated high-resolution map.
- Every named location maps explicitly to a nearest retained cell in `locations.ts`; do not geocode at runtime.
- `regions.ts` contains documented regional multipliers: west coast, northeast hills, Gangetic plain, central India, northwest, east coast, and Himalayan terrain. These explain stable regional skill patterns.

### Scenario generation rules

All profile coefficients live in readable `src/data/mock-profile.ts` and are seeded. Reloading the same preset produces the same narrative and values.

1. Generate a latent weather signal by cell, variable, season, lead, and regime.
2. Generate each source forecast from that signal using a source-specific bias, lead-time error curve, regional multiplier, seasonal multiplier, and AR(1) correlated noise.
3. Plant documented high-impact rainfall, heat, and wind episodes in the profile, with source-specific capture quality. A planted event must be reproducible and displayed only through normal engine outputs.
4. Generate historical forecast/observation pairs for the rolling calibration window. These feed all displayed skill scores; no presentation number is manually set.
5. Inject selected source-delay states into one briefing preset to prove source-health handling.

## 7. Blending and risk engine

The engine is pure TypeScript under `src/lib/blending/`; components may never calculate weights themselves.

### Step 1 — Validate and normalize

Validate source, variable, range, grid cell, lead, and timestamp. Convert wind vectors to speed only where appropriate. Accumulate rainfall consistently to the active 24-hour window. If a source is unavailable, exclude it before weighting and surface the condition.

### Step 2 — Bias correction

For each `[source, cell/region, variable, lead bucket, season, regime]`, calculate a recency-weighted mean error from the historical window. Correct the current forecast by subtracting that bias. Apply reliability shrinkage toward regional skill when the local sample count is small.

### Step 3 — Variable-aware recent skill

- **Rainfall:** use a precipitation-sensitive normalized score that combines amount error and threshold-event correctness. Store heavy-rain hit, miss, and false-alarm counts as supporting evidence.
- **Temperature and wind:** use normalized recency-weighted MSE with bias visible separately.
- Smooth skill across adjacent lead-time knots (6, 24, 48 … 240h) to prevent implausible weight flicker while retaining a visible crossover.

The screen calls this *recent error* and *recent skill*, never an absolute model rank.

### Step 4 — Adaptive weights

Transform corrected skill costs into weights using temperature-controlled softmax:

```text
weight_i = exp(-cost_i / T) / Σ exp(-cost_j / T)
```

`T` is the Blend Explorer’s “decisiveness” control: low temperature concentrates weight; high temperature distributes it. Then apply availability filtering and normalize weights to exactly 100%. A minimum reliability rule prevents a source with insufficient history from winning solely due to a tiny sample.

### Step 5 — Blend, confidence, and tail-aware risk

- **Routine value:** weighted sum of bias-corrected source forecasts.
- **Confidence:** combines calibrated recent error, current inter-source disagreement, sample adequacy, and source availability. It is reported as High / Moderate / Limited, with an explanation—not as a false probability of being correct.
- **Rainfall risk:** derive per-source exceedance evidence for the configured threshold, then reliability-weight it. The primary risk measure is probability of exceedance, which remains useful even when the central value is uncertain.
- **Tail guard:** only when threshold evidence and source agreement exceed configuration gates, interpolate the routine rainfall blend toward the reliability-weighted upper source quantile. The interpolation strength is bounded and recorded in the ledger. This avoids both peak-smearing and a brittle “always choose the maximum” policy.
- **Baseline comparison:** equal-weight, bias-corrected average with no tail guard. It is a counterfactual reference, not an operational source.

### Explanation generator

The explanation function consumes the same `DerivedForecast` object used by every view. It selects the top 2–3 factual drivers in priority order: delayed source, tail evidence, strongest recent regional skill, lead-time crossover, then regime/season effect. It may not invent causal language beyond those inputs.

## 8. Technical architecture

### Stack

| Need | Chosen tool | Reason |
|---|---|---|
| App shell | Vite, React 19, TypeScript strict | Fast build, local static bundle, component composability |
| State | Zustand | One small, inspectable selection store and derived snapshot flow |
| Validation | Zod + Papa Parse | Typed local CSV validation with helpful per-column errors |
| Data visualization | D3 modules | Scales, axes, SVG transitions, and geographic path handling without forcing a chart theme |
| Pipeline scene | Three.js native modules | A single tightly controlled scene, particle instancing, explicit fallback, minimal abstraction |
| DOM/SVG motion | GSAP | Unified, precise controlled transitions; no redundant second animation library |
| Icons | Lucide React | Sparse, consistent linear operational icons |
| Testing | Vitest + Testing Library + Playwright | Unit, component, and critical demo-flow coverage |

Do **not** add a UI kit, a chart-kit wrapper, React Three Fiber, Framer Motion, Tailwind, or a date-state library. They would either impose an unwanted visual grammar or duplicate a chosen responsibility.

### Directory structure

```text
src/
  app/                 # route shell, navigation, providers
  components/
    chrome/             # rail, context bar, status indicators
    overview/           # map, pipeline, forecast readout, presets
    explorer/           # controls, weights, skill chart, rationale
    risk/               # comparison chart, risk interpretation
    provenance/         # ledger, health, upload, preview
    visualizations/     # shared D3 primitives and Three/SVG pipeline
  data/
    india-grid.ts
    locations.ts
    regions.ts
    mock-profile.ts
    presets.ts
  lib/
    blending/           # pure five-step engine, explanations, metrics
    csv/                # schema mapper and validation
    formatters/
  store/                # selection and UI state only
  styles/               # tokens, fonts, global, component-level styles
  types/
  test/
public/
  fonts/
  geo/india-outline.geojson
```

### State flow and performance contract

```text
User selection or preset
        ↓
Zustand selection store
        ↓
memoized deriveForecast(selection, profile)
        ↓
single DerivedForecast snapshot
        ├── map cells
        ├── D3 skill chart
        ├── GSAP weight bars and number transitions
        ├── Three.js / SVG pipeline
        ├── extreme-risk comparison
        └── rationale and provenance ledger
```

- Precompute historical skill grids and profile coefficients at load time.
- Cache derived outputs by selection key; blend-temperature changes reuse skill values.
- Never calculate blending data inside `requestAnimationFrame`.
- Pause Three.js rendering when its tab is hidden or its canvas is offscreen.
- Keep particles in one `InstancedMesh`; cap based on device pixel ratio and reduced-motion state.
- Target interaction response under 300ms for a preset and under 100ms for a slider update on the project laptop. Target 60fps for the visible pipeline under normal graphics capability.

## 9. CSV upload contract

Accept CSV headers in snake_case and map them to canonical TypeScript fields:

```text
timestamp, lat, lon, lead_time, source, variable, forecast_value, observed_value
```

Required: all headers except `observed_value`. Validation errors identify row, column, expected type/value, and suggested correction. Enforce known sources and variables or require explicit source mapping. `timestamp` must parse to a valid ISO-compatible date; latitude/longitude must fall within the project domain; lead time must be 6–240 hours.

Files remain in memory only. A valid forecast-only file provides a browseable current state using the bundled skill profile. A file that also includes observations can derive a local calibration profile for its valid buckets. Unsupported sparse coverage produces a clear “insufficient history” state and shrinks toward regional/default skills.

## 10. Implementation sequence

### Phase 0 — Foundation

- Scaffold Vite React strict-TypeScript app, linting, formatting, Vitest, Playwright, and static asset handling.
- Install the final dependency set with pinned compatible versions.
- Define tokens, font loading, layout grid, viewport behavior, reduced-motion preference, and accessibility primitives.
- Create typed domain contracts before visual components.

### Phase 1 — Data and engine

- Build India grid, region profile, location lookup, seeded scenarios, and historical calibration records.
- Implement and document the five pure blending steps.
- Add engine tests before UI integration: normalized weights, lead-time crossover, insufficient history, missing source renormalization, deterministic profile output, and tail-gate behavior.

### Phase 2 — Shared visualization primitives

- Build accessible D3 axes, source-color legend patterns, grid map, source weight bars, and time/lead chart.
- Build the native Three.js pipeline in isolation with WebGL capability detection, canvas lifecycle cleanup, and SVG fallback.
- Profile pipeline particle budget and validate the fallback before it appears in a screen.

### Phase 3 — Operations Overview and briefing presets

- Implement shared selection state and top context bar.
- Wire map selection, location quick-select, forecast readout, pipeline, and rationale to the same derived snapshot.
- Implement six honest state presets through ordinary controls—not screen-specific fake data.

### Phase 4 — Blend Explorer and Extreme Risk Desk

- Add advanced control strip, animated source weights, skill-by-lead chart, delta explanation, and SVG pipeline echo.
- Add shared-axis baseline/adaptive comparison, threshold-risk logic, confidence, and plain-language operational implication.
- Test every variable and regime for readable output and no alert-color misuse.

### Phase 5 — Data & Provenance and local file handling

- Implement CSV input, Zod validation, styled preview, local-only calibration state, and source-health views.
- Add the decision ledger and profile metadata.
- Exercise invalid schemas, partial data, unavailable source, and zero-observation paths.

### Phase 6 — Product hardening and demo preparation

- Perform visual QA at 1366×768, 1440×900, 1920×1080, and tablet widths.
- Run keyboard navigation, color-contrast, screen-reader summary, reduced-motion, and forced-WebGL-failure checks.
- Record performance measurements and correct slow transitions before adding polish.
- Rehearse a 90-second scripted flow and prepare a one-page technical Q&A covering source weights, calibration, tail guard, availability fallback, and scope.

## 11. Test plan and acceptance criteria

### Unit tests

- Each source weight is non-negative; active weights sum to 1.
- Bias correction uses only prior-profile history and handles sample shrinkage.
- Lower cost produces higher weight at a fixed blend temperature.
- Higher blend temperature makes weights more even.
- A missing source is removed and remaining sources renormalize.
- Tail guard cannot activate without configured event evidence and agreement.
- Generated rationale names only computed drivers and uses the correct source/lead/location.
- CSV validation rejects missing fields, malformed numbers, invalid source IDs, and out-of-domain cells.

### Integration and visual tests

- A location click synchronizes map, context bar, pipeline, bars, chart marker, and narrative.
- Every briefing preset produces a distinct expected weight/risk pattern through the real engine.
- Baseline and adaptive risk comparison keep a shared y-axis.
- Forced no-WebGL mode renders the SVG pipeline without errors.
- `prefers-reduced-motion` removes nonessential animation.
- Critical desktop screenshots have no clipping, overlapping labels, or contrast failure.

### Definition of done

- A viewer can explain within 90 seconds why the selected source weights changed.
- Rainfall heavy-risk comparison shows an evidence-based difference from equal weighting on the same scale.
- Every displayed value is traceable to the derived snapshot and explainable through the ledger.
- The map, graph, pipeline, and prose update in synchrony from one selection change.
- All core flows work with the network disabled.
- WebGL and reduced-motion fallbacks work before demonstration day.
- No screen uses raw JSON, browser-default tables, decorative weather stock art, or generic repeated-card styling.

## 12. Explicit non-goals for this build

- No live NWP/AI feeds, backend, accounts, database, server-side calculation, or issuing of public warnings.
- No claim of validated real-world forecast-skill improvement from the demo profile.
- No mobile-first redesign, map-tiling service, or detailed district/village operational mapping.
- No attempt to train GraphCast/Pangu-like models; the project blends three typed forecast-source profiles.
- No feature added solely because it looks impressive. A visual earns its cost only if it explains forecast dominance, uncertainty, risk, or provenance.

## 13. Research sources

- [WeatherBench 2: evaluation framework and metric guidance](https://weatherbench2.readthedocs.io/en/latest/)
- [WeatherBench 2 scorecards and precipitation evaluation context](https://sites.research.google/gr/weatherbench/)
- [ECMWF forecast guidance on probability charts and local plumes](https://confluence.ecmwf.int/pages/viewpage.action?pageId=340777142)
- [IMD MausamGram location-based forecast interface](https://mausamgram.imd.gov.in/)
- [IMD impact-based forecast and colour-warning context](https://mausam.imd.gov.in/imd_latest/contents/pdf/SOUVENIR.pdf)
- [Multi-model quantitative precipitation blending with bias correction and dynamic weights](https://pubs-en.cstam.org.cn/article/doi/10.1007/s13351-021-0172-5)
- [Operationally oriented ensemble coalescence and quantile mapping for precipitation](https://journals.ametsoc.org/view/journals/wefo/40/2/WAF-D-24-0008.1.xml)
- [Indian monsoon heavy-precipitation postprocessing comparison](https://rmets.onlinelibrary.wiley.com/doi/abs/10.1002/qj.4677)
