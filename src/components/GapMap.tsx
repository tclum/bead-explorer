import {
  loadCountyGeo,
  loadFcc,
  COUNTY_DISPLAY,
  type CountyFeature,
  type FccRow,
} from "@/lib/gaps";
import { formatCount } from "@/lib/format";

const VIEW_W = 800;
const VIEW_H = 500;
const PAD_X = 44;
const PAD_Y = 34;

type LegendStop = { max: number; label: string; fill: string };

// Sequential single-hue amber scale, dark → bright, legible on the
// zinc-950 page background. Steps are share-of-BSLs cutoffs.
const LEGEND: LegendStop[] = [
  { max: 0.01, label: "< 1%", fill: "#78350f" },
  { max: 0.02, label: "1–2%", fill: "#b45309" },
  { max: 0.04, label: "2–4%", fill: "#d97706" },
  { max: 0.06, label: "4–6%", fill: "#f59e0b" },
  { max: Number.POSITIVE_INFINITY, label: "≥ 6%", fill: "#fbbf24" },
];

function bucketFor(share: number): LegendStop {
  for (const stop of LEGEND) {
    if (share < stop.max) return stop;
  }
  return LEGEND[LEGEND.length - 1];
}

type Point = [number, number];
type Ring = Point[];
type Polygon = Ring[];

function polygons(feature: CountyFeature): Polygon[] {
  return feature.geometry.type === "Polygon"
    ? [feature.geometry.coordinates as Polygon]
    : (feature.geometry.coordinates as Polygon[]);
}

function bbox(features: CountyFeature[]): { minLon: number; maxLon: number; minLat: number; maxLat: number } {
  let minLon = Infinity;
  let maxLon = -Infinity;
  let minLat = Infinity;
  let maxLat = -Infinity;
  for (const f of features) {
    for (const poly of polygons(f)) {
      for (const ring of poly) {
        for (const [lon, lat] of ring) {
          if (lon < minLon) minLon = lon;
          if (lon > maxLon) maxLon = lon;
          if (lat < minLat) minLat = lat;
          if (lat > maxLat) maxLat = lat;
        }
      }
    }
  }
  return { minLon, maxLon, minLat, maxLat };
}

function ringCentroid(ring: Ring): { x: number; y: number; area: number } {
  let a = 0;
  let cx = 0;
  let cy = 0;
  for (let i = 0, j = ring.length - 1; i < ring.length; j = i, i += 1) {
    const [xi, yi] = ring[i];
    const [xj, yj] = ring[j];
    const cross = xj * yi - xi * yj;
    a += cross;
    cx += (xi + xj) * cross;
    cy += (yi + yj) * cross;
  }
  a *= 0.5;
  if (a === 0) return { x: ring[0][0], y: ring[0][1], area: 0 };
  return { x: cx / (6 * a), y: cy / (6 * a), area: Math.abs(a) };
}

function largestRing(feature: CountyFeature): { ring: Ring; centroidLon: number; centroidLat: number } {
  let best: { ring: Ring; centroid: ReturnType<typeof ringCentroid> } | null = null;
  for (const poly of polygons(feature)) {
    const outer = poly[0];
    if (!outer) continue;
    const c = ringCentroid(outer);
    if (best === null || c.area > best.centroid.area) {
      best = { ring: outer, centroid: c };
    }
  }
  if (!best) throw new Error(`GapMap: feature ${feature.properties.GEOID} has no rings`);
  return { ring: best.ring, centroidLon: best.centroid.x, centroidLat: best.centroid.y };
}

export default function GapMap() {
  const fc = loadCountyGeo();
  const fcc = loadFcc();
  const byGeoid: Record<string, FccRow> = {};
  for (const c of fcc.counties) byGeoid[c.geoid] = c;

  const { minLon, maxLon, minLat, maxLat } = bbox(fc.features);
  const meanLat = (minLat + maxLat) / 2;
  const lonScale = Math.cos((meanLat * Math.PI) / 180);
  const xSpanDeg = (maxLon - minLon) * lonScale;
  const ySpanDeg = maxLat - minLat;
  const availW = VIEW_W - 2 * PAD_X;
  const availH = VIEW_H - 2 * PAD_Y;
  const scale = Math.min(availW / xSpanDeg, availH / ySpanDeg);
  const drawW = xSpanDeg * scale;
  const drawH = ySpanDeg * scale;
  const xOffset = PAD_X + (availW - drawW) / 2;
  const yOffset = PAD_Y + (availH - drawH) / 2;

  const project = (lon: number, lat: number): Point => [
    xOffset + (lon - minLon) * lonScale * scale,
    yOffset + (maxLat - lat) * scale,
  ];

  function pathFor(feature: CountyFeature): string {
    const parts: string[] = [];
    for (const poly of polygons(feature)) {
      for (const ring of poly) {
        if (ring.length === 0) continue;
        let d = "";
        for (let i = 0; i < ring.length; i += 1) {
          const [x, y] = project(ring[i][0], ring[i][1]);
          d += (i === 0 ? "M" : "L") + x.toFixed(1) + "," + y.toFixed(1);
        }
        d += "Z";
        parts.push(d);
      }
    }
    return parts.join(" ");
  }

  const ordered = [...fc.features].sort((a, b) => a.properties.GEOID.localeCompare(b.properties.GEOID));
  const rendered = ordered.map((feature) => {
    const geoid = feature.properties.GEOID;
    const row = byGeoid[geoid];
    if (!row) throw new Error(`GapMap: no FCC row for ${geoid}`);
    const share = row.total === 0 ? 0 : row.unserved / row.total;
    const stop = bucketFor(share);
    const label = COUNTY_DISPLAY[geoid] ?? row.name;
    const { centroidLon, centroidLat } = largestRing(feature);
    const [cx, cy] = project(centroidLon, centroidLat);
    return { geoid, feature, row, stop, label, share, cx, cy };
  });

  // Kalawao (15005) is tiny; offset its label so it doesn't overlap
  // its polygon or fall off the map.
  const KALAWAO_OFFSET = { dx: 40, dy: -34 };

  const legendX = 40;
  const legendY = VIEW_H - 96;
  const legendSwatchW = 28;
  const legendSwatchH = 14;
  const legendGapY = 18;

  const ariaLabel = `Choropleth map of Hawaiʻi's five counties shaded by the FCC BDC unserved share. Values (unserved locations / total broadband serviceable locations): ${rendered
    .map((r) => `${r.label} ${(r.share * 100).toFixed(1)}%`)
    .join(", ")}. See the table for exact counts.`;

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/60 p-4">
      <svg
        xmlns="http://www.w3.org/2000/svg"
        viewBox={`0 0 ${VIEW_W} ${VIEW_H}`}
        role="img"
        aria-label={ariaLabel}
        className="h-auto w-full"
      >
        <title>Hawaiʻi counties shaded by FCC BDC unserved share</title>
        <rect x="0" y="0" width={VIEW_W} height={VIEW_H} fill="#09090b" />
        {rendered.map((r) => (
          <path
            key={r.geoid}
            d={pathFor(r.feature)}
            fill={r.stop.fill}
            stroke="#27272a"
            strokeWidth={0.75}
            strokeLinejoin="round"
          />
        ))}
        {rendered.map((r) => {
          const isKalawao = r.geoid === "15005";
          const tx = isKalawao ? r.cx + KALAWAO_OFFSET.dx : r.cx;
          const ty = isKalawao ? r.cy + KALAWAO_OFFSET.dy : r.cy;
          return (
            <g key={`label-${r.geoid}`}>
              {isKalawao ? (
                <line
                  x1={r.cx}
                  y1={r.cy}
                  x2={tx - 6}
                  y2={ty + 4}
                  stroke="#fafafa"
                  strokeWidth={0.75}
                />
              ) : null}
              <text
                x={tx}
                y={ty}
                textAnchor={isKalawao ? "start" : "middle"}
                style={{
                  paintOrder: "stroke",
                  stroke: "#0a0a0a",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                }}
                fill="#fafafa"
                fontSize={14}
                fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
                fontWeight={600}
              >
                {r.label}
              </text>
              <text
                x={tx}
                y={ty + 15}
                textAnchor={isKalawao ? "start" : "middle"}
                style={{
                  paintOrder: "stroke",
                  stroke: "#0a0a0a",
                  strokeWidth: 3,
                  strokeLinejoin: "round",
                }}
                fill="#e4e4e7"
                fontSize={12}
                fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
              >
                {formatCount(r.row.unserved)} unserved
              </text>
            </g>
          );
        })}
        <g>
          <text
            x={legendX}
            y={legendY - 8}
            fill="#a1a1aa"
            fontSize={11}
            fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
          >
            FCC unserved share (of BSLs)
          </text>
          {LEGEND.map((stop, i) => {
            const y = legendY + i * legendGapY;
            return (
              <g key={stop.label}>
                <rect x={legendX} y={y} width={legendSwatchW} height={legendSwatchH} fill={stop.fill} />
                <text
                  x={legendX + legendSwatchW + 6}
                  y={y + legendSwatchH - 3}
                  fill="#e4e4e7"
                  fontSize={11}
                  fontFamily="system-ui, -apple-system, Segoe UI, sans-serif"
                >
                  {stop.label}
                </text>
              </g>
            );
          })}
        </g>
      </svg>
    </div>
  );
}
