import { writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const CSV_PATH = path.join(ROOT, "data", "fcc-hi-summary.csv");
const META_PATH = path.join(ROOT, "data", "fcc-hi-summary.meta.json");

const STATE_URL =
  "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer/0/query?where=StateAbbr%3D%27HI%27&outFields=*&returnGeometry=false&f=json";
const COUNTY_URL =
  "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer/1/query?where=StateAbbr%3D%27HI%27&outFields=*&returnGeometry=false&f=json";
const LAYER_META_URL =
  "https://services8.arcgis.com/peDZJliSvYims39Q/arcgis/rest/services/FCC_Broadband_Data_Collection_December_2024_View/FeatureServer/1?f=json";
const ITEM_URL =
  "https://www.arcgis.com/sharing/rest/content/items/e1343efcefc344709057260ee57290a0?f=json";
const ITEM_ID = "e1343efcefc344709057260ee57290a0";

const UA = "bead-explorer/0.1 fetch-fcc";

const COLUMNS = [
  "GEOID",
  "Name",
  "TotalPop",
  "TotalBSLs",
  "ServedBSLs",
  "UnderservedBSLs",
  "UnservedBSLs",
  "UnservedBSLs_6monthPrevious",
  "UnderservedBSLs_6monthPrevious",
  "UnservedBSLs_12monthPrevious",
  "UnderservedBSLs_12monthPrevious",
] as const;

const EXPECTED_STATE = { TotalBSLs: 320467, ServedBSLs: 311685, UnderservedBSLs: 458, UnservedBSLs: 8324 };
const EXPECTED_COUNTIES: Record<string, { TotalBSLs: number; ServedBSLs: number; UnderservedBSLs: number; UnservedBSLs: number }> = {
  "Hawaii County": { TotalBSLs: 78440, ServedBSLs: 72017, UnderservedBSLs: 376, UnservedBSLs: 6047 },
  "Honolulu County": { TotalBSLs: 176263, ServedBSLs: 175423, UnderservedBSLs: 37, UnservedBSLs: 803 },
  "Kalawao County": { TotalBSLs: 182, ServedBSLs: 168, UnderservedBSLs: 0, UnservedBSLs: 14 },
  "Kauai County": { TotalBSLs: 22444, ServedBSLs: 21963, UnderservedBSLs: 3, UnservedBSLs: 478 },
  "Maui County": { TotalBSLs: 43138, ServedBSLs: 42114, UnderservedBSLs: 42, UnservedBSLs: 982 },
};

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function j(url: string): Promise<{ data: unknown; final_url: string }> {
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json,*/*" } });
  } catch (e) {
    die(`FAIL fetch error for ${url}: ${(e as Error).message}`);
  }
  if (res.status !== 200) die(`FAIL HTTP ${res.status} for ${url}`);
  const text = await res.text();
  try {
    return { data: JSON.parse(text) as unknown, final_url: res.url };
  } catch {
    die(`FAIL non-JSON response for ${url}`);
  }
}

type Feature = { attributes: Record<string, unknown> };
type QueryResp = { features?: Feature[]; error?: { message?: string } };

function assertFeatures(resp: unknown, url: string): Feature[] {
  const r = resp as QueryResp;
  if (r.error) die(`FAIL server error for ${url}: ${r.error.message ?? JSON.stringify(r.error)}`);
  if (!Array.isArray(r.features)) die(`FAIL no features[] in response for ${url}`);
  return r.features;
}

function toRow(attrs: Record<string, unknown>): Record<string, string> {
  const row: Record<string, string> = {};
  const name = (attrs["CountyName"] ?? attrs["StateName"] ?? attrs["Name"]) as unknown;
  for (const col of COLUMNS) {
    if (col === "Name") {
      row[col] = name === null || name === undefined ? "" : String(name);
      continue;
    }
    const v = attrs[col];
    row[col] = v === null || v === undefined ? "" : String(v);
  }
  return row;
}

function csvEscape(v: string): string {
  if (v.includes(",") || v.includes('"') || v.includes("\n")) return `"${v.replace(/"/g, '""')}"`;
  return v;
}

function num(row: Record<string, string>, col: string): number {
  const v = row[col];
  if (v === "" || v === undefined) die(`FAIL missing column ${col} in row ${JSON.stringify(row)}`);
  const n = Number(v);
  if (!Number.isFinite(n)) die(`FAIL non-numeric column ${col}=${v}`);
  return n;
}

async function main() {
  console.log("fetch-fcc v0.1.0");
  const stateResp = await j(STATE_URL);
  const stateFeatures = assertFeatures(stateResp.data, STATE_URL);
  const hiState = stateFeatures.find((f) => String(f.attributes["StateAbbr"]) === "HI");
  if (!hiState) die("FAIL: no HI feature in state layer");
  const stateRow = toRow(hiState.attributes);

  const countyResp = await j(COUNTY_URL);
  const countyFeatures = assertFeatures(countyResp.data, COUNTY_URL);
  const countyRows = countyFeatures.map((f) => toRow(f.attributes));

  const rows = [stateRow, ...countyRows].sort((a, b) => (a.GEOID || "").localeCompare(b.GEOID || ""));

  const problems: string[] = [];
  for (const r of rows) {
    const total = num(r, "TotalBSLs");
    const served = num(r, "ServedBSLs");
    const under = num(r, "UnderservedBSLs");
    const un = num(r, "UnservedBSLs");
    if (served + under + un !== total) {
      die(`FAIL row ${r.GEOID} (${r.Name}): Served(${served}) + Underserved(${under}) + Unserved(${un}) != Total(${total})`);
    }
  }

  const state = rows.find((r) => r.GEOID === "15") ?? rows[0];
  const counties = rows.filter((r) => r.GEOID !== state.GEOID);
  const countySum = counties.reduce(
    (acc, r) => ({
      TotalBSLs: acc.TotalBSLs + num(r, "TotalBSLs"),
      ServedBSLs: acc.ServedBSLs + num(r, "ServedBSLs"),
      UnderservedBSLs: acc.UnderservedBSLs + num(r, "UnderservedBSLs"),
      UnservedBSLs: acc.UnservedBSLs + num(r, "UnservedBSLs"),
    }),
    { TotalBSLs: 0, ServedBSLs: 0, UnderservedBSLs: 0, UnservedBSLs: 0 },
  );
  for (const col of ["TotalBSLs", "ServedBSLs", "UnderservedBSLs", "UnservedBSLs"] as const) {
    if (countySum[col] !== num(state, col)) {
      die(`FAIL county sum ${col}=${countySum[col]} does not match state ${col}=${num(state, col)}`);
    }
  }

  const stateActual = {
    TotalBSLs: num(state, "TotalBSLs"),
    ServedBSLs: num(state, "ServedBSLs"),
    UnderservedBSLs: num(state, "UnderservedBSLs"),
    UnservedBSLs: num(state, "UnservedBSLs"),
  };
  for (const col of ["TotalBSLs", "ServedBSLs", "UnderservedBSLs", "UnservedBSLs"] as const) {
    if (stateActual[col] !== EXPECTED_STATE[col]) {
      problems.push(`state ${col}: pulled ${stateActual[col]}, expected ${EXPECTED_STATE[col]}`);
    }
  }
  for (const r of counties) {
    const nm = r.Name;
    const exp = EXPECTED_COUNTIES[nm];
    if (!exp) {
      problems.push(`unexpected county in county layer: ${nm}`);
      continue;
    }
    for (const col of ["TotalBSLs", "ServedBSLs", "UnderservedBSLs", "UnservedBSLs"] as const) {
      const got = num(r, col);
      if (got !== exp[col]) problems.push(`county ${nm} ${col}: pulled ${got}, expected ${exp[col]}`);
    }
  }

  const headerLine = COLUMNS.join(",");
  const bodyLines = rows.map((r) => COLUMNS.map((c) => csvEscape(r[c] ?? "")).join(","));
  writeFileSync(CSV_PATH, headerLine + "\n" + bodyLines.join("\n") + "\n");

  const layerMeta = await j(LAYER_META_URL);
  const layerInfo = layerMeta.data as { editingInfo?: { lastEditDate?: number } };
  const lastEdit = layerInfo.editingInfo?.lastEditDate;
  const lastEditISO = typeof lastEdit === "number" ? new Date(lastEdit).toISOString() : null;

  const itemResp = await j(ITEM_URL);
  const item = itemResp.data as { description?: string; snippet?: string; title?: string };
  const desc = (item.description ?? "") + " " + (item.snippet ?? "");
  const vintageMatch = desc.match(/(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/);
  const vintage = vintageMatch ? vintageMatch[0] : null;

  const meta = {
    retrieved_at: new Date().toISOString(),
    queries: { state: STATE_URL, county: COUNTY_URL, layer_meta: LAYER_META_URL, item: ITEM_URL },
    item_id: ITEM_ID,
    layer_lastEditDate_ms: typeof lastEdit === "number" ? lastEdit : null,
    layer_lastEditDate_iso: lastEditISO,
    vintage_sentence: vintage,
    expected_vs_pulled_problems: problems,
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n");

  console.log(`wrote ${path.relative(ROOT, CSV_PATH)} (${rows.length} rows) and ${path.relative(ROOT, META_PATH)}`);
  console.log("");
  console.log("CSV:");
  console.log(headerLine);
  for (const line of bodyLines) console.log(line);
  console.log("");
  console.log(`layer lastEditDate: ${lastEditISO ?? "unknown"}`);
  console.log(`vintage extracted from item description: ${vintage ?? "(none)"}`);
  if (problems.length > 0) {
    console.log("");
    console.log("WARNING: pulled values differ from committed expectations:");
    for (const p of problems) console.log("  " + p);
  } else {
    console.log("pulled values match expected values.");
  }
}

main().catch((e) => die(`FAIL: ${e instanceof Error ? e.stack ?? e.message : String(e)}`));
