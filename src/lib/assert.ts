import { normalize } from "./normalize";
import { extractNumbers, numbersCovered } from "./verify";
import type { Chunk, GroundedResult, PageFile, PageSource, StatusItem } from "./types";

export type FixtureExpect =
  | {
      refuse: false;
      cite: [string, number][];
      answer_contains: string[][];
    }
  | { refuse: true };

export type Fixture = { id: string; question: string; expect: FixtureExpect };

export type FixtureCheckStatus = "ok" | "fail" | "n/a";

export type FixtureAssertion = {
  ok: boolean;
  checks: {
    retrieval: FixtureCheckStatus;
    refusal: FixtureCheckStatus;
    citation: FixtureCheckStatus;
    content: FixtureCheckStatus;
    numbers: FixtureCheckStatus;
    figures: FixtureCheckStatus;
  };
  reasons: string[];
  uncovered_numbers: string[];
  figures_found: string[];
};

export type CorpusIndex = {
  chunkKeys: Set<string>;
  chunksByDocPage: Map<string, Chunk[]>;
};

export function buildCorpusIndex(chunks: Chunk[]): CorpusIndex {
  const chunkKeys = new Set<string>();
  const chunksByDocPage = new Map<string, Chunk[]>();
  for (const c of chunks) {
    chunkKeys.add(`${c.doc}:${c.page}`);
    const k = `${c.doc}:${c.page}`;
    const arr = chunksByDocPage.get(k);
    if (arr) arr.push(c);
    else chunksByDocPage.set(k, [c]);
  }
  return { chunkKeys, chunksByDocPage };
}

function sameDocPage(a: { doc: string; page: number }, list: [string, number][]): boolean {
  return list.some(([doc, page]) => a.doc === doc && a.page === page);
}

export function assertFixture(
  fixture: Fixture,
  result: GroundedResult,
): FixtureAssertion {
  const reasons: string[] = [];
  const checks: FixtureAssertion["checks"] = {
    retrieval: "n/a",
    refusal: "n/a",
    citation: "n/a",
    content: "n/a",
    numbers: "n/a",
    figures: "n/a",
  };

  if (fixture.expect.refuse) {
    checks.refusal = result.refused ? "ok" : "fail";
    if (!result.refused) reasons.push("expected refuse, got answer");
    if (result.citations.length !== 0) {
      checks.refusal = "fail";
      reasons.push(`refusal fixture must have zero citations, got ${result.citations.length}`);
    }
    const figures_found = extractNumbers(`${result.answer} ${result.refusal_reason ?? ""}`);
    checks.figures = figures_found.length === 0 ? "ok" : "fail";
    if (figures_found.length > 0) {
      reasons.push(`refusal must carry no figures, found: ${figures_found.join(", ")}`);
    }
    const ok = Object.values(checks).every((v) => v === "ok" || v === "n/a");
    return { ok, checks, reasons, uncovered_numbers: [], figures_found };
  }

  const cite = fixture.expect.cite;
  const answerContains = fixture.expect.answer_contains;

  checks.retrieval = result.retrieved.some((r) => sameDocPage(r, cite)) ? "ok" : "fail";
  if (checks.retrieval !== "ok") reasons.push("no retrieved passage matches expected cite");

  checks.refusal = result.refused === false ? "ok" : "fail";
  if (result.refused) reasons.push("expected answer, got refuse");

  checks.citation = result.citations.some((c) => sameDocPage(c, cite)) ? "ok" : "fail";
  if (checks.citation !== "ok") reasons.push("no verified citation matches expected cite");

  const nAnswer = normalize(result.answer);
  const missing: string[] = [];
  for (const group of answerContains) {
    const hit = group.some((alt) => nAnswer.includes(normalize(alt)));
    if (!hit) missing.push(`[${group.join("|")}]`);
  }
  checks.content = missing.length === 0 ? "ok" : "fail";
  if (missing.length > 0) reasons.push(`missing required substring group(s): ${missing.join(" ")}`);

  const { uncovered } = numbersCovered(result.answer, result.citations.map((c) => c.quote));
  checks.numbers = uncovered.length === 0 ? "ok" : "fail";
  if (uncovered.length > 0) reasons.push(`uncovered figures in answer: ${uncovered.join(", ")}`);

  const ok = Object.values(checks).every((v) => v === "ok" || v === "n/a");
  return { ok, checks, reasons, uncovered_numbers: uncovered, figures_found: [] };
}

export function assertBeadProjectAreas(
  csvText: string,
  expectedRowCount: number,
): { ok: boolean; reason?: string } {
  const lines = csvText.trim().split(/\r?\n/);
  if (lines.length < 2) return { ok: false, reason: "bead csv has no rows" };
  const headers = lines[0].split(",");
  const required = ["county", "unserved", "underserved", "total", "fiber", "leo"];
  for (const r of required) {
    if (!headers.includes(r)) return { ok: false, reason: `bead csv missing column ${r}` };
  }
  let sumTotal = 0;
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(",");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) row[headers[j]] = cells[j] ?? "";
    const unserved = Number(row["unserved"]);
    const underserved = Number(row["underserved"]);
    const total = Number(row["total"]);
    const fiber = Number(row["fiber"]);
    const leo = Number(row["leo"]);
    if (![unserved, underserved, total, fiber, leo].every(Number.isFinite)) {
      return { ok: false, reason: `bead csv non-numeric cells in row ${row["county"] ?? i}` };
    }
    if (unserved + underserved !== total) {
      return {
        ok: false,
        reason: `bead csv ${row["county"]}: unserved(${unserved}) + underserved(${underserved}) != total(${total})`,
      };
    }
    if (fiber + leo !== total) {
      return {
        ok: false,
        reason: `bead csv ${row["county"]}: fiber(${fiber}) + leo(${leo}) != total(${total})`,
      };
    }
    sumTotal += total;
  }
  if (sumTotal !== expectedRowCount) {
    return {
      ok: false,
      reason: `bead csv county totals sum to ${sumTotal}, expected row_count ${expectedRowCount}`,
    };
  }
  return { ok: true };
}

export function assertCountyGeojson(
  geojsonText: string,
  expectedGeoids: string[],
): { ok: boolean; reason?: string } {
  let parsed: { type?: string; features?: { properties?: { GEOID?: string } | null }[] };
  try {
    parsed = JSON.parse(geojsonText) as typeof parsed;
  } catch (e) {
    return { ok: false, reason: `geojson invalid JSON: ${(e as Error).message}` };
  }
  if (parsed.type !== "FeatureCollection" || !Array.isArray(parsed.features)) {
    return { ok: false, reason: "geojson is not a FeatureCollection" };
  }
  if (parsed.features.length !== expectedGeoids.length) {
    return {
      ok: false,
      reason: `geojson feature count ${parsed.features.length} != ${expectedGeoids.length}`,
    };
  }
  const got = parsed.features.map((f) => String(f.properties?.GEOID ?? "")).sort();
  const want = [...expectedGeoids].sort();
  if (got.join(",") !== want.join(",")) {
    return { ok: false, reason: `geojson GEOIDs [${got.join(",")}] != [${want.join(",")}]` };
  }
  return { ok: true };
}

export function assertQuoteInCorpus(
  source: PageSource,
  index: CorpusIndex,
): { ok: boolean; reason?: string } {
  const chunks = index.chunksByDocPage.get(`${source.doc}:${source.page}`);
  if (!chunks || chunks.length === 0) {
    return { ok: false, reason: `no chunks for ${source.doc} p.${source.page}` };
  }
  const nq = normalize(source.quote);
  const hit = chunks.some((c) => normalize(c.text).includes(nq));
  if (!hit) {
    return {
      ok: false,
      reason: `quote not found in ${source.doc} p.${source.page}: ${JSON.stringify(source.quote)}`,
    };
  }
  return { ok: true };
}

export function assertStatusItem(
  item: StatusItem,
  index: CorpusIndex,
  csvRows: Record<string, string>[],
): { ok: boolean; reason?: string } {
  if ("csv" in item.source) {
    const src = item.source;
    const row = csvRows.find((r) => Object.entries(src.row).every(([k, v]) => r[k] === v));
    if (!row) return { ok: false, reason: `csv row ${JSON.stringify(src.row)} not found in ${src.csv}` };
    for (const [col, want] of Object.entries(src.columns)) {
      const got = Number(row[col]);
      if (!Number.isFinite(got) || got !== want) {
        return { ok: false, reason: `csv ${src.csv} row ${JSON.stringify(src.row)} ${col}: expected ${want}, got ${row[col]}` };
      }
    }
    return { ok: true };
  }
  return assertQuoteInCorpus(item.source, index);
}

export function assertPageData(
  page: PageFile,
  index: CorpusIndex,
): { ok: boolean; failures: string[] } {
  const failures: string[] = [];
  for (const it of page.items) {
    const r = assertQuoteInCorpus(it.source, index);
    if (!r.ok) failures.push(`items[${it.key}] ${r.reason}`);
  }
  for (const ph of page.phases) {
    const r = assertQuoteInCorpus(ph.source, index);
    if (!r.ok) failures.push(`phases[${ph.key}] ${r.reason}`);
  }
  for (const b of page.breakdowns) {
    let sum = 0;
    for (const row of b.rows) {
      const r = assertQuoteInCorpus(row.source, index);
      if (!r.ok) failures.push(`breakdowns[${b.key}].rows[${row.label}] ${r.reason}`);
      sum += row.value;
    }
    if (sum !== b.sum_expected) {
      failures.push(
        `breakdowns[${b.key}] rows sum to ${sum}, expected ${b.sum_expected}`,
      );
    }
  }
  for (const w of page.who) {
    const r = assertQuoteInCorpus(w.source, index);
    if (!r.ok) failures.push(`who[${w.key}] ${r.reason}`);
  }
  for (const e of page.evidence) {
    const r = assertQuoteInCorpus(e.source, index);
    if (!r.ok) failures.push(`evidence[${e.type}] ${r.reason}`);
  }
  return { ok: failures.length === 0, failures };
}
