import { readFileSync } from "node:fs";
import path from "node:path";
import StatusPanel from "@/components/StatusPanel";
import GapPanel from "@/components/GapPanel";
import AskPanel from "@/components/AskPanel";
import CorpusList from "@/components/CorpusList";
import { loadFccMeta } from "@/lib/gaps";
import { formatCount } from "@/lib/format";
import type { Manifest } from "@/lib/types";

const BUILD_SHA = process.env.VERCEL_GIT_COMMIT_SHA ?? process.env.GIT_SHA ?? "dev";
const REPO_URL = "https://github.com/tclum/bead-explorer";
const PROVENANCE_URL = `${REPO_URL}#how-provenance-is-enforced`;

const corpus = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/corpus.json"), "utf8"),
) as { chunks: unknown[]; generated_at: string };
const manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/sources.json"), "utf8"),
) as Manifest;

function latestSourceFetchedAt(m: Manifest): string {
  let latest = "";
  for (const s of m.sources) {
    if (s.fetched_at && s.fetched_at > latest) latest = s.fetched_at;
  }
  if (!latest) throw new Error("page: no fetched_at across sources.json");
  return latest;
}

const CHUNK_COUNT = corpus.chunks.length;
const DOC_COUNT = manifest.sources.length;
const CORPUS_FETCHED = latestSourceFetchedAt(manifest).slice(0, 10);
const FCC_RETRIEVED = loadFccMeta().retrieved_at.slice(0, 10);

function Divider() {
  return (
    <hr className="my-10 md:my-16 border-0 border-t border-ink-800" aria-hidden />
  );
}

export default function Home() {
  const shaShort = BUILD_SHA === "dev" ? "dev" : BUILD_SHA.slice(0, 7);
  const shaHref =
    BUILD_SHA === "dev" ? null : `${REPO_URL}/commit/${BUILD_SHA}`;

  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 py-10 md:py-16">
      <header className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-paper md:text-5xl">
          Hawaiʻi BEAD Explorer
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-paper-2">
          A weekend exploration of Hawaiʻi&apos;s public BEAD documents. Answers
          are grounded only in the loaded sources; every value shows its
          receipt.
        </p>
        <p className="text-sm text-paper-3">
          Not affiliated with the State of Hawaiʻi, the University of Hawaiʻi,
          NTIA, the FCC, or any vendor.
        </p>
      </header>

      <Divider />

      <section aria-labelledby="how-title">
        <h2 id="how-title" className="mb-6 font-serif text-2xl font-medium text-paper">
          <a href={PROVENANCE_URL} className="text-paper hover:text-teal">
            How an answer is made
          </a>
        </h2>
        <ol className="grid grid-cols-1 gap-4 md:grid-cols-3">
          <li className="rounded border border-ink-800 bg-ink-900 p-4">
            <div className="text-xs uppercase tracking-wide text-paper-3">
              1 · Retrieve
            </div>
            <p className="mt-2 text-sm leading-relaxed text-paper-2">
              BM25 over {formatCount(CHUNK_COUNT)} chunks from {DOC_COUNT}{" "}
              public documents.
            </p>
          </li>
          <li className="rounded border border-ink-800 bg-ink-900 p-4">
            <div className="text-xs uppercase tracking-wide text-paper-3">
              2 · Cite
            </div>
            <p className="mt-2 text-sm leading-relaxed text-paper-2">
              The model answers only with verbatim quotes from those passages.
            </p>
          </li>
          <li className="rounded border border-ink-800 bg-ink-900 p-4">
            <div className="text-xs uppercase tracking-wide text-paper-3">
              3 · Verify
            </div>
            <p className="mt-2 text-sm leading-relaxed text-paper-2">
              The server checks every quote and every figure; what it can&apos;t
              prove, it withholds and says so.
            </p>
          </li>
        </ol>
      </section>

      <Divider />

      <StatusPanel />

      <Divider />

      <GapPanel />

      <Divider />

      <AskPanel />

      <Divider />

      <CorpusList />

      <Divider />

      <footer className="flex flex-col gap-2 text-xs text-paper-3">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <a
            className="text-teal hover:underline"
            href={REPO_URL}
            target="_blank"
            rel="noopener noreferrer"
          >
            github.com/tclum/bead-explorer
          </a>
          <span aria-hidden>·</span>
          <span className="font-mono">
            build{" "}
            {shaHref ? (
              <a
                className="text-teal hover:underline"
                href={shaHref}
                target="_blank"
                rel="noopener noreferrer"
              >
                {shaShort}
              </a>
            ) : (
              <span>{shaShort}</span>
            )}
          </span>
        </div>
        <div>
          Corpus fetched {CORPUS_FETCHED} · FCC BDC via Esri Living Atlas
          republication, retrieved {FCC_RETRIEVED}
        </div>
      </footer>
    </main>
  );
}
