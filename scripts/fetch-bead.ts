import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import * as XLSX from "xlsx";

const ROOT = path.resolve(process.cwd());
const RAW_DIR = path.join(ROOT, "data", "raw");
const RAW_PATH = path.join(RAW_DIR, "fp_locations_approved.xlsx");
const CSV_PATH = path.join(ROOT, "data", "bead-hi-project-areas.csv");
const META_PATH = path.join(ROOT, "data", "bead-hi-project-areas.meta.json");

const SOURCE_URL =
  "https://www.hawaii.edu/broadband/wp-content/uploads/sites/40/2026/01/fp_locations_approved.xlsx";
const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/125 Safari/537.36 bead-explorer/0.1 fetch-bead";

const EXPECTED_ROW_COUNT = 7_009;
const EXPECTED_UNSERVED = 6_632;
const EXPECTED_UNDERSERVED = 377;

const PROJECT_COUNTY: Record<string, string> = {
  HAWAII: "Hawaii",
  HONOLULU: "Honolulu",
  KAUAI: "Kauai",
  MAUI: "Maui",
};

const CLASSIFICATION_LABEL: Record<number, "unserved" | "underserved"> = {
  0: "unserved",
  1: "underserved",
};

const TECHNOLOGY_LABEL: Record<number, "fiber" | "leo"> = {
  50: "fiber",
  61: "leo",
};

const EXPECTED_COUNTY_ROWS: Record<string, { unserved: number; underserved: number; total: number; fiber: number; leo: number }> = {
  Hawaii: { unserved: 5012, underserved: 196, total: 5208, fiber: 4146, leo: 1062 },
  Honolulu: { unserved: 877, underserved: 20, total: 897, fiber: 881, leo: 16 },
  Kauai: { unserved: 141, underserved: 4, total: 145, fiber: 68, leo: 77 },
  Maui: { unserved: 602, underserved: 157, total: 759, fiber: 629, leo: 130 },
};

const COUNTY_ORDER = ["Hawaii", "Honolulu", "Kauai", "Maui"];

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function download(url: string, destination: string): Promise<Buffer> {
  console.log(`downloading ${url}`);
  let res: Response;
  try {
    res = await fetch(url, {
      headers: { "user-agent": UA, accept: "*/*" },
    });
  } catch (e) {
    die(`FAIL fetch error for ${url}: ${(e as Error).message}`);
  }
  if (res.status !== 200) die(`FAIL HTTP ${res.status} for ${url}`);
  const buf = Buffer.from(await res.arrayBuffer());
  mkdirSync(path.dirname(destination), { recursive: true });
  writeFileSync(destination, buf);
  return buf;
}

function sha256(buf: Buffer): string {
  return createHash("sha256").update(buf).digest("hex");
}

function countyFromProjectId(projectId: string): string {
  const parts = projectId.split("-");
  const suffix = (parts[parts.length - 1] ?? "").toUpperCase();
  const county = PROJECT_COUNTY[suffix];
  if (!county) die(`FAIL unknown project_id suffix ${JSON.stringify(suffix)} (project_id ${JSON.stringify(projectId)})`);
  return county;
}

type Row = {
  location_id: string;
  project_id: string;
  classification: number;
  technology: number;
  upload_speed_anticipated: number;
  download_speed_anticipated: number;
  low_latency: string | number | boolean;
};

function readRows(buf: Buffer): Row[] {
  const wb = XLSX.read(buf, { type: "buffer" });
  const sheetName = wb.SheetNames[0];
  if (!sheetName) die("FAIL workbook has no sheets");
  const sheet = wb.Sheets[sheetName];
  const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: null });
  if (raw.length === 0) die(`FAIL sheet ${sheetName} has zero rows`);
  const required = [
    "location_id",
    "project_id",
    "classification",
    "technology",
    "upload_speed_anticipated",
    "download_speed_anticipated",
    "low_latency",
  ];
  const first = raw[0] ?? {};
  for (const col of required) {
    if (!(col in first)) die(`FAIL required column ${col} not present in workbook headers: [${Object.keys(first).join(", ")}]`);
  }
  const rows: Row[] = [];
  for (const r of raw) {
    const classification = Number(r["classification"]);
    const technology = Number(r["technology"]);
    if (!Number.isFinite(classification)) die(`FAIL non-numeric classification in row ${JSON.stringify(r)}`);
    if (!Number.isFinite(technology)) die(`FAIL non-numeric technology in row ${JSON.stringify(r)}`);
    rows.push({
      location_id: String(r["location_id"] ?? ""),
      project_id: String(r["project_id"] ?? ""),
      classification,
      technology,
      upload_speed_anticipated: Number(r["upload_speed_anticipated"] ?? 0),
      download_speed_anticipated: Number(r["download_speed_anticipated"] ?? 0),
      low_latency: (r["low_latency"] as string | number | boolean | null) ?? "",
    });
  }
  return rows;
}

type Agg = { unserved: number; underserved: number; total: number; fiber: number; leo: number };

function emptyAgg(): Agg {
  return { unserved: 0, underserved: 0, total: 0, fiber: 0, leo: 0 };
}

async function main() {
  console.log("fetch-bead v0.1.0");

  let buf: Buffer;
  if (existsSync(RAW_PATH)) {
    console.log(`using cached ${path.relative(ROOT, RAW_PATH)}`);
    buf = readFileSync(RAW_PATH);
  } else {
    buf = await download(SOURCE_URL, RAW_PATH);
  }

  const rowCount = buf.length;
  const rawSha = sha256(buf);
  console.log(`raw bytes=${rowCount} sha256=${rawSha}`);

  const rows = readRows(buf);
  if (rows.length !== EXPECTED_ROW_COUNT) {
    die(`FAIL row count ${rows.length} != ${EXPECTED_ROW_COUNT}`);
  }

  const classificationSeen = new Set<number>();
  const technologySeen = new Set<number>();
  for (const r of rows) {
    classificationSeen.add(r.classification);
    technologySeen.add(r.technology);
  }
  for (const v of classificationSeen) {
    if (!(v in CLASSIFICATION_LABEL)) die(`FAIL unexpected classification value ${v}`);
  }
  for (const v of technologySeen) {
    if (!(v in TECHNOLOGY_LABEL)) die(`FAIL unexpected technology value ${v}`);
  }

  const perCounty: Record<string, Agg> = {};
  for (const c of COUNTY_ORDER) perCounty[c] = emptyAgg();

  for (const r of rows) {
    const county = countyFromProjectId(r.project_id);
    const agg = perCounty[county];
    if (!agg) die(`FAIL project maps to unknown county ${county}`);
    const cls = CLASSIFICATION_LABEL[r.classification];
    const tech = TECHNOLOGY_LABEL[r.technology];
    agg[cls] += 1;
    agg[tech] += 1;
    agg.total += 1;
  }

  let totalRows = 0;
  let totalUnserved = 0;
  let totalUnderserved = 0;
  for (const c of COUNTY_ORDER) {
    const a = perCounty[c];
    totalRows += a.total;
    totalUnserved += a.unserved;
    totalUnderserved += a.underserved;
    if (a.unserved + a.underserved !== a.total) {
      die(`FAIL ${c}: unserved(${a.unserved}) + underserved(${a.underserved}) != total(${a.total})`);
    }
    if (a.fiber + a.leo !== a.total) {
      die(`FAIL ${c}: fiber(${a.fiber}) + leo(${a.leo}) != total(${a.total})`);
    }
  }
  if (totalRows !== EXPECTED_ROW_COUNT) {
    die(`FAIL county totals sum to ${totalRows} not ${EXPECTED_ROW_COUNT}`);
  }
  if (totalUnserved !== EXPECTED_UNSERVED) {
    die(`FAIL totals unserved ${totalUnserved} != ${EXPECTED_UNSERVED}`);
  }
  if (totalUnderserved !== EXPECTED_UNDERSERVED) {
    die(`FAIL totals underserved ${totalUnderserved} != ${EXPECTED_UNDERSERVED}`);
  }

  const problems: string[] = [];
  for (const c of COUNTY_ORDER) {
    const got = perCounty[c];
    const want = EXPECTED_COUNTY_ROWS[c];
    for (const col of ["unserved", "underserved", "total", "fiber", "leo"] as const) {
      if (got[col] !== want[col]) {
        problems.push(`county ${c} ${col}: parsed ${got[col]}, expected ${want[col]}`);
      }
    }
  }
  if (problems.length > 0) {
    console.error("parsed values differ from committed expectations:");
    for (const p of problems) console.error("  " + p);
    console.error("");
    console.error("expected:");
    for (const c of COUNTY_ORDER) {
      const w = EXPECTED_COUNTY_ROWS[c];
      console.error(`  ${c}: unserved=${w.unserved} underserved=${w.underserved} total=${w.total} fiber=${w.fiber} leo=${w.leo}`);
    }
    console.error("parsed:");
    for (const c of COUNTY_ORDER) {
      const g = perCounty[c];
      console.error(`  ${c}: unserved=${g.unserved} underserved=${g.underserved} total=${g.total} fiber=${g.fiber} leo=${g.leo}`);
    }
    die("FAIL parsed county rows disagree with the gates; refusing to write CSV");
  }

  const header = "county,unserved,underserved,total,fiber,leo";
  const bodyLines = COUNTY_ORDER.map((c) => {
    const a = perCounty[c];
    return `${c},${a.unserved},${a.underserved},${a.total},${a.fiber},${a.leo}`;
  });
  writeFileSync(CSV_PATH, header + "\n" + bodyLines.join("\n") + "\n");

  const meta = {
    source_url: SOURCE_URL,
    raw_path: path.relative(ROOT, RAW_PATH),
    sha256: rawSha,
    bytes: rowCount,
    fetched_at: new Date().toISOString(),
    row_count: rows.length,
    classification_map: { "0": "unserved", "1": "underserved" },
    technology_map: { "50": "fiber", "61": "leo" },
    project_id_suffix_to_county: PROJECT_COUNTY,
    counties: Object.fromEntries(COUNTY_ORDER.map((c) => [c, perCounty[c]])),
    note:
      "Counts approved-funded locations in NTIA-approved BEAD Final Proposal project areas. Kalawao County is not a separate project area; its BSLs fall under Maui project areas.",
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n");

  console.log("");
  console.log("CSV:");
  console.log(header);
  for (const line of bodyLines) console.log(line);
  console.log("");
  console.log(`wrote ${path.relative(ROOT, CSV_PATH)} and ${path.relative(ROOT, META_PATH)}`);
  console.log("parsed county rows match committed expectations.");
}

main().catch((e) => die(`FAIL: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`));
