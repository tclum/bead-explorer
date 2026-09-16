import { readFileSync, existsSync } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const ENV_LOCAL_PATH = path.join(ROOT, ".env.local");

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

async function main() {
  loadEnvLocal();
  const args = process.argv.slice(2);
  const includeRetrieved = args.includes("--retrieved");
  const debug = args.includes("--debug");
  const question = args
    .filter((a) => a !== "--retrieved" && a !== "--debug")
    .join(" ")
    .trim();
  if (!question) {
    process.stderr.write('usage: pnpm ask "<question>" [--retrieved] [--debug]\n');
    process.exit(2);
  }
  if (!process.env.ANTHROPIC_API_KEY) {
    process.stderr.write("ANTHROPIC_API_KEY missing\n");
    process.exit(2);
  }
  const { askGrounded } = await import("../src/lib/ground");
  const result = await askGrounded(question);
  const out: Record<string, unknown> = { ...result };
  if (!includeRetrieved) delete out.retrieved;
  // Unverified figures are masked by default: withheld sentences are
  // hidden entirely, and dropped-quote previews replace digits with `#`
  // (an 80-character preview). `--debug` opts in to the full quotes.
  if (!debug) {
    delete out.withheld_sentences;
    out.dropped = result.dropped.map((d) => ({
      passage_id: d.passage_id,
      reason: d.reason,
      quote: d.quote.slice(0, 80).replace(/\d/g, "#"),
    }));
  }
  process.stdout.write(JSON.stringify(out, null, 2) + "\n");
}

main().catch((e) => {
  process.stderr.write(`error: ${e instanceof Error ? (e.stack ?? e.message) : String(e)}\n`);
  process.exit(1);
});
