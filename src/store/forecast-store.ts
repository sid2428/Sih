import { create } from "zustand";
import { INITIAL } from "../data/presets";
import type { ForecastRecord, Selection } from "../types/forecast";
export type View = "overview" | "explorer" | "risk" | "data";
interface Store {
  selection: Selection;
  view: View;
  records: ForecastRecord[];
  fileName: string;
  preset: string;
  setSelection: (patch: Partial<Selection>) => void;
  setView: (view: View) => void;
  applyPreset: (selection: Selection, id: string) => void;
  setRecords: (records: ForecastRecord[], name: string) => void;
  reset: () => void;
}
export const useForecastStore = create<Store>((set) => ({
  selection: INITIAL,
  view: "overview",
  records: [],
  fileName: "",
  preset: "konkan",
  setSelection: (patch) =>
    set((s) => ({
      selection: { ...s.selection, ...patch },
      preset: "",
    })),
  setView: (view) => set({ view }),
  applyPreset: (selection, preset) =>
    set({
      selection,
      preset,
      records: [],
      fileName: "",
    }),
  setRecords: (records, fileName) =>
    set((s) => {
      const r = records.reduce((a, b) =>
        Date.parse(a.timestamp) > Date.parse(b.timestamp) ? a : b,
      );
      return {
        records,
        fileName,
        preset: "",
        selection: {
          ...s.selection,
          cell: { id: `${r.lat}-${r.lon}`, lat: r.lat, lon: r.lon },
          location: "Imported location",
          variable: r.variable,
          lead: r.lead_time,
          date: r.timestamp.slice(0, 10),
          unavailable: [],
        },
      };
    }),
  reset: () =>
    set({
      selection: INITIAL,
      records: [],
      fileName: "",
      preset: "konkan",
    }),
}));
