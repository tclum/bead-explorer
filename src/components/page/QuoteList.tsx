import type { PageWho } from "@/lib/types";
import { SourceLink } from "./source";

function WhoRow({ item }: { item: PageWho }) {
  return (
    <li className="rounded border border-ink-800 bg-ink-900 p-4">
      <div className="text-sm font-medium text-paper">{item.label}</div>
      <div className="mt-2 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-xs text-paper">
        “{item.source.quote}”
      </div>
      <SourceLink source={item.source} />
    </li>
  );
}

export default function QuoteList({ items }: { items: PageWho[] }) {
  return (
    <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
      {items.map((w) => (
        <WhoRow key={w.key} item={w} />
      ))}
    </ul>
  );
}
