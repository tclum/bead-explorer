import { readFileSync } from "node:fs";
import { execSync } from "node:child_process";
import path from "node:path";
import { assertFixture, type Fixture } from "../src/lib/assert";
import type { GroundedResult } from "../src/lib/types";

const SMOKE_VERSION = "smoke v0.2.0";
const ROOT = process.cwd();
const FIXTURES_PATH = path.join(ROOT, "eval", "fixtures.json");
const TIMEOUT_MS = 45_000;

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

  buffer.unshift(failures === 0 ? "RESULT: pass" : `RESULT: fail failures=${failures}`);
  flush(failures === 0 ? 0 : 1);
}

main().catch((e) => {
  buffer.push(`FAIL: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}`);
  buffer.unshift("RESULT: fail");
  flush(1);
});
