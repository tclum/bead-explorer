import { normalize } from "./normalize";
import { numbersCovered } from "./verify";
import type { Chunk, GroundedResult, StatusItem } from "./types";

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
  };
  reasons: string[];
  uncovered_numbers: string[];
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
  };

  if (fixture.expect.refuse) {
    checks.refusal = result.refused ? "ok" : "fail";
    if (!result.refused) reasons.push("expected refuse, got answer");
    if (result.citations.length !== 0) {
      checks.refusal = "fail";
      reasons.push(`refusal fixture must have zero citations, got ${result.citations.length}`);
    }
    return { ok: checks.refusal === "ok", checks, reasons, uncovered_numbers: [] };
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
  return { ok, checks, reasons, uncovered_numbers: uncovered };
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
  const src = item.source;
  const chunks = index.chunksByDocPage.get(`${src.doc}:${src.page}`);
  if (!chunks || chunks.length === 0) {
    return { ok: false, reason: `no chunks for ${src.doc} p.${src.page}` };
  }
  const nq = normalize(src.quote);
  const hit = chunks.some((c) => normalize(c.text).includes(nq));
  if (!hit) return { ok: false, reason: `quote not found in ${src.doc} p.${src.page}: ${JSON.stringify(src.quote)}` };
  return { ok: true };
}
