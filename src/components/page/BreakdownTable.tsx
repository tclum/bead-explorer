import { formatCount } from "@/lib/format";
import type { PageBreakdown, PageBreakdownRow, PageItem } from "@/lib/types";
import { RowReceipts } from "./source";

function BarRow({
  breakdownKey,
  row,
  denom,
}: {
  breakdownKey: string;
  row: PageBreakdownRow;
  denom: number;
}) {
  const pct = denom > 0 ? Math.max(1, Math.round((row.value / denom) * 100)) : 0;
  return (
    <tr
      className="border-t border-ink-800"
      data-row={`${breakdownKey}|${row.label}|${formatCount(row.value)}`}
    >
      <th
        scope="row"
        className="w-[45%] px-2 py-2 text-left align-top text-paper"
      >
        {row.label}
      </th>
      <td className="px-2 py-2 align-middle">
        <div
          className="h-2 w-full overflow-hidden rounded bg-ink-800"
          role="presentation"
        >
          <div className="h-2 rounded bg-teal" style={{ width: `${pct}%` }} />
        </div>
      </td>
      <td className="w-[15%] px-2 py-2 text-right align-top font-mono tabular-nums text-paper">
        {formatCount(row.value)}
      </td>
    </tr>
  );
}

function SumLine({
  breakdown,
  items,
}: {
  breakdown: PageBreakdown;
  items: PageItem[];
}) {
  const sum = breakdown.rows.reduce((n, r) => n + r.value, 0);
  if (breakdown.total_key === undefined) {
    return (
      <p className="mt-3 text-sm text-paper-2">
        Rows sum to {formatCount(sum)}.
      </p>
    );
  }
  const item = items.find((it) => it.key === breakdown.total_key);
  const totalValue =
    item && typeof item.value === "number" ? item.value : null;
  if (totalValue === null) {
    return (
      <p className="mt-3 text-sm text-paper-2">
        Rows sum to {formatCount(sum)}.
      </p>
    );
  }
  if (sum === totalValue) {
    return (
      <p className="mt-3 text-sm text-paper-2">
        Rows sum to {formatCount(sum)}, the stated total.
      </p>
    );
  }
  return (
    <p className="mt-3 text-sm text-amber">
      Rows sum to {formatCount(sum)} against a stated total of{" "}
      {formatCount(totalValue)}.
      {breakdown.note ? ` ${breakdown.note}` : ""}
    </p>
  );
}

export default function BreakdownTable({
  breakdown,
  items,
}: {
  breakdown: PageBreakdown;
  items: PageItem[];
}) {
  const denom = breakdown.rows.reduce(
    (m, r) => (r.value > m ? r.value : m),
    0,
  );
  return (
    <div className="rounded border border-ink-800 bg-ink-900 p-5">
      <h3 className="font-serif text-lg font-medium text-paper">
        {breakdown.title}
      </h3>
      <div className="mt-3 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">{breakdown.title}</caption>
          <tbody>
            {breakdown.rows.map((r) => (
              <BarRow
                key={r.label}
                breakdownKey={breakdown.key}
                row={r}
                denom={denom}
              />
            ))}
          </tbody>
        </table>
      </div>
      <SumLine breakdown={breakdown} items={items} />
      <RowReceipts label={breakdown.title} rows={breakdown.rows} />
    </div>
  );
}
