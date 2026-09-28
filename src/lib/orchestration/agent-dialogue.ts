import type { Forecast, Selection, SourceResult } from "../../types/forecast";
import { VARIABLES } from "../../data/mock-profile";
import type { AgentDialogueMessage, AgentId } from "./protocol";

export interface AgentPersonas {
  id: AgentId | "system";
  name: string;
  role: string;
  affiliation: string;
  avatarColor: string;
  callsign: string;
}

export const AGENT_PERSONAS: Record<string, AgentPersonas> = {
  nwp: {
    id: "nwp",
    name: "Dr. Aris Thorne",
    role: "Atmospheric Dynamics Lead",
    affiliation: "NCMRWF-UM Core (4km grid)",
    avatarColor: "#7590ff",
    callsign: "NWP-DYNAMICS",
  },
  ensemble: {
    id: "ensemble",
    name: "Elena Rostova",
    role: "Probabilistic Spread Analyst",
    affiliation: "Global Ensemble Prediction (51 members)",
    avatarColor: "#42c4ac",
    callsign: "EPS-STOCHASTIC",
  },
  ai: {
    id: "ai",
    name: "Dr. Kenji Sato",
    role: "Deep Pattern Synthesizer",
    affiliation: "Fourier Neural Operator (ERA5 40yr)",
    avatarColor: "#bd8bea",
    callsign: "FNO-NEURAL",
  },
  radar_nowcast: {
    id: "radar_nowcast",
    name: "Cmdr. Vikram Nair",
    role: "Doppler Radar Extrapolator",
    affiliation: "IMD Doppler Radar Network (1km)",
    avatarColor: "#38bdf8",
    callsign: "RADAR-NOWCAST",
  },
  satellite_ir: {
    id: "satellite_ir",
    name: "Dr. Priya Sundaram",
    role: "Satellite Radiance Analyst",
    affiliation: "INSAT-3DR Rapid-Scan Radiance",
    avatarColor: "#f472b6",
    callsign: "SAT-RADIANCE",
  },
  ecmwf_ifs: {
    id: "ecmwf_ifs",
    name: "Marcus Lindqvist",
    role: "Global Deterministic Lead",
    affiliation: "ECMWF Integrated Forecasting (9km)",
    avatarColor: "#60a5fa",
    callsign: "ECMWF-HRES",
  },
  qc_filter: {
    id: "qc_filter",
    name: "QC Gatekeeper",
    role: "Quality Control & Boundary Gate",
    affiliation: "WMO Gross-Error & Gradient QC Filter",
    avatarColor: "#fbbf24",
    callsign: "QC-FILTER",
  },
  orographic_ds: {
    id: "orographic_ds",
    name: "Dr. Tara Banerjee",
    role: "Terrain Downscaling Specialist",
    affiliation: "SRTM 1km DEM Orographic Core",
    avatarColor: "#34d399",
    callsign: "TERRAIN-DS",
  },
  uncertainty_quant: {
    id: "uncertainty_quant",
    name: "Prof. Nathan Reed",
    role: "Conformal Uncertainty Evaluator",
    affiliation: "Conformal Prediction & EVT Bounds",
    avatarColor: "#c084fc",
    callsign: "CONFORMAL-UQ",
  },
  blend: {
    id: "blend",
    name: "Marcus Vance",
    role: "Chief Forecast Synthesizer",
    affiliation: "Adaptive Bayesian Blending Policy",
    avatarColor: "#a5adff",
    callsign: "BLEND-CHIEF",
  },
  output: {
    id: "output",
    name: "Operations Desk",
    role: "Regional Warning Dispatch",
    affiliation: "Official IMD Consensus Stream",
    avatarColor: "#75d4b3",
    callsign: "CONSENSUS-DESK",
  },
  system: {
    id: "system",
    name: "Simulation Supervisor",
    role: "Pipeline Orchestrator",
    affiliation: "AstraBlend Multi-Agent Runtime",
    avatarColor: "#93a4c3",
    callsign: "ORCHESTRATOR",
  },
};

export function getPersona(id: string): AgentPersonas {
  if (AGENT_PERSONAS[id]) return AGENT_PERSONAS[id];
  return {
    id,
    name: id.toUpperCase().replace(/_/g, " "),
    role: "Custom Analysis Node",
    affiliation: "User-Defined Graph Block",
    avatarColor: "#94a3b8",
    callsign: `CUSTOM-${id.slice(0, 4).toUpperCase()}`,
  };
}

export function getSimulatedAgentDialogue(
  selection: Selection,
  nwp: SourceResult,
  ensemble: SourceResult,
  ai: SourceResult,
  forecast: Forecast,
  weights: { nwp: number; ensemble: number; ai: number },
) {
  const meta = VARIABLES[selection.variable];
  const unit = meta.unit;
  const loc = selection.location;
  const isRain = selection.variable === "rainfall";
  const isTemp = selection.variable === "temperature";

  const physicsText = isRain
    ? `Convective storm cells resolving over ${loc}. Raw Navier-Stokes core produces ${nwp.raw.toFixed(1)} ${unit}. Applying ${nwp.bias >= 0 ? "+" : ""}${nwp.bias.toFixed(1)} ${unit} orographic bias correction.`
    : isTemp
      ? `Thermal boundary-layer advection over ${loc} indicates diurnal peak of ${nwp.raw.toFixed(1)} ${unit}. Calibrated to ${nwp.corrected.toFixed(1)} ${unit} with adiabatic correction.`
      : `Baroclinic pressure gradient across ${loc} drives surface gusts of ${nwp.raw.toFixed(1)} ${unit}. Corrected to ${nwp.corrected.toFixed(1)} ${unit} with boundary roughness factor.`;

  const blendAckPhysics = `Received Physics NWP payload (${nwp.corrected.toFixed(1)} ${unit}). Logged 30-day historical RMSE skill (${nwp.rmse.toFixed(1)} ${unit}). Standby for ensemble dispersion.`;

  const spreadVal = (isRain ? 4.2 : isTemp ? 0.9 : 5.8) * (selection.lead / 48);
  const ensembleText = isRain
    ? `51 perturbed members evaluated over ${loc}. Member distribution centers at ${ensemble.corrected.toFixed(1)} ${unit} (spread σ = ${spreadVal.toFixed(1)} ${unit}). 79% of ensemble members cross rain threshold.`
    : isTemp
      ? `51-member ensemble shows tight clustering (σ = ${spreadVal.toFixed(1)} ${unit}). 91% consensus around sustained ${ensemble.corrected.toFixed(1)} ${unit} peak temperature.`
      : `Ensemble tracks gale wind field at ${ensemble.corrected.toFixed(1)} ${unit} across ${loc}. Ensemble spread σ = ${spreadVal.toFixed(1)} ${unit} with high member alignment.`;

  const blendAckEnsemble = `Ensemble distribution registered (${ensemble.corrected.toFixed(1)} ${unit}). High member consistency scores positively in reliability matrix.`;

  const analogYear = isRain ? "July 2021" : isTemp ? "May 2019" : "October 2020";
  const aiText = isRain
    ? `Fourier neural operator matched ERA5 synoptic analog from ${analogYear}. Learned spatial precipitation pattern yields ${ai.corrected.toFixed(1)} ${unit} accumulation.`
    : isTemp
      ? `Deep weather analog matched to ${analogYear} heatwave synoptic signature. Non-linear pattern projection resolves ${ai.corrected.toFixed(1)} ${unit}.`
      : `Neural pattern matched to ${analogYear} coastal wind anomaly. Learned atmospheric dynamics output ${ai.corrected.toFixed(1)} ${unit}.`;

  const blendAckAi = `AI pattern analog (${ai.corrected.toFixed(1)} ${unit}) recorded. Evaluating skill matrix under '${selection.regime.replace("-", " ")}' regime.`;

  const wNwpPct = Math.round(weights.nwp * 100);
  const wEnsPct = Math.round(weights.ensemble * 100);
  const wAiPct = Math.round(weights.ai * 100);

  const blendSynthesis = `All active models reporting. Calculating Kalman weights: Physics ${wNwpPct}%, Ensemble ${wEnsPct}%, AI ${wAiPct}%. ${
    forecast.tailStrength > 0
      ? `Extreme threshold exceeded by ${forecast.agreement} models; activating bounded tail guard (+${(forecast.value - forecast.routine).toFixed(1)} ${unit}).`
      : "Standard adaptive consensus verified without runaway outliers."
  } Blended consensus guidance: ${forecast.value.toFixed(1)} ${unit}.`;

  const blendDispatch = `Transmitting finalized consensus guidance (${forecast.value.toFixed(1)} ${unit}, 80% range ${forecast.lower.toFixed(0)}–${forecast.upper.toFixed(0)} ${unit}) to Regional Operations.`;

  const outputPublish = `Official forecast locked for ${loc} (T+${selection.lead}h): ${forecast.value.toFixed(1)} ${unit}. Estimated exceedance probability ${(forecast.probability * 100).toFixed(0)}% above ${forecast.threshold} ${unit}. Guidance published.`;

  return {
    physicsDispatch: {
      text: physicsText,
      payload: `${nwp.corrected.toFixed(1)} ${unit}`,
      telemetry: {
        raw: `${nwp.raw.toFixed(1)} ${unit}`,
        bias: `${nwp.bias >= 0 ? "+" : ""}${nwp.bias.toFixed(1)} ${unit}`,
        rmse: `${nwp.rmse.toFixed(1)} ${unit}`,
        grid: "4km Core",
      },
    },
    blendAckPhysics: {
      text: blendAckPhysics,
      payload: "NWP ACK (1/3)",
    },
    ensembleDispatch: {
      text: ensembleText,
      payload: `${ensemble.corrected.toFixed(1)} ${unit}`,
      telemetry: {
        spread: `σ = ${spreadVal.toFixed(1)} ${unit}`,
        members: "51 / 51",
        agreement: isRain ? "79%" : "91%",
      },
    },
    blendAckEnsemble: {
      text: blendAckEnsemble,
      payload: "ENS ACK (2/3)",
    },
    aiDispatch: {
      text: aiText,
      payload: `${ai.corrected.toFixed(1)} ${unit}`,
      telemetry: {
        analog: analogYear,
        latency: "280 ms",
        correlation: "0.94",
      },
    },
    blendAckAi: {
      text: blendAckAi,
      payload: "AI ACK (3/3)",
    },
    blendSynthesis: {
      text: blendSynthesis,
      payload: `${wNwpPct}% / ${wEnsPct}% / ${wAiPct}%`,
      telemetry: {
        policy: "Softmax Kalman",
        weights: `${wNwpPct}% / ${wEnsPct}% / ${wAiPct}%`,
        tailGuard: forecast.tailStrength > 0 ? "Active" : "Normal",
      },
    },
    blendDispatch: {
      text: blendDispatch,
      payload: `${forecast.value.toFixed(1)} ${unit}`,
    },
    outputPublish: {
      text: outputPublish,
      payload: `${forecast.value.toFixed(1)} ${unit}`,
      telemetry: {
        value: `${forecast.value.toFixed(1)} ${unit}`,
        range: `${forecast.lower.toFixed(0)}–${forecast.upper.toFixed(0)} ${unit}`,
        confidence: forecast.confidence,
        risk: forecast.risk,
      },
    },
  };
}

export function createDialogueMessage(
  id: number,
  sender: AgentId | "system",
  recipient: AgentId | undefined,
  text: string,
  payload?: string,
  kind: AgentDialogueMessage["kind"] = "data",
): AgentDialogueMessage {
  const now = new Date();
  const timeStr = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}:${String(now.getSeconds()).padStart(2, "0")}`;
  const persona = getPersona(sender);

  return {
    id,
    timestamp: timeStr,
    sender,
    senderName: persona.name,
    senderRole: persona.role,
    recipient,
    text,
    payload,
    kind,
  };
}
