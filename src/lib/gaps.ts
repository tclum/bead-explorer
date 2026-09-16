import { readFileSync } from "node:fs";
import path from "node:path";

export const FCC_CSV_PATH = "data/fcc-hi-summary.csv";
export const FCC_META_PATH = "data/fcc-hi-summary.meta.json";
export const BEAD_CSV_PATH = "data/bead-hi-project-areas.csv";
export const BEAD_META_PATH = "data/bead-hi-project-areas.meta.json";
export const GEOJSON_PATH = "data/hi-counties.geojson";
export const GEOJSON_META_PATH = "data/hi-counties.meta.json";

export const COUNTY_ORDER_GEOID = ["15001", "15003", "15005", "15007", "15009"] as const;
export const STATE_GEOID = "15";

// Display labels use the Hawaiian ʻokina where appropriate; the CSVs
// keep plain ASCII so the raw files stay ASCII-clean.
export const COUNTY_DISPLAY: Record<string, string> = {
  "15001": "Hawaiʻi",
  "15003": "Honolulu",
  "15005": "Kalawao",
  "15007": "Kauaʻi",
  "15009": "Maui",
  "15": "Hawaiʻi (statewide)",
};

// The BEAD CSV keys by plain county name; Kalawao is not a BEAD project area.
export const GEOID_TO_BEAD_COUNTY: Record<string, string | null> = {
  "15001": "Hawaii",
  "15003": "Honolulu",
  "15005": null,
  "15007": "Kauai",
  "15009": "Maui",
};

export type FccRow = {
  geoid: string;
  name: string;
  total: number;
  served: number;
  underserved: number;
  unserved: number;
};

export type BeadRow = {
  county: string;
  unserved: number;
  underserved: number;
  total: number;
  fiber: number;
  leo: number;
};

function readRelative(relPath: string): string {
  return readFileSync(path.join(process.cwd(), relPath), "utf8");
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(",");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = cells[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function num(row: Record<string, string>, col: string): number {
  const v = row[col];
  const n = Number(v);
  if (!Number.isFinite(n)) throw new Error(`gaps: non-numeric ${col} in ${JSON.stringify(row)}`);
  return n;
}

export function loadFcc(): { state: FccRow; counties: FccRow[]; raw: Record<string, string>[] } {
  const rows = parseCsv(readRelative(FCC_CSV_PATH));
  const toRow = (r: Record<string, string>): FccRow => ({
    geoid: r["GEOID"] ?? "",
    name: r["Name"] ?? "",
    total: num(r, "TotalBSLs"),
    served: num(r, "ServedBSLs"),
    underserved: num(r, "UnderservedBSLs"),
    unserved: num(r, "UnservedBSLs"),
  });
  const parsed = rows.map(toRow);
  const state = parsed.find((r) => r.geoid === STATE_GEOID);
  if (!state) throw new Error("gaps: FCC CSV missing state row (GEOID 15)");
  const counties = COUNTY_ORDER_GEOID.map((geoid) => {
    const hit = parsed.find((r) => r.geoid === geoid);
    if (!hit) throw new Error(`gaps: FCC CSV missing county row ${geoid}`);
    return hit;
  });
  return { state, counties, raw: rows };
}

export function loadBead(): { rows: BeadRow[]; totals: BeadRow; byCounty: Record<string, BeadRow> } {
  const rows = parseCsv(readRelative(BEAD_CSV_PATH));
  const parsed: BeadRow[] = rows.map((r) => ({
    county: r["county"] ?? "",
    unserved: num(r, "unserved"),
    underserved: num(r, "underserved"),
    total: num(r, "total"),
    fiber: num(r, "fiber"),
    leo: num(r, "leo"),
  }));
  const byCounty: Record<string, BeadRow> = {};
  for (const r of parsed) byCounty[r.county] = r;
  const totals: BeadRow = {
    county: "Hawaii (statewide)",
    unserved: parsed.reduce((s, r) => s + r.unserved, 0),
    underserved: parsed.reduce((s, r) => s + r.underserved, 0),
    total: parsed.reduce((s, r) => s + r.total, 0),
    fiber: parsed.reduce((s, r) => s + r.fiber, 0),
    leo: parsed.reduce((s, r) => s + r.leo, 0),
  };
  return { rows: parsed, totals, byCounty };
}

export type CountyFeature = {
  type: "Feature";
  properties: { GEOID: string; NAME: string };
  geometry:
    | { type: "Polygon"; coordinates: [number, number][][] }
    | { type: "MultiPolygon"; coordinates: [number, number][][][] };
};

export type CountyFeatureCollection = {
  type: "FeatureCollection";
  features: CountyFeature[];
};

export function loadCountyGeo(): CountyFeatureCollection {
  return JSON.parse(readRelative(GEOJSON_PATH)) as CountyFeatureCollection;
}

export type FccMeta = {
  retrieved_at: string;
  queries: { state: string; county: string; layer_meta: string; item: string };
  item_id: string;
  vintage_sentence: string | null;
};

export type BeadMeta = {
  source_url: string;
  sha256: string;
  bytes: number;
  fetched_at: string;
  row_count: number;
  note: string;
};

export type GeoMeta = {
  source_url: string;
  raw_sha256: string;
  output_sha256: string;
  fetched_at: string;
  feature_count: number;
};

export function loadFccMeta(): FccMeta {
  return JSON.parse(readRelative(FCC_META_PATH)) as FccMeta;
}
export function loadBeadMeta(): BeadMeta {
  return JSON.parse(readRelative(BEAD_META_PATH)) as BeadMeta;
}
export function loadGeoMeta(): GeoMeta {
  return JSON.parse(readRelative(GEOJSON_META_PATH)) as GeoMeta;
}
