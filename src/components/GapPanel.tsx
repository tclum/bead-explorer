import GapMap from "./GapMap";
import GapTable from "./GapTable";
import { loadBeadMeta, loadFccMeta, loadGeoMeta, BEAD_CSV_PATH, FCC_CSV_PATH, GEOJSON_PATH } from "@/lib/gaps";

export default function GapPanel() {
  const fccMeta = loadFccMeta();
  const beadMeta = loadBeadMeta();
  const geoMeta = loadGeoMeta();

  return (
    <section aria-labelledby="gaps-title">
      <h2 id="gaps-title" className="mb-6 font-serif text-2xl font-medium text-paper">
        Where the gaps are
      </h2>
      <div className="grid grid-cols-1 gap-6 lg:grid-cols-2">
        <div className="order-1 lg:order-1">
          <GapMap />
        </div>
        <div className="order-2 lg:order-2">
          <GapTable />
        </div>
      </div>
      <details className="mt-6 rounded border border-ink-800 bg-ink-900 p-4 text-xs text-paper-3">
        <summary className="cursor-pointer select-none hover:text-paper-2">Receipts</summary>
        <div className="mt-3 space-y-4">
          <div>
            <div className="font-semibold text-paper-2">
              FCC BDC — availability as of Dec 31, 2025
            </div>
            <div className="mt-2 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper-2">
              {`state query: ${fccMeta.queries.state}\n`}
              {`county query: ${fccMeta.queries.county}\n`}
              {`retrieved_at: ${fccMeta.retrieved_at}\n`}
              {`derivation: ${FCC_CSV_PATH} columns TotalBSLs, UnservedBSLs, UnderservedBSLs by GEOID`}
            </div>
          </div>
          <div>
            <div className="font-semibold text-paper-2">
              BEAD Final Proposal — Dec 31, 2024 fabric
            </div>
            <div className="mt-2 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper-2">
              {`source: ${beadMeta.source_url}\n`}
              {`sha256: ${beadMeta.sha256}\n`}
              {`bytes: ${beadMeta.bytes}\n`}
              {`fetched_at: ${beadMeta.fetched_at}\n`}
              {`row_count: ${beadMeta.row_count}\n`}
              {`derivation: ${BEAD_CSV_PATH} aggregates project_id suffix → county (HAWAII/HONOLULU/KAUAI/MAUI), classification 0=unserved · 1=underserved, technology 50=fiber · 61=LEO`}
            </div>
            <div className="mt-2 text-paper-3">{beadMeta.note}</div>
          </div>
          <div>
            <div className="font-semibold text-paper-2">County geometry</div>
            <div className="mt-2 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper-2">
              {`source: ${geoMeta.source_url}\n`}
              {`raw_sha256: ${geoMeta.raw_sha256}\n`}
              {`output_sha256: ${geoMeta.output_sha256}\n`}
              {`fetched_at: ${geoMeta.fetched_at}\n`}
              {`derivation: ${GEOJSON_PATH} — TIGERweb Generalized ACS2023 State/County features filtered to STATE=15, Northwestern Hawaiian Islands rings of Honolulu County dropped (all vertices west of longitude -160.6)`}
            </div>
          </div>
        </div>
      </details>
    </section>
  );
}
