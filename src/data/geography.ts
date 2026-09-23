import { polygonContains } from "d3";
import type { FeatureCollection, Polygon } from "geojson";
import raw from "./india-outline.json";
import type { Cell } from "../types/forecast";
export const INDIA = raw as FeatureCollection<Polygon>;
const rings = INDIA.features.flatMap((f) => f.geometry.coordinates.slice(0, 1));
export const CELLS: Cell[] = [];
for (let lat = 6.5; lat < 37; lat++)
  for (let lon = 68.5; lon < 98; lon++) {
    if (rings.some((r) => polygonContains(r as [number, number][], [lon, lat])))
      CELLS.push({ id: `${lat}-${lon}`, lat, lon });
  }
export function nearestCell(lat: number, lon: number): Cell {
  return CELLS.reduce((a, b) =>
    Math.hypot(a.lat - lat, a.lon - lon) < Math.hypot(b.lat - lat, b.lon - lon)
      ? a
      : b,
  );
}
export const LOCATIONS = [
  { name: "Mumbai", region: "Konkan coast", lat: 19.07, lon: 72.87 },
  { name: "Guwahati", region: "Brahmaputra valley", lat: 26.14, lon: 91.74 },
  { name: "Mangaluru", region: "Western Ghats", lat: 12.91, lon: 74.86 },
  { name: "Kolkata", region: "Lower Gangetic plain", lat: 22.57, lon: 88.36 },
  { name: "Delhi", region: "Northwest plains", lat: 28.61, lon: 77.2 },
  { name: "Chennai", region: "Coromandel coast", lat: 13.08, lon: 80.27 },
].map((l) => ({ ...l, cell: nearestCell(l.lat, l.lon) }));
