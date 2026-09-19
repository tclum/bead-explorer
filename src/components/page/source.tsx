import { readFileSync } from "node:fs";
import path from "node:path";
import type { Manifest, PageSource } from "@/lib/types";

const manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/sources.json"), "utf8"),
) as Manifest;

export function pageUrlFor(
  doc: string,
  pageNum: number,
): { url: string; short: string } | null {
  const s = manifest.sources.find((x) => x.id === doc);
  if (!s) return null;
  const url = s.kind === "pdf" ? `${s.url}#page=${pageNum}` : s.url;
  return { url, short: s.short };
}

export function SourceLink({ source }: { source: PageSource }) {
  const link = pageUrlFor(source.doc, source.page);
  if (!link) return null;
  return (
    <a
      className="mt-2 inline-block font-mono text-teal hover:underline"
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
    >
      {link.short}, p.{source.page}
    </a>
  );
}

export function ReceiptBlock({ source }: { source: PageSource }) {
  return (
    <details className="mt-3 text-xs text-paper-3">
      <summary className="cursor-pointer select-none hover:text-paper-2">
        Receipt
      </summary>
      <div className="mt-2 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper">
        “{source.quote}”
      </div>
      <SourceLink source={source} />
    </details>
  );
}

export function RowReceipts({
  label,
  rows,
}: {
  label: string;
  rows: { label: string; source: PageSource }[];
}) {
  return (
    <details className="mt-3 text-xs text-paper-3">
      <summary className="cursor-pointer select-none hover:text-paper-2">
        Receipts ({rows.length})
      </summary>
      <ul className="mt-2 space-y-3" aria-label={`Receipts for ${label}`}>
        {rows.map((r) => (
          <li key={r.label}>
            <div className="text-paper-2">{r.label}</div>
            <div className="mt-1 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper">
              “{r.source.quote}”
            </div>
            <SourceLink source={r.source} />
          </li>
        ))}
      </ul>
    </details>
  );
}
