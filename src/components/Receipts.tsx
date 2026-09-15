import type { VerifiedCitation } from "@/lib/types";

export default function Receipts({ citations }: { citations: VerifiedCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <ul className="mt-3 space-y-2 text-sm">
      {citations.map((c, i) => (
        <li key={`${c.passage_id}-${i}`} className="rounded border border-zinc-800 bg-zinc-900/70 p-2">
          <div className="text-xs text-zinc-400">
            <a
              className="text-sky-400 hover:text-sky-300"
              href={c.page_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.doc} p.{c.page}
            </a>
          </div>
          <div className="mono mt-1 whitespace-pre-wrap break-words text-zinc-100">“{c.quote}”</div>
        </li>
      ))}
    </ul>
  );
}
