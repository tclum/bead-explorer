import { readFileSync, readdirSync, existsSync } from "node:fs";
import path from "node:path";
import {
  assertBeadProjectAreas,
  assertCountyGeojson,
  assertFixture,
  assertPageData,
  assertStatusItem,
  buildCorpusIndex,
  type Fixture,
} from "../src/lib/assert";
import { verifyCitations, withholdUncoveredSentences } from "../src/lib/verify";
import type { Corpus, GroundedResult, PageFile, RetrievedChunk, StatusFile, Usage, VerifiedCitation, Citation, StatusItem } from "../src/lib/types";

const ROOT = process.cwd();
const CORPUS_PATH = path.join(ROOT, "data", "corpus.json");
const STATUS_PATH = path.join(ROOT, "data", "status.json");
const FIXTURES_PATH = path.join(ROOT, "eval", "fixtures.json");
const SELFTEST_PATH = path.join(ROOT, "eval", "selftest.json");
const FCC_CSV_PATH = path.join(ROOT, "data", "fcc-hi-summary.csv");
const BEAD_CSV_PATH = path.join(ROOT, "data", "bead-hi-project-areas.csv");
const BEAD_META_PATH = path.join(ROOT, "data", "bead-hi-project-areas.meta.json");
const GEOJSON_PATH = path.join(ROOT, "data", "hi-counties.geojson");
const PAGES_DIR = path.join(ROOT, "data", "pages");
const EXPECTED_HI_GEOIDS = ["15001", "15003", "15005", "15007", "15009"];
const ENV_LOCAL_PATH = path.join(ROOT, ".env.local");
const EVAL_VERSION = "eval v0.1.0";

// $ per 1M tokens. cache_write = cache_creation_input_tokens; cache_read = cache_read_input_tokens.
const MODEL_PRICES: Record<string, { input: number; cache_write: number; cache_read: number; output: number }> = {
  "claude-sonnet-5": { input: 2, cache_write: 2.5, cache_read: 0.2, output: 10 },
};

const EMPTY_USAGE: Usage = {
  input_tokens: 0,
  output_tokens: 0,
  cache_creation_input_tokens: 0,
  cache_read_input_tokens: 0,
};

function addUsage(a: Usage, b: Usage): Usage {
  return {
    input_tokens: a.input_tokens + b.input_tokens,
    output_tokens: a.output_tokens + b.output_tokens,
    cache_creation_input_tokens: a.cache_creation_input_tokens + b.cache_creation_input_tokens,
    cache_read_input_tokens: a.cache_read_input_tokens + b.cache_read_input_tokens,
  };
}

function costFor(model: string, u: Usage): number {
  const p = MODEL_PRICES[model];
  if (!p) return 0;
  return (
    (u.input_tokens * p.input +
      u.cache_creation_input_tokens * p.cache_write +
      u.cache_read_input_tokens * p.cache_read +
      u.output_tokens * p.output) /
    1_000_000
  );
}

const buffer: string[] = [];
function bufLog(...args: string[]) {
  buffer.push(args.join(" "));
}
function flush(exit: number): never {
  process.stdout.write(buffer.join("\n") + "\n");
  process.exit(exit);
}

function loadEnvLocal() {
  if (!existsSync(ENV_LOCAL_PATH)) return;
  const text = readFileSync(ENV_LOCAL_PATH, "utf8");
  for (const line of text.split(/\r?\n/)) {
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq < 0) continue;
    const k = line.slice(0, eq).trim();
    const v = line.slice(eq + 1).trim();
    if (k && !(k in process.env)) process.env[k] = v;
  }
}

function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
  const headers = lines[0].split(",");
  const rows: Record<string, string>[] = [];
  for (let i = 1; i < lines.length; i += 1) {
    const cells = lines[i].split(",");
    const row: Record<string, string> = {};
    for (let j = 0; j < headers.length; j += 1) {
      row[headers[j]] = cells[j] ?? "";
    }
    rows.push(row);
  }
  return rows;
}

function parseOnly(args: string[]): Set<string> | null {
  const idx = args.indexOf("--only");
  if (idx < 0) return null;
  const val = args[idx + 1];
  if (!val) return new Set<string>();
  return new Set(val.split(",").map((s) => s.trim()).filter((s) => s.length > 0));
}

function parseRepeat(args: string[]): number {
  const idx = args.indexOf("--repeat");
  if (idx < 0) return 1;
  const val = args[idx + 1];
  const n = Number(val);
  if (!Number.isFinite(n) || n < 1) return 1;
  return Math.floor(n);
}

async function selftest(): Promise<never> {
  type Case = {
    letter: string;
    kind: "must_pass" | "must_fail";
    reason: string;
    fixture: Fixture;
    raw: {
      answer: string;
      refused: boolean;
      refusal_reason?: string;
      citations: Citation[];
    };
    retrieved: RetrievedChunk[];
    retried?: boolean;
    answer_revised?: boolean;
  };
  type StatusCase = {
    letter: string;
    kind: "must_pass" | "must_fail";
    reason: string;
    item: StatusItem;
  };
  type DataCase =
    | {
        letter: string;
        kind: "must_pass" | "must_fail";
        reason: string;
        kind_check: "bead-project-areas";
        csv: string;
        expected_row_count: number;
      }
    | {
        letter: string;
        kind: "must_pass" | "must_fail";
        reason: string;
        kind_check: "page-data";
        page: PageFile;
      };
  const raw = JSON.parse(readFileSync(SELFTEST_PATH, "utf8")) as {
    corpus: { id: string; doc: string; page: number; text: string; url: string; page_url: string }[];
    csvRows: Record<string, string>[];
    cases: Case[];
    statusCases: StatusCase[];
    dataCases?: DataCase[];
  };
  const corpusIndex = buildCorpusIndex(raw.corpus.map((c) => ({ ...c })));

  const misbehavers: string[] = [];
  bufLog(`${EVAL_VERSION} selftest (fixtures v1)`);
  for (const c of raw.cases) {
    const { verified, dropped } = verifyCitations(c.raw.citations, c.retrieved);
    let refused = c.raw.refused;
    let refusal_reason = c.raw.refusal_reason;
    let citations: VerifiedCitation[] = verified;
    let answer = c.raw.answer;
    if (!refused && verified.length === 0) {
      refused = true;
      refusal_reason = "ungrounded: no citation could be verified against the retrieved passages";
      answer = "";
      citations = [];
    }
    let withheld_count = 0;
    let withheld_sentences: string[] = [];
    let uncovered: string[] = [];
    if (!refused) {
      const pruned = withholdUncoveredSentences(answer, citations.map((cc) => cc.quote));
      answer = pruned.answer;
      withheld_count = pruned.withheld_count;
      withheld_sentences = pruned.withheld_sentences;
      uncovered = pruned.uncovered_after;
      if (answer.length === 0) {
        refused = true;
        refusal_reason = "ungrounded: no verifiable content remains after withholding uncovered figures";
      }
    }
    if (refused) {
      answer = "";
      citations = [];
      withheld_sentences = [];
      withheld_count = 0;
      uncovered = [];
    }
    const result: GroundedResult = {
      question: c.fixture.question,
      answer,
      refused,
      citations,
      dropped,
      dropped_citations: dropped.length,
      retrieved: c.retrieved.map((r) => ({ id: r.id, doc: r.doc, page: r.page, score: r.score })),
      model: "selftest",
      latency_ms: 0,
      retried: c.retried ?? false,
      answer_revised: c.answer_revised ?? false,
      uncovered_numbers: uncovered,
      withheld_count,
      withheld_sentences,
      usage: EMPTY_USAGE,
    };
    if (refusal_reason) result.refusal_reason = refusal_reason;
    const a = assertFixture(c.fixture, result);
    const behaved = c.kind === "must_pass" ? a.ok : !a.ok;
    const tag = behaved ? "PASS" : "FAIL";
    const misbehave = behaved ? "" : "  <<< MISBEHAVED";
    bufLog(`${tag} case=${c.letter} kind=${c.kind} assertOk=${a.ok} reason=${c.reason}${misbehave}`);
    if (!behaved) misbehavers.push(c.letter);
  }
  for (const sc of raw.statusCases) {
    const a = assertStatusItem(sc.item, corpusIndex, raw.csvRows);
    const behaved = sc.kind === "must_pass" ? a.ok : !a.ok;
    const tag = behaved ? "PASS" : "FAIL";
    const misbehave = behaved ? "" : "  <<< MISBEHAVED";
    bufLog(`${tag} case=${sc.letter} kind=${sc.kind} assertOk=${a.ok} reason=${sc.reason}${a.reason ? ` [${a.reason}]` : ""}${misbehave}`);
    if (!behaved) misbehavers.push(sc.letter);
  }
  for (const dc of raw.dataCases ?? []) {
    let a: { ok: boolean; reason?: string };
    if (dc.kind_check === "bead-project-areas") {
      a = assertBeadProjectAreas(dc.csv, dc.expected_row_count);
    } else if (dc.kind_check === "page-data") {
      const r = assertPageData(dc.page, corpusIndex);
      a = r.ok ? { ok: true } : { ok: false, reason: r.failures[0] };
    } else {
      a = { ok: false, reason: `unknown data-case kind ${(dc as { kind_check: string }).kind_check}` };
    }
    const behaved = dc.kind === "must_pass" ? a.ok : !a.ok;
    const tag = behaved ? "PASS" : "FAIL";
    const misbehave = behaved ? "" : "  <<< MISBEHAVED";
    bufLog(`${tag} case=${dc.letter} kind=${dc.kind} assertOk=${a.ok} reason=${dc.reason}${a.reason ? ` [${a.reason}]` : ""}${misbehave}`);
    if (!behaved) misbehavers.push(dc.letter);
  }
  if (misbehavers.length === 0) {
    buffer.unshift("RESULT: pass");
  } else {
    buffer.unshift(`RESULT: fail misbehaved=[${misbehavers.join(",")}]`);
  }
  flush(misbehavers.length === 0 ? 0 : 1);
}

async function main() {
  const args = process.argv.slice(2);
  if (args.includes("--selftest")) {
    await selftest();
    return;
  }
  loadEnvLocal();

  const only = parseOnly(args);
  const repeat = only === null ? 1 : parseRepeat(args);
  const model = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-5";

  const fixturesRaw = JSON.parse(readFileSync(FIXTURES_PATH, "utf8")) as {
    fixturesVersion: number;
    k?: number;
    fixtures: Fixture[];
  };

  if (!process.env.ANTHROPIC_API_KEY) {
    bufLog(`${EVAL_VERSION} (fixtures v${fixturesRaw.fixturesVersion}, model ${model})`);
    bufLog(`cost: 0 in, 0 written, 0 cached, 0 out ≈ $0.00 (${model} at $-/$- per MTok, cache write $-, cache read $-)`);
    bufLog("ANTHROPIC_API_KEY missing");
    buffer.unshift("RESULT: fail");
    flush(1);
  }

  if (!existsSync(CORPUS_PATH)) {
    bufLog(`${EVAL_VERSION} (fixtures v${fixturesRaw.fixturesVersion}, model ${model})`);
    bufLog(`cost: 0 in, 0 written, 0 cached, 0 out ≈ $0.00`);
    bufLog("data/corpus.json missing; run `pnpm ingest` first");
    buffer.unshift("RESULT: fail");
    flush(1);
  }

  const corpus = JSON.parse(readFileSync(CORPUS_PATH, "utf8")) as Corpus;
  if (corpus.chunks.length === 0) {
    bufLog(`${EVAL_VERSION} (fixtures v${fixturesRaw.fixturesVersion}, model ${model})`);
    bufLog(`cost: 0 in, 0 written, 0 cached, 0 out ≈ $0.00`);
    bufLog("data/corpus.json contains 0 chunks");
    buffer.unshift("RESULT: fail");
    flush(1);
  }
  const index = buildCorpusIndex(corpus.chunks);

  const status = JSON.parse(readFileSync(STATUS_PATH, "utf8")) as StatusFile;
  const csvText = existsSync(FCC_CSV_PATH) ? readFileSync(FCC_CSV_PATH, "utf8") : "";
  const csvRows = parseCsv(csvText);

  bufLog(`${EVAL_VERSION} (fixtures v${fixturesRaw.fixturesVersion}, model ${model})`);
  // reserve line-3 slot for the cost summary; filled in at end
  const costLineIndex = buffer.length;
  buffer.push("");

  const failures: string[] = [];

  // Offline: fixture cite pairs
  for (const f of fixturesRaw.fixtures) {
    if (f.expect.refuse) continue;
    if (only && !only.has(f.id)) continue;
    const missing = f.expect.cite.filter(([d, p]) => !index.chunkKeys.has(`${d}:${p}`));
    if (missing.length > 0) {
      failures.push(`fixture ${f.id} cite offline check`);
      bufLog(`FAIL ${f.id} offline: cite pairs not in corpus: ${JSON.stringify(missing)}`);
    } else {
      bufLog(`PASS ${f.id} offline: all cite pairs exist in corpus`);
    }
  }

  // Offline: BEAD project-areas CSV sums
  if (existsSync(BEAD_CSV_PATH) && existsSync(BEAD_META_PATH)) {
    const beadText = readFileSync(BEAD_CSV_PATH, "utf8");
    const beadMeta = JSON.parse(readFileSync(BEAD_META_PATH, "utf8")) as { row_count?: number };
    const expected = typeof beadMeta.row_count === "number" ? beadMeta.row_count : -1;
    const a = assertBeadProjectAreas(beadText, expected);
    if (a.ok) {
      bufLog("PASS data bead-project-areas");
    } else {
      failures.push("data bead-project-areas");
      bufLog(`FAIL data bead-project-areas reason=${a.reason}`);
    }
  } else {
    failures.push("data bead-project-areas");
    bufLog("FAIL data bead-project-areas reason=missing CSV or meta");
  }

  // Offline: county GeoJSON feature count and GEOIDs
  if (existsSync(GEOJSON_PATH)) {
    const geoText = readFileSync(GEOJSON_PATH, "utf8");
    const a = assertCountyGeojson(geoText, EXPECTED_HI_GEOIDS);
    if (a.ok) {
      bufLog("PASS data hi-counties");
    } else {
      failures.push("data hi-counties");
      bufLog(`FAIL data hi-counties reason=${a.reason}`);
    }
  } else {
    failures.push("data hi-counties");
    bufLog("FAIL data hi-counties reason=missing data/hi-counties.geojson");
  }

  // Offline: status items (always run — status is not fixture-scoped)
  for (const item of status.items) {
    const a = assertStatusItem(item, index, csvRows);
    if (a.ok) {
      bufLog(`PASS status ${item.key}`);
    } else {
      failures.push(`status ${item.key}`);
      bufLog(`FAIL status ${item.key} reason=${a.reason}`);
    }
  }

  // Offline: page-data files (data/pages/*.json). Missing directory or an
  // empty directory is a hard failure — every workflow page's figures must
  // live here, so an empty pages directory means the checks have nothing to
  // verify.
  const pageFiles = existsSync(PAGES_DIR)
    ? readdirSync(PAGES_DIR).filter((f) => f.endsWith(".json")).sort()
    : [];
  if (pageFiles.length === 0) {
    failures.push("data pages");
    bufLog("FAIL data pages: no page files found");
  } else {
    for (const fname of pageFiles) {
      const page = JSON.parse(
        readFileSync(path.join(PAGES_DIR, fname), "utf8"),
      ) as PageFile;
      const a = assertPageData(page, index);
      const rowCount = page.breakdowns.reduce((n, b) => n + b.rows.length, 0);
      const counts = `items=${page.items.length} phases=${page.phases.length} rows=${rowCount} who=${page.who.length} evidence=${page.evidence.length}`;
      if (a.ok) {
        bufLog(`PASS data pages/${page.page} ${counts}`);
      } else {
        failures.push(`pages/${page.page}`);
        bufLog(`FAIL data pages/${page.page}: ${a.failures[0]}`);
      }
    }
  }

  // Live: run askGrounded per fixture
  const { askGrounded } = await import("../src/lib/ground");

  let totalUsage = EMPTY_USAGE;
  const scoped = fixturesRaw.fixtures.filter((f) => only === null || only.has(f.id));
  let livePassCount = 0;
  let liveTotalCount = 0;
  for (let iter = 1; iter <= repeat; iter += 1) {
    if (repeat > 1) bufLog(`--- iteration ${iter}/${repeat} ---`);
    for (const f of scoped) {
      const startedAt = Date.now();
      let result: GroundedResult | null = null;
      let livError: string | null = null;
      try {
        result = await askGrounded(f.question, { k: fixturesRaw.k ?? 8 });
      } catch (e) {
        livError = e instanceof Error ? e.message : String(e);
      }
      const dt = ((Date.now() - startedAt) / 1000).toFixed(1);
      liveTotalCount += 1;
      if (!result) {
        failures.push(f.id);
        bufLog(`FAIL ${f.id} live error: ${livError} ${dt}s`);
        continue;
      }
      totalUsage = addUsage(totalUsage, result.usage);
      const a = assertFixture(f, result);
      const retrievedIds = result.retrieved.map((r) => r.id).join(",");
      const citation =
        result.citations[0] ? `${result.citations[0].doc}:p${result.citations[0].page}` : "-";
      const numbersStatus = a.checks.numbers === "n/a"
        ? "n/a"
        : a.checks.numbers === "ok"
          ? "ok"
          : `missing:[${a.uncovered_numbers.join(",")}]`;
      const figuresPart = f.expect.refuse
        ? ` figures=${a.figures_found.length === 0 ? "none" : `present:[${a.figures_found.join(",")}]`}`
        : "";
      const retriedMark = result.retried ? ` retried=true${result.answer_revised ? " revised=true" : ""}` : "";
      const withheldCount = result.withheld_count ?? 0;
      const withheldMark = withheldCount > 0 ? ` withheld=${withheldCount}` : ` withheld=0`;
      const usageMark = `in=${result.usage.input_tokens} cached=${result.usage.cache_read_input_tokens} out=${result.usage.output_tokens}`;
      const line = `${a.ok ? "PASS" : "FAIL"} ${f.id} retrieval=${a.checks.retrieval} refusal=${a.checks.refusal} citation=${a.checks.citation === "n/a" ? "n/a" : citation} content=${a.checks.content} numbers=${numbersStatus}${figuresPart}${retriedMark}${withheldMark} ${usageMark} ${dt}s`;
      bufLog(line);
      if (a.ok) {
        livePassCount += 1;
      } else {
        failures.push(f.id);
        bufLog(`  retrieved: ${retrievedIds}`);
        bufLog(`  answer[0..200]: ${JSON.stringify(result.answer.slice(0, 200))}`);
        bufLog(`  retried=${result.retried} answer_revised=${result.answer_revised} uncovered_numbers=[${result.uncovered_numbers.join(",")}] withheld_count=${withheldCount}`);
        if (result.dropped && result.dropped.length > 0) {
          bufLog(`  dropped citations (${result.dropped.length}):`);
          for (const d of result.dropped) {
            bufLog(`    - ${d.reason} passage=${d.passage_id} quote=${JSON.stringify(d.quote.slice(0, 100))}`);
          }
        } else {
          bufLog(`  dropped citations: none`);
        }
        bufLog(`  reasons: ${a.reasons.join("; ")}`);
      }
    }
  }

  const totalsLabel = repeat > 1
    ? `totals: fixtures=${scoped.length} (--only) repeat=${repeat} live_pass=${livePassCount}/${liveTotalCount} status_items=${status.items.length} failures=${failures.length}`
    : `totals: fixtures=${scoped.length}${only ? ` (--only)` : ""} status_items=${status.items.length} failures=${failures.length}`;
  bufLog(totalsLabel);
  if (failures.length === 0) buffer.unshift("RESULT: pass");
  else buffer.unshift(`RESULT: fail failures=[${failures.join(",")}]`);

  const cost = costFor(model, totalUsage);
  const priceTable = MODEL_PRICES[model];
  const priceStr = priceTable
    ? `${model} at $${priceTable.input}/$${priceTable.output} per MTok, cache write $${priceTable.cache_write}, cache read $${priceTable.cache_read}`
    : `${model} (no price table)`;
  buffer[costLineIndex + 1] = `cost: ${totalUsage.input_tokens} in, ${totalUsage.cache_creation_input_tokens} written, ${totalUsage.cache_read_input_tokens} cached, ${totalUsage.output_tokens} out ≈ $${cost.toFixed(2)} (${priceStr})`;

  flush(failures.length === 0 ? 0 : 1);
}

main().catch((e) => {
  buffer.push(`FAIL: ${e instanceof Error ? e.stack ?? e.message : String(e)}`);
  buffer.unshift("RESULT: fail");
  flush(1);
});
