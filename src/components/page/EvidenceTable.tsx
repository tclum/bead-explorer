import type { PageEvidence } from "@/lib/types";
import { pageUrlFor } from "./source";

function EvidenceRow({ item }: { item: PageEvidence }) {
  const link = pageUrlFor(item.source.doc, item.source.page);
  return (
    <tr className="border-t border-ink-800 align-top">
      <th
        scope="row"
        className="w-[30%] px-3 py-3 text-left text-sm font-medium text-paper"
      >
        {item.type}
      </th>
      <td className="px-3 py-3 text-sm text-paper">
        <div className="whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono">
          “{item.source.quote}”
        </div>
      </td>
      <td className="w-[20%] px-3 py-3 text-right align-top">
        {link ? (
          <a
            className="font-mono text-xs text-teal hover:underline"
            href={link.url}
            target="_blank"
            rel="noopener noreferrer"
          >
            {link.short}, p.{item.source.page}
          </a>
        ) : null}
      </td>
    </tr>
  );
}

export default function EvidenceTable({
  items,
  typeHeader,
  quoteHeader,
  caption,
}: {
  items: PageEvidence[];
  typeHeader: string;
  quoteHeader: string;
  caption: string;
}) {
  return (
    <div className="overflow-x-auto rounded border border-ink-800 bg-ink-900">
      <table className="w-full text-left">
        <caption className="sr-only">{caption}</caption>
        <thead className="text-xs uppercase tracking-wide text-paper-3">
          <tr>
            <th scope="col" className="px-3 py-2">
              {typeHeader}
            </th>
            <th scope="col" className="px-3 py-2">
              {quoteHeader}
            </th>
            <th scope="col" className="px-3 py-2 text-right">
              Source
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((e) => (
            <EvidenceRow key={e.type} item={e} />
          ))}
        </tbody>
      </table>
    </div>
  );
}
