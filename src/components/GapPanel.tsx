import GapMap from "./GapMap";
import GapTable from "./GapTable";
import { loadBeadMeta, loadFccMeta, loadGeoMeta, BEAD_CSV_PATH, FCC_CSV_PATH, GEOJSON_PATH } from "@/lib/gaps";

export default function GapPanel() {
  const fccMeta = loadFccMeta();
  const beadMeta = loadBeadMeta();
  const geoMeta = loadGeoMeta();

  return (
    <section aria-labelledby="gaps-title" className="w-full">
      <h2 id="gaps-title" className="mb-3 text-lg font-semibold text-zinc-200">
        Where the gaps are
      </h2>
      <div className="flex flex-col gap-4">
        <GapMap />
        <GapTable />
        <details className="rounded border border-zinc-800 bg-zinc-900/60 p-3 text-xs text-zinc-400">
          <summary className="cursor-pointer select-none hover:text-zinc-200">Receipts</summary>
          <div className="mt-2 space-y-3">
            <div>
              <div className="font-semibold text-zinc-300">FCC BDC — availability as of Dec 31, 2025</div>
              <div className="mono mt-1 whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-900 p-2">
                {`state query: ${fccMeta.queries.state}\n`}
                {`county query: ${fccMeta.queries.county}\n`}
                {`retrieved_at: ${fccMeta.retrieved_at}\n`}
                {`derivation: ${FCC_CSV_PATH} columns TotalBSLs, UnservedBSLs, UnderservedBSLs by GEOID`}
              </div>
            </div>
            <div>
              <div className="font-semibold text-zinc-300">BEAD Final Proposal — Dec 31, 2024 fabric</div>
              <div className="mono mt-1 whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-900 p-2">
                {`source: ${beadMeta.source_url}\n`}
                {`sha256: ${beadMeta.sha256}\n`}
                {`bytes: ${beadMeta.bytes}\n`}
                {`fetched_at: ${beadMeta.fetched_at}\n`}
                {`row_count: ${beadMeta.row_count}\n`}
                {`derivation: ${BEAD_CSV_PATH} aggregates project_id suffix → county (HAWAII/HONOLULU/KAUAI/MAUI), classification 0=unserved · 1=underserved, technology 50=fiber · 61=LEO`}
              </div>
              <div className="mt-1">{beadMeta.note}</div>
            </div>
            <div>
              <div className="font-semibold text-zinc-300">County geometry</div>
              <div className="mono mt-1 whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-900 p-2">
                {`source: ${geoMeta.source_url}\n`}
                {`raw_sha256: ${geoMeta.raw_sha256}\n`}
                {`output_sha256: ${geoMeta.output_sha256}\n`}
                {`fetched_at: ${geoMeta.fetched_at}\n`}
                {`derivation: ${GEOJSON_PATH} — TIGERweb Generalized ACS2023 State/County features filtered to STATE=15, Northwestern Hawaiian Islands rings of Honolulu County dropped (all vertices west of longitude -160.6)`}
              </div>
            </div>
          </div>
        </details>
      </div>
    </section>
  );
}
