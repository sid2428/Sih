# AstraBlend — interaction redesign

Implemented 23 September 2026. Frontend-only scope remains locked.

## What changed and why

The original overview presented the map, pipeline, forecast, weights, small charts, and preset cards simultaneously. It lacked a visible process and its charts offered little direct exploration. This revision separates **running a forecast** from **checking the evidence**.

- **Agent workspace:** choose context → evaluate three sources → resolve weights → check extreme evidence → inspect the result. One large canvas and one context-sensitive inspector replace the many-card overview. Map/3D are tabs; advanced configuration is collapsed.
- **Model comparison:** one large interactive chart with a linked point inspector. A computed ranking below it establishes the result rather than relying on an isolated uplift statistic.
- **Extreme risk / provenance:** retained as deeper investigation tools, with the same shared forecast context.

## Research translated into interactions

| Primary reference | Pattern adopted |
|---|---|
| [React Flow: animating edges](https://reactflow.dev/examples/edges/animating-edges) | Custom nodes, selectable agent detail, moving signals during actual run stages, zoom/pan and draggable arrangement. |
| [Langflow: concepts](https://docs.langflow.org/concepts-overview) | A clear relationship between the visual workflow, executing it, and inspecting its outputs. No Langflow backend or LLM service is used. |
| [Apache ECharts: events and actions](https://echarts.apache.org/handbook/en/concepts/event/) | Axis-pointer events link the graph and point inspector; actions drive replay, tooltip inspection and zoom reset. |
| [Observable Plot: crosshair](https://observablehq.com/plot/interactions/crosshair) | Precise point inspection instead of decorative miniature charts. Implemented with ECharts. |
| [Windy: compare forecast models](https://community.windy.com/topic/8972/why-compare-forecast-models) | Compare source behavior for the same context, and make disagreement visible. |

These informed interaction patterns, not copied branding or a claim that this app has their operational capabilities.

## Visual system

Dark graphite shell and blue-slate work surfaces; indigo for physics, teal for ensembles, violet for the AI profile, warm amber for the adaptive comparison line, and white dashed observations. Stable color semantics connect the canvas, inspector, and chart. Manrope handles headings and controls; IBM Plex Mono handles exact values. Motion communicates stage progress, source contribution, or a user action, and respects reduced-motion preferences. Whitespace and progressive disclosure reduce the initial information load.

## Architecture and safeguards

- React 19 + strict TypeScript, Zustand for shared forecast context and a separate run lifecycle.
- React Flow 12 for orchestration, Apache ECharts 6 for comparison, existing Three.js for optional 3D and D3 for geographic context. Versions are exact and locked.
- Three source jobs run in browser module workers; the blending job follows. Workers call the same pure engine used elsewhere. Unsupported/blocked workers fall back locally, not to a server.
- Run states: idle, running, paused, complete, stale, error. Every run owns an abort controller and an immutable input snapshot. New inputs invalidate all prior output; replacing a run prevents late replies from publishing.
- Presentation pacing (1×/2×/4×) is independent of compute duration. The trace records actual calculated outputs, with no fabricated network activity or claims of live LLM execution.
- Graph nodes support keyboard inspection. A resize observer refits the graph after viewport changes. Reduced motion suppresses particles/scans; Three.js has an SVG fallback.
- Comparison modes: 24 held-out historical cases; 6–240 hour forecast leads; held-out error by lead. Historical plotted RMSE is tested against engine metrics for all six presets. Rankings may favor any source.
- Uploaded data only plots its actual available forecast leads. Historical replay and skill curves remain disabled because the upload contract does not establish aligned, independent evaluation cases. The existing insufficient-history prior remains disclosed in provenance and agent inspection.
- All files, forecasts, graphs, exports and calculations stay local. No backend, credentials, real feeds, cloud agents, or deployment is added.

## Verification

See [verification.md](verification.md) for current results and [demo-guide.md](demo-guide.md) for the revised presentation sequence.
