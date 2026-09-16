import { readFileSync } from "node:fs";
import path from "node:path";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect } from "vitest";
import GapTable from "./GapTable";
import { formatCount } from "@/lib/format";

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  const headers = lines[0].split(",");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(",");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) row[headers[j]] = cells[j] ?? "";
    rows.push(row);
  }
  return rows;
}

function countOccurrences(haystack: string, needle: string): number {
  if (needle.length === 0) return 0;
  let count = 0;
  let idx = 0;
  while (true) {
    const found = haystack.indexOf(needle, idx);
    if (found < 0) return count;
    count += 1;
    idx = found + needle.length;
  }
}

describe("GapTable", () => {
  const fccCsv = readFileSync(path.join(process.cwd(), "data", "fcc-hi-summary.csv"), "utf8");
  const beadCsv = readFileSync(path.join(process.cwd(), "data", "bead-hi-project-areas.csv"), "utf8");
  const fccRows = parseCsv(fccCsv);
  const beadRows = parseCsv(beadCsv);
  const html = renderToStaticMarkup(<GapTable />);

  const COUNTY_GEOIDS = ["15001", "15003", "15005", "15007", "15009"];
  for (const geoid of COUNTY_GEOIDS) {
    it(`renders the FCC unserved count exactly once for GEOID ${geoid}`, () => {
      const row = fccRows.find((r) => r["GEOID"] === geoid);
      if (!row) throw new Error(`fixture: FCC CSV missing GEOID ${geoid}`);
      const formatted = formatCount(Number(row["UnservedBSLs"]));
      expect(countOccurrences(html, `>${formatted}<`)).toBe(1);
    });
  }

  for (const r of beadRows) {
    it(`renders the BEAD total exactly once for ${r["county"]}`, () => {
      const formatted = formatCount(Number(r["total"]));
      expect(countOccurrences(html, `>${formatted}<`)).toBe(1);
    });
  }
});
