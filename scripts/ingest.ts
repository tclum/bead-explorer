import { readFileSync, writeFileSync, existsSync, mkdirSync } from "node:fs";
import { createHash } from "node:crypto";
import path from "node:path";
import { extractText } from "unpdf";
import * as cheerio from "cheerio";
import type { Manifest, Source, Chunk, Corpus } from "../src/lib/types";
import { chunkPage, MAX_CHUNK_CHARS, type PageInput } from "../src/lib/chunk";

const MIN_CHUNK_CHARS = 40;
const HISTOGRAM_BUCKETS: [number, number][] = [
  [40, 320],
  [320, 600],
  [600, 880],
  [880, 1160],
  [1160, MAX_CHUNK_CHARS + 1],
];

const ROOT = path.resolve(process.cwd());
const RAW_DIR = path.join(ROOT, "data", "raw");
const SOURCES_PATH = path.join(ROOT, "data", "sources.json");
const CORPUS_PATH = path.join(ROOT, "data", "corpus.json");

const UA =
  "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.4 Safari/605.1.15 bead-explorer/0.1";

function die(msg: string, code = 1): never {
  console.error(msg);
  process.exit(code);
}

function sha256(bytes: Uint8Array): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function extForKind(kind: "pdf" | "html"): string {
  return kind === "pdf" ? "pdf" : "html";
}

async function ensureRawFile(source: Source): Promise<Uint8Array> {
  mkdirSync(RAW_DIR, { recursive: true });
  const rawPath = path.join(RAW_DIR, `${source.id}.${extForKind(source.kind)}`);
  if (existsSync(rawPath)) {
    return new Uint8Array(readFileSync(rawPath));
  }
  console.log(`  fetch ${source.url}`);
  let res: Response;
  try {
    res = await fetch(source.url, {
      redirect: "follow",
      headers: {
        "user-agent": UA,
        accept: source.kind === "pdf" ? "application/pdf,*/*" : "text/html,*/*",
      },
    });
  } catch (e) {
    die(`FAIL ${source.id}: fetch error: ${(e as Error).message} url=${source.url}`);
  }
  if (res.status !== 200) {
    die(`FAIL ${source.id}: HTTP ${res.status} url=${source.url}`);
  }
  const origHost = new URL(source.url).hostname;
  const finalHost = new URL(res.url).hostname;
  if (origHost !== finalHost) {
    die(`FAIL ${source.id}: redirected to different host ${finalHost} url=${source.url}`);
  }
  const ct = (res.headers.get("content-type") ?? "").toLowerCase();
  const wantsPdf = source.kind === "pdf";
  const isPdf = ct.includes("application/pdf") || ct.includes("application/octet-stream");
  const isHtml = ct.includes("text/html") || ct.includes("application/xhtml");
  if (wantsPdf && !isPdf) {
    die(`FAIL ${source.id}: content-type "${ct}" does not match pdf url=${source.url}`);
  }
  if (!wantsPdf && !isHtml) {
    die(`FAIL ${source.id}: content-type "${ct}" does not match html url=${source.url}`);
  }
  const buf = new Uint8Array(await res.arrayBuffer());
  writeFileSync(rawPath, buf);
  console.log(`  wrote ${path.relative(ROOT, rawPath)} (${buf.byteLength} bytes)`);
  return buf;
}

async function extractPdfPages(bytes: Uint8Array): Promise<{ totalPages: number; pages: string[] }> {
  const result = await extractText(bytes, { mergePages: false });
  if (typeof result.text === "string") {
    die(`unexpected unpdf output: got merged string instead of per-page array`);
  }
  return { totalPages: result.totalPages, pages: result.text };
}

function extractHtmlText(bytes: Uint8Array, source: Source): string {
  const html = new TextDecoder("utf-8").decode(bytes);
  const $ = cheerio.load(html);
  $(
    "script, style, noscript, nav, header, footer, aside, form, iframe, [role=navigation], .menu, .nav, .sidebar, .breadcrumb, .site-header, .site-footer, .skip-link",
  ).remove();
  if (source.strip && source.strip.length > 0) {
    for (const sel of source.strip) $(sel).remove();
  }
  let $root = source.selector ? $(source.selector).first() : $();
  if ($root.length === 0) $root = $(".entry-content").first();
  if ($root.length === 0) $root = $("article").first();
  if ($root.length === 0) $root = $("main").first();
  if ($root.length === 0) $root = $("body").first();
  const blocks: string[] = [];
  $root
    .find("p, h1, h2, h3, h4, h5, h6, li, blockquote, pre, tr, dt, dd")
    .each((_i, el) => {
      const t = $(el).clone().find("script,style").remove().end().text().replace(/\s+/g, " ").trim();
      if (t.length > 0) blocks.push(t);
    });
  if (blocks.length === 0) {
    const t = $root.text().replace(/\s+/g, " ").trim();
    if (t.length > 0) blocks.push(t);
  }
  const uniq: string[] = [];
  const seen = new Set<string>();
  for (const b of blocks) {
    if (!seen.has(b)) {
      seen.add(b);
      uniq.push(b);
    }
  }
  const header = `${source.title} — ${source.publisher}, ${source.date ?? "undated"}. Source: ${source.url}`;
  return header + "\n\n" + uniq.join("\n\n");
}

function pageUrlFor(source: Source, page: number): string {
  return source.kind === "pdf" ? `${source.url}#page=${page}` : source.url;
}

async function ingestSource(source: Source): Promise<{ chunks: Chunk[]; sourceUpdate: Partial<Source>; htmlText?: string }> {
  const bytes = await ensureRawFile(source);
  const digest = sha256(bytes);
  const size = bytes.byteLength;
  const fetched = new Date().toISOString();

  const chunks: Chunk[] = [];
  let pagesUsed = 0;
  let totalPages = 0;
  let htmlText: string | undefined;

  if (source.kind === "pdf") {
    const { totalPages: tp, pages } = await extractPdfPages(bytes);
    totalPages = tp;
    if (typeof source.expect_pages === "number" && tp !== source.expect_pages) {
      die(`FAIL ${source.id}: expected ${source.expect_pages} pages, got ${tp}`);
    }
    const [lo, hi] = source.page_range ?? [1, tp];
    if (lo < 1 || hi > tp || lo > hi) {
      die(`FAIL ${source.id}: page_range [${lo}, ${hi}] out of bounds for ${tp} pages`);
    }
    for (let p = lo; p <= hi; p += 1) {
      const input: PageInput = {
        doc: source.id,
        page: p,
        text: pages[p - 1] ?? "",
        url: source.url,
        page_url: pageUrlFor(source, p),
      };
      chunks.push(...chunkPage(input));
      pagesUsed += 1;
    }
  } else {
    totalPages = 1;
    htmlText = extractHtmlText(bytes, source);
    const input: PageInput = {
      doc: source.id,
      page: 1,
      text: htmlText,
      url: source.url,
      page_url: pageUrlFor(source, 1),
    };
    chunks.push(...chunkPage(input));
    pagesUsed = 1;
  }

  if (chunks.length === 0) {
    die(`FAIL ${source.id}: 0 chunks produced`);
  }

  const characters = chunks.reduce((s, c) => s + c.text.length, 0);
  console.log(`  ${source.id.padEnd(22)} pages_used=${pagesUsed} chunks=${chunks.length} chars=${characters}`);

  return {
    chunks,
    sourceUpdate: {
      sha256: digest,
      bytes: size,
      pages: totalPages,
      fetched_at: fetched,
    },
    htmlText,
  };
}

function statsFor(chunks: Chunk[]): { max: number; min: number; mean: number; hist: number[] } {
  const lens = chunks.map((c) => c.text.length);
  const max = lens.reduce((a, b) => Math.max(a, b), 0);
  const min = lens.reduce((a, b) => Math.min(a, b), Number.POSITIVE_INFINITY);
  const mean = lens.length > 0 ? Math.round(lens.reduce((a, b) => a + b, 0) / lens.length) : 0;
  const hist = HISTOGRAM_BUCKETS.map(() => 0);
  for (const L of lens) {
    for (let i = 0; i < HISTOGRAM_BUCKETS.length; i += 1) {
      const [lo, hi] = HISTOGRAM_BUCKETS[i];
      if (L >= lo && L < hi) {
        hist[i] += 1;
        break;
      }
    }
  }
  return { max, min, mean, hist };
}

async function main() {
  console.log("ingest v0.1.0 (manifest v1)");
  const manifest: Manifest = JSON.parse(readFileSync(SOURCES_PATH, "utf8"));
  if (manifest.manifestVersion !== 1) die(`FAIL: unsupported manifestVersion ${manifest.manifestVersion}`);

  type Row = {
    id: string;
    kind: "pdf" | "html";
    pagesUsed: number;
    chunks: number;
    chars: number;
    max: number;
    min: number;
    mean: number;
    hist: number[];
    htmlText?: string;
  };
  const rows: Row[] = [];
  const allChunks: Chunk[] = [];

  for (const source of manifest.sources) {
    console.log(`- ${source.id} (${source.kind}) "${source.short}"`);
    const { chunks, sourceUpdate, htmlText } = await ingestSource(source);
    Object.assign(source, sourceUpdate);
    allChunks.push(...chunks);
    const pagesUsed = source.kind === "pdf"
      ? (source.page_range ? source.page_range[1] - source.page_range[0] + 1 : (source.pages ?? 0))
      : 1;
    const st = statsFor(chunks);
    rows.push({
      id: source.id,
      kind: source.kind,
      pagesUsed,
      chunks: chunks.length,
      chars: chunks.reduce((s, c) => s + c.text.length, 0),
      max: st.max,
      min: st.min,
      mean: st.mean,
      hist: st.hist,
      htmlText,
    });
  }

  const totalChars = allChunks.reduce((s, c) => s + c.text.length, 0);
  if (totalChars <= 400_000) {
    die(`FAIL: total corpus chars ${totalChars} does not exceed 400,000`);
  }

  const violators = allChunks.filter((c) => c.text.length > MAX_CHUNK_CHARS || c.text.length < MIN_CHUNK_CHARS);
  if (violators.length > 0) {
    for (const v of violators.slice(0, 5)) {
      console.error(`  offender ${v.id} length=${v.text.length}`);
    }
    die(`FAIL: ${violators.length} chunk(s) outside [${MIN_CHUNK_CHARS}, ${MAX_CHUNK_CHARS}] characters`);
  }

  const corpus: Corpus = {
    generated_at: new Date().toISOString(),
    manifestVersion: 1,
    chunks: allChunks,
  };
  writeFileSync(CORPUS_PATH, JSON.stringify(corpus, null, 2) + "\n");
  writeFileSync(SOURCES_PATH, JSON.stringify(manifest, null, 2) + "\n");

  console.log("");
  console.log("SUMMARY");
  console.log("id                     | pages | chunks | characters | max  | mean");
  console.log("---------------------- | ----- | ------ | ---------- | ---- | ----");
  for (const r of rows) {
    console.log(
      `${r.id.padEnd(22)} | ${String(r.pagesUsed).padStart(5)} | ${String(r.chunks).padStart(6)} | ${String(r.chars).padStart(10)} | ${String(r.max).padStart(4)} | ${String(r.mean).padStart(4)}`,
    );
  }
  console.log("---------------------- | ----- | ------ | ---------- | ---- | ----");
  const allMax = rows.reduce((a, r) => Math.max(a, r.max), 0);
  const allMean = Math.round(allChunks.reduce((s, c) => s + c.text.length, 0) / allChunks.length);
  console.log(
    `total                  |       | ${String(allChunks.length).padStart(6)} | ${String(totalChars).padStart(10)} | ${String(allMax).padStart(4)} | ${String(allMean).padStart(4)}`,
  );

  console.log("");
  console.log(`chunk-length histogram (buckets: [40,320) [320,600) [600,880) [880,1160) [1160,${MAX_CHUNK_CHARS}]):`);
  for (const r of rows) {
    console.log(`  ${r.id.padEnd(22)} ${r.hist.map((n) => String(n).padStart(4)).join(" ")}`);
  }

  const htmlRows = rows.filter((r) => r.kind === "html");
  if (htmlRows.length > 0) {
    console.log("");
    console.log("HTML BOUNDARIES (first 200 chars and last 200 chars of extracted text, per source)");
    for (const r of htmlRows) {
      const t = r.htmlText ?? "";
      console.log("");
      console.log(`- ${r.id}: chars=${t.length}`);
      console.log(`  FIRST 200: ${JSON.stringify(t.slice(0, 200))}`);
      console.log(`  LAST 200:  ${JSON.stringify(t.slice(-200))}`);
    }
  }

  console.log("");
  console.log(`wrote ${path.relative(ROOT, CORPUS_PATH)} and updated ${path.relative(ROOT, SOURCES_PATH)}`);
}

main().catch((e) => die(`FAIL: ${e instanceof Error ? e.stack ?? e.message : String(e)}`));
