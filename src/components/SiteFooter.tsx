import { readFileSync } from "node:fs";
import path from "node:path";
import { BUILD_SHA } from "@/lib/build";
import { loadFccMeta } from "@/lib/gaps";
import type { Manifest } from "@/lib/types";

const REPO_URL = "https://github.com/tclum/bead-explorer";

function latestSourceFetchedAt(m: Manifest): string {
  let latest = "";
  for (const s of m.sources) {
    if (s.fetched_at && s.fetched_at > latest) latest = s.fetched_at;
  }
  if (!latest) throw new Error("SiteFooter: no fetched_at across sources.json");
  return latest;
}

export default function SiteFooter() {
  const manifest = JSON.parse(
    readFileSync(path.join(process.cwd(), "data/sources.json"), "utf8"),
  ) as Manifest;
  const corpusFetched = latestSourceFetchedAt(manifest).slice(0, 10);
  const fccRetrieved = loadFccMeta().retrieved_at.slice(0, 10);
  const shaShort = BUILD_SHA === "dev" ? "dev" : BUILD_SHA.slice(0, 7);
  const shaHref = BUILD_SHA === "dev" ? null : `${REPO_URL}/commit/${BUILD_SHA}`;

  return (
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
        Corpus fetched {corpusFetched} · FCC BDC via Esri Living Atlas
        republication, retrieved {fccRetrieved}
      </div>
    </footer>
  );
}
