import type { VerifiedCitation } from "@/lib/types";

export default function Receipts({ citations }: { citations: VerifiedCitation[] }) {
  if (citations.length === 0) return null;
  return (
    <ul className="mt-4 space-y-3 text-sm">
      {citations.map((c, i) => (
        <li
          key={`${c.passage_id}-${i}`}
          className="rounded border-l-2 border-teal bg-ink-950 px-3 py-2"
        >
          <div className="text-xs text-paper-3">
            <a
              className="font-mono text-teal hover:underline"
              href={c.page_url}
              target="_blank"
              rel="noopener noreferrer"
            >
              {c.doc} p.{c.page}
            </a>
          </div>
          <div className="mt-1 whitespace-pre-wrap break-words font-mono text-paper">
            “{c.quote}”
          </div>
        </li>
      ))}
    </ul>
  );
}
