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
      <details className="mt-2 text-xs text-zinc-400">
        <summary className="cursor-pointer select-none hover:text-zinc-200">Receipt</summary>
        <div className="mono mt-1 whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-900 p-2">
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
        {src.note ? <div className="mt-1">{src.note}</div> : null}
      </details>
    );
  }
  const src = item.source;
  const link = pageUrlFor(manifest, src.doc, src.page);
  return (
    <details className="mt-2 text-xs text-zinc-400">
      <summary className="cursor-pointer select-none hover:text-zinc-200">Receipt</summary>
      <div className="mono mt-1 whitespace-pre-wrap break-words rounded border border-zinc-800 bg-zinc-900 p-2">
        “{src.quote}”
      </div>
      {link ? (
        <a className="mt-1 inline-block text-sky-400 hover:text-sky-300" href={link.url} target="_blank" rel="noopener noreferrer">
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
    <section aria-labelledby="status-title" className="w-full">
      <h2 id="status-title" className="mb-3 text-lg font-semibold text-zinc-200">
        Program status
      </h2>
      <div className="grid grid-cols-1 gap-3 md:grid-cols-2 xl:grid-cols-3">
        {status.items.map((item) => (
          <div key={item.key} className="rounded border border-zinc-800 bg-zinc-900/60 p-4">
            <div className="text-xs uppercase tracking-wide text-zinc-500">{item.label}</div>
            <div className="mt-1 text-xl font-semibold text-zinc-50">{item.value}</div>
            {item.detail ? <div className="mt-1 text-sm text-zinc-400">{item.detail}</div> : null}
            <Receipt item={item} manifest={manifest} csvRows={csvRows} />
          </div>
        ))}
      </div>
    </section>
  );
}
