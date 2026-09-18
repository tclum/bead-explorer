import { readFileSync } from "node:fs";
import path from "node:path";
import type { Manifest, StatusFile, StatusItem } from "@/lib/types";

function readJson<T>(rel: string): T {
  return JSON.parse(readFileSync(path.join(process.cwd(), rel), "utf8")) as T;
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

function pageUrlFor(manifest: Manifest, doc: string, page: number): { url: string; short: string } | null {
  const s = manifest.sources.find((x) => x.id === doc);
  if (!s) return null;
  const url = s.kind === "pdf" ? `${s.url}#page=${page}` : s.url;
  return { url, short: s.short };
}

function Receipt({ item, manifest, csvRows }: { item: StatusItem; manifest: Manifest; csvRows: Record<string, string>[] }) {
  if ("csv" in item.source) {
    const src = item.source;
    const row = csvRows.find((r) => Object.entries(src.row).every(([k, v]) => r[k] === v));
    return (
      <details className="mt-3 text-xs text-paper-3">
        <summary className="cursor-pointer select-none hover:text-paper-2">Receipt</summary>
        <div className="mt-2 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper-2">
          {src.csv}
          {"\n"}row: {JSON.stringify(src.row)}
          {"\n"}columns: {Object.entries(src.columns)
            .map(([k, v]) => `${k}=${v}`)
            .join(", ")}
          {row ? (
            <>
              {"\n"}pulled: {Object.keys(src.columns)
                .map((k) => `${k}=${row[k]}`)
                .join(", ")}
            </>
          ) : null}
        </div>
        {src.note ? <div className="mt-2 text-paper-3">{src.note}</div> : null}
      </details>
    );
  }
  const src = item.source;
  const link = pageUrlFor(manifest, src.doc, src.page);
  return (
    <details className="mt-3 text-xs text-paper-3">
      <summary className="cursor-pointer select-none hover:text-paper-2">Receipt</summary>
      <div className="mt-2 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper">
        “{src.quote}”
      </div>
      {link ? (
        <a
          className="mt-2 inline-block font-mono text-teal hover:underline"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.short}, p.{src.page}
        </a>
      ) : null}
    </details>
  );
}

export default function StatusPanel() {
  const status = readJson<StatusFile>("data/status.json");
  const manifest = readJson<Manifest>("data/sources.json");
  const csvText = readFileSync(path.join(process.cwd(), "data", "fcc-hi-summary.csv"), "utf8");
  const csvRows = parseCsv(csvText);
  return (
    <section aria-labelledby="status-title">
      <h2 id="status-title" className="mb-6 font-serif text-2xl font-medium text-paper">
        Program status
      </h2>
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
        {status.items.map((item) => (
          <div
            key={item.key}
            className="flex flex-col rounded border border-ink-800 bg-ink-900 p-5"
          >
            <div className="text-xs uppercase tracking-wide text-paper-3">
              {item.label}
            </div>
            <div className="mt-2 font-serif text-2xl font-semibold leading-tight text-paper">
              {item.value}
            </div>
            {item.detail ? (
              <div className="mt-2 text-sm leading-relaxed text-paper-2">
                {item.detail}
              </div>
            ) : null}
            <Receipt item={item} manifest={manifest} csvRows={csvRows} />
          </div>
        ))}
      </div>
    </section>
  );
}
