import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, statSync, writeFileSync } from "node:fs";
import path from "node:path";

const ROOT = path.resolve(process.cwd());
const RAW_DIR = path.join(ROOT, "data", "raw");
const RAW_PATH = path.join(RAW_DIR, "hi-counties-tigerweb.geojson");
const OUT_PATH = path.join(ROOT, "data", "hi-counties.geojson");
const META_PATH = path.join(ROOT, "data", "hi-counties.meta.json");

const SOURCE_URL =
  "https://tigerweb.geo.census.gov/arcgis/rest/services/Generalized_ACS2023/State_County/MapServer/11/query?where=STATE%3D%2715%27&outFields=GEOID,STATE,COUNTY,NAME,BASENAME,AREALAND,AREAWATER&outSR=4326&f=geojson";
const UA = "bead-explorer/0.1 fetch-geo";

const EXPECTED_GEOIDS = ["15001", "15003", "15005", "15007", "15009"] as const;
const NWHI_LON_CUTOFF = -160.6;
const MAX_BYTES = 150_000;

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];
type MultiPolygon = Polygon[];

type Feature = {
  type: "Feature";
  properties: Record<string, unknown> | null;
  geometry:
    | { type: "Polygon"; coordinates: Polygon }
    | { type: "MultiPolygon"; coordinates: MultiPolygon }
    | null;
};

type FC = { type: "FeatureCollection"; features: Feature[] };

function die(msg: string): never {
  console.error(msg);
  process.exit(1);
}

async function download(url: string, destination: string): Promise<Buffer> {
  console.log(`downloading ${url}`);
  let res: Response;
  try {
    res = await fetch(url, { headers: { "user-agent": UA, accept: "application/json,*/*" } });
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

function roundPoint(p: Point): Point {
  return [Math.round(p[0] * 1e5) / 1e5, Math.round(p[1] * 1e5) / 1e5];
}

function filterRings(rings: Polygon, drop: (ring: Ring) => boolean): Polygon {
  return rings.filter((ring) => !drop(ring)).map((ring) => ring.map(roundPoint));
}

function ringAllWestOfCutoff(ring: Ring, cutoff: number): boolean {
  for (const p of ring) {
    if (p[0] >= cutoff) return false;
  }
  return true;
}

async function main() {
  console.log("fetch-geo v0.1.0");

  let buf: Buffer;
  if (existsSync(RAW_PATH)) {
    console.log(`using cached ${path.relative(ROOT, RAW_PATH)}`);
    buf = readFileSync(RAW_PATH);
  } else {
    buf = await download(SOURCE_URL, RAW_PATH);
  }

  const rawSha = sha256(buf);
  const rawBytes = buf.length;
  console.log(`raw bytes=${rawBytes} sha256=${rawSha}`);

  let parsed: FC;
  try {
    parsed = JSON.parse(buf.toString("utf8")) as FC;
  } catch (e) {
    die(`FAIL raw is not JSON: ${(e as Error).message}`);
  }
  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    die("FAIL raw is not a GeoJSON FeatureCollection");
  }

  if (parsed.features.length !== 5) {
    die(`FAIL raw feature count ${parsed.features.length} != 5`);
  }
  const geoids = parsed.features
    .map((f) => String(f.properties?.["GEOID"] ?? ""))
    .sort();
  const expected = [...EXPECTED_GEOIDS].sort();
  if (geoids.join(",") !== expected.join(",")) {
    die(`FAIL raw GEOIDs [${geoids.join(",")}] != [${expected.join(",")}]`);
  }

  const outFeatures: Feature[] = [];
  const droppedByCounty: Record<string, number> = {};
  for (const f of parsed.features) {
    const geoid = String(f.properties?.["GEOID"] ?? "");
    const name = String(f.properties?.["NAME"] ?? f.properties?.["BASENAME"] ?? "");
    if (!f.geometry) die(`FAIL feature ${geoid} has null geometry`);

    let rings: MultiPolygon;
    if (f.geometry.type === "Polygon") {
      rings = [f.geometry.coordinates];
    } else if (f.geometry.type === "MultiPolygon") {
      rings = f.geometry.coordinates;
    } else {
      die(`FAIL feature ${geoid} has unsupported geometry type`);
    }

    const isHonolulu = geoid === "15003";
    let droppedRings = 0;
    const outPolys: Polygon[] = [];
    for (const poly of rings) {
      const kept = filterRings(poly, (ring) => {
        if (!isHonolulu) return false;
        const drop = ringAllWestOfCutoff(ring, NWHI_LON_CUTOFF);
        if (drop) droppedRings += 1;
        return drop;
      });
      if (kept.length > 0) outPolys.push(kept);
    }
    droppedByCounty[geoid] = droppedRings;

    let geometry: Feature["geometry"];
    if (outPolys.length === 0) {
      die(`FAIL feature ${geoid} lost all rings after NWHI filter`);
    } else if (outPolys.length === 1) {
      geometry = { type: "Polygon", coordinates: outPolys[0] };
    } else {
      geometry = { type: "MultiPolygon", coordinates: outPolys };
    }

    outFeatures.push({
      type: "Feature",
      properties: { GEOID: geoid, NAME: name },
      geometry,
    });
  }

  const outFC: FC = { type: "FeatureCollection", features: outFeatures };
  const outText = JSON.stringify(outFC) + "\n";
  writeFileSync(OUT_PATH, outText);
  const outBytes = statSync(OUT_PATH).size;
  const outSha = sha256(Buffer.from(outText));

  if (outFeatures.length !== 5) die(`FAIL output feature count ${outFeatures.length} != 5`);
  const outGeoids = outFeatures.map((f) => String(f.properties?.["GEOID"] ?? "")).sort();
  if (outGeoids.join(",") !== expected.join(",")) {
    die(`FAIL output GEOIDs [${outGeoids.join(",")}] != [${expected.join(",")}]`);
  }
  if (outBytes > MAX_BYTES) {
    die(`FAIL output size ${outBytes} bytes exceeds ${MAX_BYTES}`);
  }

  const meta = {
    source_url: SOURCE_URL,
    raw_path: path.relative(ROOT, RAW_PATH),
    raw_sha256: rawSha,
    raw_bytes: rawBytes,
    output_path: path.relative(ROOT, OUT_PATH),
    output_sha256: outSha,
    output_bytes: outBytes,
    fetched_at: new Date().toISOString(),
    feature_count: outFeatures.length,
    geoids: outGeoids,
    filter_rule: `drop every ring of Honolulu County (GEOID 15003) whose vertices all lie west of longitude ${NWHI_LON_CUTOFF} to omit the Northwestern Hawaiian Islands`,
    coordinate_precision_decimals: 5,
    properties_kept: ["GEOID", "NAME"],
    dropped_rings_by_geoid: droppedByCounty,
  };
  writeFileSync(META_PATH, JSON.stringify(meta, null, 2) + "\n");

  console.log(`wrote ${path.relative(ROOT, OUT_PATH)} (${outBytes} bytes) and ${path.relative(ROOT, META_PATH)}`);
  console.log(`feature count: ${outFeatures.length}; GEOIDs: [${outGeoids.join(",")}]`);
  console.log(`NWHI rings dropped: ${JSON.stringify(droppedByCounty)}`);
}

main().catch((e) => die(`FAIL: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`));
