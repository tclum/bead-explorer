import { readdirSync, readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { assertFixture, type Fixture } from "../src/lib/assert";
import { scoreOfferors } from "../src/lib/score";
import type { GroundedResult, PageFile, StatusFile } from "../src/lib/types";

const SMOKE_VERSION = "smoke v0.6.0";
const ROOT = process.cwd();
const FIXTURES_PATH = path.join(ROOT, "eval", "fixtures.json");
const FCC_CSV_PATH = path.join(ROOT, "data", "fcc-hi-summary.csv");
const BEAD_CSV_PATH = path.join(ROOT, "data", "bead-hi-project-areas.csv");
const STATUS_PATH = path.join(ROOT, "data", "status.json");
const PAGES_DIR = path.join(ROOT, "data", "pages");
const TIMEOUT_MS = 45_000;

const COUNTY_GEOIDS = ["15001", "15003", "15005", "15007", "15009"];
const COUNT_FORMATTER = new Intl.NumberFormat("en-US", { useGrouping: true, maximumFractionDigits: 0 });
function formatCount(n: number): string {
  return COUNT_FORMATTER.format(n);
}
function parseCsv(text: string): Record<string, string>[] {
  const lines = text.trim().split(/\r?\n/);
  if (lines.length < 2) return [];
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

const buffer: string[] = [];
function bufLog(s: string) {
  buffer.push(s);
}
function flush(exit: number): never {
  process.stdout.write(buffer.join("\n") + "\n");
  process.exit(exit);
}

type PostResult =
  | { ok: true; result: GroundedResult }
  | { ok: false; error: string };

async function postAsk(baseUrl: string, question: string): Promise<PostResult> {
  const url = new URL("/api/ask", baseUrl).toString();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ question }),
      signal: ac.signal,
    });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = (await res.json()) as GroundedResult;
    return { ok: true, result: body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

type VersionInfo = { sha: string; built_at: string };
type VersionResult =
  | { ok: true; info: VersionInfo }
  | { ok: false; error: string };

type PageResult = { ok: true; body: string } | { ok: false; error: string };

async function fetchPage(baseUrl: string, pathname: string): Promise<PageResult> {
  const url = new URL(pathname, baseUrl).toString();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = await res.text();
    return { ok: true, body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

function frameChecks(body: string): { fontsOk: boolean; stampOk: boolean } {
  return {
    fontsOk: !body.includes("fonts.googleapis"),
    stampOk: body.includes('name="build-stamp"'),
  };
}

async function fetchVersion(baseUrl: string): Promise<VersionResult> {
  const url = new URL("/api/version", baseUrl).toString();
  const ac = new AbortController();
  const t = setTimeout(() => ac.abort(), TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: ac.signal });
    if (!res.ok) return { ok: false, error: `HTTP ${res.status}` };
    const body = (await res.json()) as VersionInfo;
    return { ok: true, info: body };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : String(e) };
  } finally {
    clearTimeout(t);
  }
}

function localHeadSha(): string {
  try {
    return execSync("git rev-parse HEAD", { cwd: ROOT, encoding: "utf8" }).trim();
  } catch {
    return "unknown";
  }
}

function short(sha: string): string {
  return sha.length >= 7 ? sha.slice(0, 7) : sha;
}

async function main() {
  const args = process.argv.slice(2);
  const allowMismatch = args.includes("--allow-sha-mismatch");
  const baseUrl = args.find((a) => !a.startsWith("--"));

  bufLog(SMOKE_VERSION);
  if (!baseUrl) {
    bufLog("usage: pnpm smoke <base-url> [--allow-sha-mismatch]");
    buffer.unshift("RESULT: fail");
    flush(1);
  }

  const localSha = localHeadSha();
  const version = await fetchVersion(baseUrl!);
  const deployedSha = version.ok ? version.info.sha : "unknown";
  // Replace the smoke version line with the sha-annotated form.
  buffer[0] = `${SMOKE_VERSION} (deployed ${short(deployedSha)}, local ${short(localSha)})`;

  if (!version.ok) {
    bufLog(`FAIL /api/version: ${version.error}`);
    if (!allowMismatch) {
      buffer.unshift("RESULT: fail");
      flush(1);
    }
  } else if (deployedSha !== localSha) {
    bufLog(`SHA mismatch: deployed=${deployedSha} local=${localSha}`);
    if (!allowMismatch) {
      buffer.unshift("RESULT: fail");
      flush(1);
    }
  }

  const fixturesRaw = JSON.parse(readFileSync(FIXTURES_PATH, "utf8")) as {
    fixtures: Fixture[];
  };
  const f04 = fixturesRaw.fixtures.find((f) => f.id === "f04");
  const r01 = fixturesRaw.fixtures.find((f) => f.id === "r01");
  if (!f04 || !r01) {
    bufLog("fixtures f04 and r01 required");
    buffer.unshift("RESULT: fail");
    flush(1);
  }

  let failures = 0;

  // Check 1: challenge-count question — must be grounded, must cite "37,593", uncovered_numbers empty.
  const r1 = await postAsk(baseUrl!, f04!.question);
  if (!r1.ok) {
    bufLog(`FAIL ${f04!.id} fetch: ${r1.error}`);
    failures += 1;
  } else {
    const a = assertFixture(f04!, r1.result);
    const quoteHas37593 = r1.result.citations.some((c) => c.quote.includes("37,593"));
    const uncoveredEmpty = r1.result.uncovered_numbers.length === 0;
    const okQuote = quoteHas37593 ? "ok" : "fail";
    const okUncovered = uncoveredEmpty ? "ok" : "fail";
    const ok = a.ok && quoteHas37593 && uncoveredEmpty;
    bufLog(
      `${ok ? "PASS" : "FAIL"} ${f04!.id} refusal=${a.checks.refusal} citation=${a.checks.citation} content=${a.checks.content} numbers=${a.checks.numbers} quote_has_37593=${okQuote} uncovered_empty=${okUncovered}`,
    );
    if (!ok) {
      failures += 1;
      if (!a.ok) bufLog(`  reasons: ${a.reasons.join("; ")}`);
      if (!quoteHas37593) bufLog(`  no citation quote contains "37,593"`);
      if (!uncoveredEmpty) bufLog(`  uncovered_numbers: ${r1.result.uncovered_numbers.join(", ")}`);
    }
  }

  // Check 2: Texas allocation — must be refused, zero citations, no figures anywhere.
  const r2 = await postAsk(baseUrl!, r01!.question);
  if (!r2.ok) {
    bufLog(`FAIL ${r01!.id} fetch: ${r2.error}`);
    failures += 1;
  } else {
    const a = assertFixture(r01!, r2.result);
    const figuresStr =
      a.figures_found.length === 0 ? "none" : `present:[${a.figures_found.join(",")}]`;
    bufLog(
      `${a.ok ? "PASS" : "FAIL"} ${r01!.id} refusal=${a.checks.refusal} figures=${figuresStr}`,
    );
    if (!a.ok) {
      failures += 1;
      bufLog(`  reasons: ${a.reasons.join("; ")}`);
    }
  }

  // Check 3: GET / — the page must contain the formatted FCC unserved count for
  // every county and the formatted BEAD total for every project area, values
  // read at run time from the committed CSVs so the probe is data-driven.
  const home = await fetchPage(baseUrl!, "/");
  if (!home.ok) {
    bufLog(`FAIL / fetch: ${home.error}`);
    failures += 1;
  } else {
    const fccRows = parseCsv(readFileSync(FCC_CSV_PATH, "utf8"));
    const beadRows = parseCsv(readFileSync(BEAD_CSV_PATH, "utf8"));
    const fccExpect = COUNTY_GEOIDS.map((geoid) => {
      const row = fccRows.find((r) => r["GEOID"] === geoid);
      if (!row) throw new Error(`smoke: FCC CSV missing GEOID ${geoid}`);
      return { geoid, unserved: formatCount(Number(row["UnservedBSLs"])) };
    });
    const beadExpect = beadRows.map((row) => ({ county: row["county"], total: formatCount(Number(row["total"])) }));
    const missing: string[] = [];
    for (const e of fccExpect) {
      if (!home.body.includes(e.unserved)) missing.push(`FCC ${e.geoid} unserved="${e.unserved}"`);
    }
    for (const e of beadExpect) {
      if (!home.body.includes(e.total)) missing.push(`BEAD ${e.county} total="${e.total}"`);
    }
    const frame = frameChecks(home.body);
    const framePart = `fonts=${frame.fontsOk ? "self-hosted" : "google"} stamp=${frame.stampOk ? "ok" : "missing"}`;
    if (missing.length === 0 && frame.fontsOk && frame.stampOk) {
      bufLog(`PASS / fcc_counties=${fccExpect.length} bead_areas=${beadExpect.length} ${framePart}`);
    } else {
      failures += 1;
      const missPart = missing.length === 0 ? "" : ` missing ${missing.length}: ${missing.join("; ")}`;
      bufLog(`FAIL / ${framePart}${missPart}`);
    }
  }

  // Check 4+: one probe per data/pages/*.json — each rendered page must carry
  // a data-item="key|value" for every numeric items entry, a data-row=
  // "key|label|value" for every breakdown row, and (when the page has a
  // calculator) a data-computed="<id>|<value>" for every entry in
  // calculator.expected. The expected values for the computed cells are
  // derived from the file at run time by running scoreOfferors on the
  // defaults — the smoke does not know the numbers, so a mismatch between
  // the file and the page catches drift.
  const pageFiles = readdirSync(PAGES_DIR)
    .filter((f) => f.endsWith(".json"))
    .sort();
  for (const fname of pageFiles) {
    const pageData = JSON.parse(
      readFileSync(path.join(PAGES_DIR, fname), "utf8"),
    ) as PageFile;
    const pathname = `/${pageData.page}`;
    const needles: { label: string; needle: string }[] = [];
    for (const it of pageData.items) {
      if (typeof it.value === "number") {
        needles.push({
          label: `items[${it.key}]`,
          needle: `data-item="${it.key}|${formatCount(it.value)}"`,
        });
      }
    }
    for (const b of pageData.breakdowns) {
      for (const row of b.rows) {
        needles.push({
          label: `breakdowns[${b.key}].${row.label}`,
          needle: `data-row="${b.key}|${row.label}|${formatCount(row.value)}"`,
        });
      }
    }
    const computedNeedles: { label: string; needle: string }[] = [];
    if (pageData.calculator) {
      const scored = scoreOfferors(pageData.calculator.defaults);
      const byId = new Map(scored.map((s) => [s.id, s]));
      for (const exp of pageData.calculator.expected) {
        const [field, offerorId] = exp.id.split("-");
        const s = byId.get(offerorId);
        if (!s) {
          computedNeedles.push({
            label: `calculator.expected[${exp.id}]`,
            needle: `<offeror ${offerorId} not scored>`,
          });
          continue;
        }
        const value = (s as Record<string, string>)[field];
        computedNeedles.push({
          label: `calculator.expected[${exp.id}]`,
          needle: `data-computed="${exp.id}|${value}"`,
        });
      }
    }
    const resp = await fetchPage(baseUrl!, pathname);
    if (!resp.ok) {
      bufLog(`FAIL ${pathname} fetch: ${resp.error}`);
      failures += 1;
      continue;
    }
    const missing: string[] = [];
    for (const e of needles) {
      if (!resp.body.includes(e.needle)) {
        missing.push(`${e.label} needle=${JSON.stringify(e.needle)}`);
      }
    }
    for (const e of computedNeedles) {
      if (!resp.body.includes(e.needle)) {
        missing.push(`${e.label} needle=${JSON.stringify(e.needle)}`);
      }
    }
    const frame = frameChecks(resp.body);
    const framePart = `fonts=${frame.fontsOk ? "self-hosted" : "google"} stamp=${frame.stampOk ? "ok" : "missing"}`;
    const computedPart = ` computed=${computedNeedles.length}`;
    if (missing.length === 0 && frame.fontsOk && frame.stampOk) {
      bufLog(
        `PASS ${pathname} values=${needles.length}${computedPart} ${framePart}`,
      );
    } else {
      failures += 1;
      const missPart = missing.length === 0
        ? ""
        : ` missing ${missing.length}: ${missing.join("; ")}`;
      bufLog(`FAIL ${pathname} values=${needles.length}${computedPart} ${framePart}${missPart}`);
    }
  }

  // Check /report: builds the expected data-receipt set from status.json and
  // every data/pages/*.json file with the same scope/section/id rules the
  // page renders. Every expected attribute string must appear in the HTML,
  // and data-receipt-count must equal the set's size.
  const status = JSON.parse(readFileSync(STATUS_PATH, "utf8")) as StatusFile;
  const reportPages: PageFile[] = pageFiles.map(
    (fname) =>
      JSON.parse(readFileSync(path.join(PAGES_DIR, fname), "utf8")) as PageFile,
  );
  const expectedReceipts: string[] = [];
  for (const item of status.items) {
    expectedReceipts.push(`data-receipt="status|items|${item.key}"`);
  }
  for (const p of reportPages) {
    for (const it of p.items) {
      expectedReceipts.push(`data-receipt="${p.page}|items|${it.key}"`);
    }
    for (const ph of p.phases) {
      expectedReceipts.push(`data-receipt="${p.page}|phases|${ph.key}"`);
    }
    for (const b of p.breakdowns) {
      for (let i = 0; i < b.rows.length; i += 1) {
        expectedReceipts.push(
          `data-receipt="${p.page}|rows|${b.key}:${i}"`,
        );
      }
    }
    for (const w of p.who) {
      expectedReceipts.push(`data-receipt="${p.page}|who|${w.key}"`);
    }
    for (let i = 0; i < p.evidence.length; i += 1) {
      expectedReceipts.push(`data-receipt="${p.page}|evidence|${i}"`);
    }
    if (p.calculator) {
      for (const exp of p.calculator.expected) {
        expectedReceipts.push(`data-receipt="${p.page}|computed|${exp.id}"`);
      }
    }
  }
  const expectedCount = expectedReceipts.length;
  const report = await fetchPage(baseUrl!, "/report");
  if (!report.ok) {
    bufLog(`FAIL /report fetch: ${report.error}`);
    failures += 1;
  } else {
    const missing: string[] = [];
    for (const needle of expectedReceipts) {
      if (!report.body.includes(needle)) missing.push(needle);
    }
    const countMatch = report.body.match(/data-receipt-count="(\d+)"/);
    const gotCount = countMatch ? Number(countMatch[1]) : NaN;
    const countOk = Number.isFinite(gotCount) && gotCount === expectedCount;
    const frame = frameChecks(report.body);
    const framePart = `fonts=${frame.fontsOk ? "self-hosted" : "google"} stamp=${frame.stampOk ? "ok" : "missing"}`;
    if (missing.length === 0 && countOk && frame.fontsOk && frame.stampOk) {
      bufLog(`PASS /report receipts=${expectedCount} ${framePart}`);
    } else {
      failures += 1;
      const parts: string[] = [];
      if (missing.length > 0) {
        parts.push(`missing ${missing.length}: ${missing.join("; ")}`);
      }
      if (!countOk) {
        parts.push(
          `count=${Number.isFinite(gotCount) ? gotCount : "missing"} expected=${expectedCount}`,
        );
      }
      bufLog(`FAIL /report ${framePart}${parts.length > 0 ? " " + parts.join(" ") : ""}`);
    }
  }

  buffer.unshift(failures === 0 ? "RESULT: pass" : `RESULT: fail failures=${failures}`);
  flush(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  buffer.push(`FAIL: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  buffer.unshift("RESULT: fail");
  flush(1);
});
