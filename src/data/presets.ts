import type { Selection } from "../types/forecast";
import { LOCATIONS } from "./geography";
export const INITIAL: Selection = {
  cell: LOCATIONS[0].cell,
  location: "Mumbai",
  variable: "rainfall",
  lead: 48,
  date: "2026-07-18",
  regime: "active-monsoon",
  temperature: 0.7,
  unavailable: [],
};
export const PRESETS: {
  id: string;
  label: string;
  description: string;
  selection: Selection;
}[] = [
  {
    id: "konkan",
    label: "Konkan cloudburst",
    description: "Heavy rainfall / 48 h",
    selection: INITIAL,
  },
  {
    id: "northeast",
    label: "Northeast convergence",
    description: "Monsoon onset / 72 h",
    selection: {
      ...INITIAL,
      cell: LOCATIONS[1].cell,
      location: "Guwahati",
      lead: 72,
      regime: "monsoon-onset",
    },
  },
  {
    id: "bay",
    label: "Bay low-pressure system",
    description: "Rainfall / 96 h",
    selection: {
      ...INITIAL,
      cell: LOCATIONS[3].cell,
      location: "Kolkata",
      lead: 96,
      regime: "low-pressure-system",
    },
  },
  {
    id: "day6",
    label: "Day-6 uncertainty",
    description: "Delayed AI input / 144 h",
    selection: { ...INITIAL, lead: 144, unavailable: ["ai"] },
  },
  {
    id: "heat",
    label: "Northwest heat dome",
    description: "Temperature / 48 h",
    selection: {
      ...INITIAL,
      cell: LOCATIONS[4].cell,
      location: "Delhi",
      variable: "temperature",
      date: "2026-05-22",
      regime: "heat-dome",
    },
  },
  {
    id: "wind",
    label: "Coastal high wind",
    description: "Wind speed / 72 h",
    selection: {
      ...INITIAL,
      cell: LOCATIONS[5].cell,
      location: "Chennai",
      variable: "wind",
      lead: 72,
      regime: "low-pressure-system",
    },
  },
];
