# AstraBlend

A browser-based Hybrid AI–NWP Forecast Blending workspace for SIH 2026, PS 26081. An interactive source-agent workflow leads into an explorable model comparison, with regional context, extreme-weather guidance, and a reproducible calculation ledger.

## Run locally

Requires Node.js 22.14+ and npm. No environment variables or credentials are required.

```sh
npm ci
npm run dev
```

Open http://127.0.0.1:5173. `npm run build` produces a static site in `dist`; `npm run preview` serves that build locally. The Vite development/preview process only serves frontend assets; the product has no application backend or API. Assets and fonts are bundled locally. Visit the comparison and optional 3D view before disconnecting to preload their lazy bundles. Preloaded views can recompute offline; blocked workers fall back to the same browser evaluator. A cold launch still requires the local static server; no service worker is installed.

## What works

- Agent workspace: React Flow graph with three independently evaluated sources, adaptive blending and extreme-check stages, weighted animated connections, draggable nodes, a linked inspector, and an expandable execution trace. Pause, resume, cancel, replay, and change playback speed. The first run starts automatically; changing inputs invalidates it until rerun.
- Model comparison: lazy-loaded Apache ECharts with linked hover crosshairs, model toggles, drag-to-zoom overview, Ctrl-wheel zoom, case replay/scrubbing, resize and CSV export. Switch between held-out historical cases, forecast horizon, and error by lead. Rankings are calculated from the plotted evidence; the blend is not forced to win.
- Regional map and 3D pathways are secondary workspace tabs. Location, variable, cycle date, regime, lead, weight temperature, and source availability live under Configure/Adjust context, keeping the main screen focused.
- Extreme risk desk: rainfall, heat and wind modes; equal-average/adaptive values on one scale; threshold evidence and bounded rainfall tail guidance.
- Data & provenance: schema-validated local CSV upload, preview, selectable imported groups, earlier-observation recalibration, source health, and a five-stage ledger.
- Markdown briefing download, CSV template download, accessible navigation, tablet layouts, reduced-motion rendering and automatic WebGL fallback. Add `?no-webgl` to force the SVG diagram for testing or presentation.

## Forecast methodology

The default dataset is a deterministic, seeded scenario profile—not live model output or a trained weather model. `src/data/mock-profile.ts` documents source skill curves, regional factors, storm attenuation, thresholds, and temporal correlation. Changing its coefficients changes the computed story. No uplift number is hard-coded.

Each source has 120 historical cases. Bias is fitted on the earliest 72; the following 24 score corrected forecasts and provide residual samples; the final 24 independently evaluate the adaptive guidance and equal-weight baseline. Source weights use stable softmax of normalized error costs, with an added rainfall threshold-mismatch term. The same learned biases are used for both comparison methods.

Central guidance is the weighted corrected forecast. The probability estimate and central 80% interval come from a weighted empirical mixture of validation residuals. These are scenario estimates; no claim of real-world interval coverage or calibrated event probability is made. Probability reliability and skill improvement need real, independent observations before operational use.

For rainfall only, at least two corrected sources must exceed the configured threshold and the mixture exceedance estimate must reach 55% before the tail guard can activate. A bounded interpolation moves the central value toward the weighted upper source quantile, capped at 35%. The contribution is shown separately in the ledger. This is an auditable heuristic, not a spatial storm-reconstruction algorithm. Heat and wind use the ordinary blend. Thresholds are review thresholds, not official warning classifications.

Regional profiles include geographically shared error noise, smooth local modulation, seasonal coefficients, and AR(1) temporal errors. A 1° grid cannot resolve a local cloudburst; scenario names are briefing shortcuts to coarse forecast contexts.

## CSV contract

Download the example from Data & Provenance. Header:

```csv
timestamp,lat,lon,lead_time,source,variable,forecast_value,observed_value
2026-07-18T06:00:00Z,19.5,73.5,48,nwp,rainfall,108,
```

- `timestamp`: ISO initialization timestamp with a timezone. Use one initialization per date.
- `lat`, `lon`: numeric coordinates in 6–37°N, 68–98°E. Imported points retain their exact coordinates.
- `lead_time`: integer hours, 6–240. Forecast valid time is initialization plus lead time.
- Rainfall is **24-hour accumulation beginning at valid time**, in mm. This explicitly supports lead times shorter than 24 hours without including pre-initialization rainfall.
- Temperature is instantaneous 2 m air temperature (°C); wind is 10 m sustained speed (km/h).
- `source`: `nwp`, `ensemble`, or `ai`; `variable`: `rainfall`, `temperature`, or `wind`.
- `observed_value`: optional. Observation availability is assumed at the end of its valid window; only windows completed before current initialization may calibrate the selected group.
- Calibration matches exact coordinate, source, variable and lead. At least 20 earlier matching pairs are required; smaller groups use the bundled scenario prior and receive Limited confidence. Uploaded records never display an invented skill-uplift score.
- Maximum file size 10 MB and 50,000 rows. Invalid or duplicate data is rejected as a whole. Files stay in browser memory and are cleared on reload or when selecting a bundled scenario.

## Verification

```sh
npm test
npm run lint
npm run build
npm run test:e2e
```

Browser tests use installed Microsoft Edge through Playwright. Screenshots are written into ignored `test-results/`. Tests cover normalization, temperature behavior, outages, leakage, deterministic generation, CSV validation, the end-to-end briefing/import/export flow, offline interaction, 1366/1440/1920/820px layouts, reduced motion, fallback rendering, accessibility, and interaction timing.

The orchestration layer uses module Web Workers for computation, with separately paced presentation. “Agents” are typed local evaluators, not LLM services, independent trained models, or live forecast feeds. Pausing stops the displayed progression, not a calculation already dispatched; cancellation terminates active workers and rejects stale results. Worker failures, input invalidation, and replacement-run races have automated coverage.

Three.js and the comparison workspace are lazy loaded. Their approximately 0.54 MB and 0.57 MB minified chunks, plus the main React/React Flow bundle, trigger build-size advisories. The initial workspace does not wait for either optional view. Three.js rendering pauses when offscreen or hidden. Median frame cadence is exposed as `data-median-fps` on `.three-host` for profiling. A 60fps target is hardware-dependent, not guaranteed by a screenshot test.

## Source attribution and scope

India outline: [world.geo.json / Natural Earth](https://github.com/johan/world.geo.json/blob/master/countries/IND.geo.json), used as coarse contextual geography. It is not an authoritative administrative or jurisdictional boundary representation. Map selection is based on point-in-polygon cell centers, with edge squares visually clipped.

Fonts: Manrope Variable and IBM Plex Mono, bundled through Fontsource; retain their package licenses. See [interaction redesign](interaction-redesign.md) for research references, design choices, and the current architecture. The implementation blueprint records the original scope; its interaction design is superseded by the redesign note.

Later work, outside this frontend delivery: real forecast ingestion, meteorological regridding and accumulation alignment, independent validation, calibrated probabilistic models, operational scheduling, and forecaster approval workflows. None of these services is built or required here.
