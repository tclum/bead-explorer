import {
  COUNTY_DISPLAY,
  COUNTY_ORDER_GEOID,
  GEOID_TO_BEAD_COUNTY,
  loadBead,
  loadFcc,
} from "@/lib/gaps";
import { formatCount } from "@/lib/format";

export default function GapTable() {
  const fcc = loadFcc();
  const bead = loadBead();

  const rows = COUNTY_ORDER_GEOID.map((geoid) => {
    const fccRow = fcc.counties.find((r) => r.geoid === geoid);
    if (!fccRow) throw new Error(`GapTable: no FCC row for ${geoid}`);
    const beadKey = GEOID_TO_BEAD_COUNTY[geoid];
    const beadRow = beadKey ? bead.byCounty[beadKey] : null;
    return { geoid, label: COUNTY_DISPLAY[geoid], fcc: fccRow, bead: beadRow };
  });

  const statewide = {
    geoid: "15",
    label: COUNTY_DISPLAY["15"],
    fcc: fcc.state,
    bead: bead.totals,
  };

  const cell = "px-2 py-1.5 text-right tabular-nums";
  const cellLeft = "px-2 py-1.5 text-left";
  const headerCell = "px-2 py-1 text-right font-semibold";
  const dashCell = "px-2 py-1.5 text-right text-zinc-500";

  return (
    <div className="rounded border border-zinc-800 bg-zinc-900/60">
      <div className="overflow-x-auto">
        <table className="w-full text-sm text-zinc-200">
          <caption className="sr-only">
            Broadband gap counts by Hawaiʻi county: FCC Broadband Data Collection (availability as of December 31, 2025)
            beside BEAD Final Proposal project-area counts (December 31, 2024 fabric).
          </caption>
          <colgroup>
            <col />
            <col />
            <col />
            <col />
            <col className="border-l border-zinc-800" />
            <col />
            <col />
            <col />
            <col />
          </colgroup>
          <thead className="bg-zinc-900 text-xs uppercase tracking-wide text-zinc-400">
            <tr>
              <th scope="col" className="px-2 py-1 text-left" rowSpan={2}>
                County
              </th>
              <th scope="colgroup" colSpan={3} className="border-b border-zinc-800 px-2 py-1 text-center">
                FCC BDC — availability as of Dec 31, 2025
              </th>
              <th scope="colgroup" colSpan={5} className="border-b border-l border-zinc-800 px-2 py-1 text-center">
                BEAD Final Proposal — Dec 31, 2024 fabric
              </th>
            </tr>
            <tr>
              <th scope="col" className={headerCell}>BSLs</th>
              <th scope="col" className={headerCell}>Unserved</th>
              <th scope="col" className={headerCell}>Underserved</th>
              <th scope="col" className={`${headerCell} border-l border-zinc-800`}>Total</th>
              <th scope="col" className={headerCell}>Funded unserved</th>
              <th scope="col" className={headerCell}>Funded underserved</th>
              <th scope="col" className={headerCell}>Fiber</th>
              <th scope="col" className={headerCell}>LEO</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r) => (
              <tr key={r.geoid} className="border-t border-zinc-800">
                <th scope="row" className={`${cellLeft} font-medium`}>{r.label}</th>
                <td className={cell}>{formatCount(r.fcc.total)}</td>
                <td className={cell}>{formatCount(r.fcc.unserved)}</td>
                <td className={cell}>{formatCount(r.fcc.underserved)}</td>
                {r.bead ? (
                  <>
                    <td className={`${cell} border-l border-zinc-800`}>{formatCount(r.bead.total)}</td>
                    <td className={cell}>{formatCount(r.bead.unserved)}</td>
                    <td className={cell}>{formatCount(r.bead.underserved)}</td>
                    <td className={cell}>{formatCount(r.bead.fiber)}</td>
                    <td className={cell}>{formatCount(r.bead.leo)}</td>
                  </>
                ) : (
                  <>
                    <td className={`${dashCell} border-l border-zinc-800`} aria-label="not a BEAD project area; folded into Maui">—</td>
                    <td className={dashCell}>—</td>
                    <td className={dashCell}>—</td>
                    <td className={dashCell}>—</td>
                    <td className={dashCell}>—</td>
                  </>
                )}
              </tr>
            ))}
            <tr className="border-t-2 border-zinc-700 bg-zinc-900/70 font-semibold">
              <th scope="row" className={cellLeft}>{statewide.label}</th>
              <td className={cell}>{formatCount(statewide.fcc.total)}</td>
              <td className={cell}>{formatCount(statewide.fcc.unserved)}</td>
              <td className={cell}>{formatCount(statewide.fcc.underserved)}</td>
              <td className={`${cell} border-l border-zinc-800`}>{formatCount(statewide.bead.total)}</td>
              <td className={cell}>{formatCount(statewide.bead.unserved)}</td>
              <td className={cell}>{formatCount(statewide.bead.underserved)}</td>
              <td className={cell}>{formatCount(statewide.bead.fiber)}</td>
              <td className={cell}>{formatCount(statewide.bead.leo)}</td>
            </tr>
          </tbody>
        </table>
      </div>
      <p className="px-4 py-3 text-xs text-zinc-400">
        The two series use different location fabrics and definitions — the FCC serviceable-location tiers versus NTIA&apos;s
        approved BEAD-eligible list after the challenge process — and must not be added or subtracted across series.
        Kalawao has an FCC row but is folded into Maui in the BEAD project areas.
      </p>
    </div>
  );
}
