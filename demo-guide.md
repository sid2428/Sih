# AstraBlend: 90-second briefing

1. **0–25 seconds — Run the forecast.** The Agent workspace starts its first run automatically. Use Replay run if it has finished. Pause while the source evaluators work, select the Physics or AI node, then resume. Explain how the blending stage assigns weights and checks extreme evidence. The right-hand inspector reveals the final result only on completion.
2. **25–55 seconds — Compare the evidence.** Select Compare all models. Hover over historical cases or scrub the replay slider. Toggle a source, drag the overview handles to zoom, and play the case sequence. Contrast the observed line, equal average, and adaptive blend. Read the computed rankings; never promise the blend wins every case.
3. **55–75 seconds — Change the decision.** Switch to Error by lead, then Forecast horizon. Adjust context to change the lead or source availability. Return to Agent workspace and run the changed inputs; demonstrate that old results disappear until reevaluation. The Day-6 uncertainty scenario excludes the AI input and renormalizes the remaining sources.
4. **75–90 seconds — Hand off.** Inspect Extreme risk desk or the provenance ledger. Return to the completed run and export its briefing. Regional map and 3D pathways are optional supporting views, not competing panels.

## Answers to likely questions

- **Are these live forecasts?** The bundled dataset uses a documented seeded weather-error profile. Local uploaded forecasts use the same engine. No real forecast feed or backend is included.
- **Are these LLM agents?** No. They are independently evaluated, typed browser jobs coordinated into a forecast workflow. Model labels describe source roles, not live APIs or newly trained weather models.
- **Is the displayed run time computation time?** No. Presentation playback is paced so each stage can be inspected. Workers calculate independently; pause holds the displayed progression, while cancel terminates outstanding work.
- **How is improvement calculated?** The plotted 24 held-out cases are the same untouched evaluation partition used by the engine. Source, equal-average, and adaptive errors are directly comparable. Rankings and improvement can change with context.
- **What happens when data changes mid-run?** The run is invalidated, unfinished workers are aborted, and no stale result can replace the new context.
- **What does uploaded data support?** Only actual imported lead groups are plotted. Historical replay and error curves are disabled. Fewer than 20 earlier matching observations invokes the existing disclosed calibration prior, with Limited confidence and no upload skill-uplift claim.
- **Is a risk estimate an official warning?** No. The thresholds support forecaster review and still require independent operational validation.
- **Will this need internet?** All computation is local. Start the static server and visit the comparison and optional 3D view once to preload those bundles. Preloaded workspace reruns and comparisons have an offline browser test. No service worker supports a cold offline start.
