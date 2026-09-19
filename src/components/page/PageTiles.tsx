import { formatCount } from "@/lib/format";
import type { PageItem } from "@/lib/types";
import { ReceiptBlock } from "./source";

function Tile({ item }: { item: PageItem }) {
  const dataItem =
    typeof item.value === "number"
      ? `${item.key}|${formatCount(item.value)}`
      : undefined;
  return (
    <div
      className="flex flex-col rounded border border-ink-800 bg-ink-900 p-5"
      data-item={dataItem}
    >
      <div className="text-xs uppercase tracking-wide text-paper-3">
        {item.label}
      </div>
      <div className="mt-2 font-serif text-2xl font-semibold leading-tight text-paper">
        {typeof item.value === "number" ? formatCount(item.value) : item.value}
      </div>
      <ReceiptBlock source={item.source} />
    </div>
  );
}

export default function PageTiles({ items }: { items: PageItem[] }) {
  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
      {items.map((it) => (
        <Tile key={it.key} item={it} />
      ))}
    </div>
  );
}
