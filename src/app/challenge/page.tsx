import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AskPanel, { type AskChip } from "@/components/AskPanel";
import { formatCount } from "@/lib/format";
import type {
  Manifest,
  PageBreakdown,
  PageBreakdownRow,
  PageEvidence,
  PageFile,
  PageItem,
  PagePhase,
  PageSource,
  PageWho,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Challenge process · Hawaiʻi BEAD Explorer",
};

const page = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/pages/challenge.json"), "utf8"),
) as PageFile;

const manifest = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/sources.json"), "utf8"),
) as Manifest;

const CHIPS: AskChip[] = [
  {
    id: "f10",
    label: "Challenges by type",
    question:
      "What kinds of challenges were filed in Hawaiʻi's BEAD challenge process, and how many of each?",
  },
  {
    id: "f11",
    label: "Evidence for an availability challenge",
    question:
      "What evidence is required for an availability challenge in Hawaiʻi's BEAD challenge process?",
  },
  {
    id: "f03",
    label: "Challenge process dates",
    question:
      "What were the dates of the challenge, rebuttal, and final determination phases of Hawaiʻi's BEAD challenge process?",
  },
];

function pageUrlFor(
  m: Manifest,
  doc: string,
  pageNum: number,
): { url: string; short: string } | null {
  const s = m.sources.find((x) => x.id === doc);
  if (!s) return null;
  const url = s.kind === "pdf" ? `${s.url}#page=${pageNum}` : s.url;
  return { url, short: s.short };
}

function SourceLink({ source }: { source: PageSource }) {
  const link = pageUrlFor(manifest, source.doc, source.page);
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

function ReceiptBlock({ source }: { source: PageSource }) {
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

function RowReceipts({
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

function PhaseCard({ phase }: { phase: PagePhase }) {
  return (
    <div className="flex flex-col rounded border border-ink-800 bg-ink-900 p-5">
      <div className="text-xs uppercase tracking-wide text-paper-3">
        {phase.label}
      </div>
      <div className="mt-2 font-serif text-xl leading-snug text-paper">
        {phase.value}
      </div>
      <ReceiptBlock source={phase.source} />
    </div>
  );
}

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
          <div
            className="h-2 rounded bg-teal"
            style={{ width: `${pct}%` }}
          />
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
  totalItemValue,
}: {
  breakdown: PageBreakdown;
  totalItemValue: number;
}) {
  const sum = breakdown.rows.reduce((n, r) => n + r.value, 0);
  const matches = sum === totalItemValue;
  if (matches) {
    return (
      <p className="mt-3 text-sm text-paper-2">
        Rows sum to {formatCount(sum)}, the stated total.
      </p>
    );
  }
  return (
    <p className="mt-3 text-sm text-amber">
      Rows sum to {formatCount(sum)} against a stated total of{" "}
      {formatCount(totalItemValue)}.
      {breakdown.note ? ` ${breakdown.note}` : ""}
    </p>
  );
}

function BreakdownTable({
  breakdown,
  totalItemValue,
}: {
  breakdown: PageBreakdown;
  totalItemValue: number;
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
      <SumLine breakdown={breakdown} totalItemValue={totalItemValue} />
      <RowReceipts label={breakdown.title} rows={breakdown.rows} />
    </div>
  );
}

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

function EvidenceRow({ item }: { item: PageEvidence }) {
  const link = pageUrlFor(manifest, item.source.doc, item.source.page);
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

function Divider() {
  return (
    <hr
      className="my-10 md:my-16 border-0 border-t border-ink-800"
      aria-hidden
    />
  );
}

export default function ChallengePage() {
  const totalItem = page.items.find((i) => i.key === "total");
  if (!totalItem || typeof totalItem.value !== "number") {
    throw new Error(
      "challenge page: items[total] must exist with a numeric value",
    );
  }
  const totalItemValue = totalItem.value;

  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 py-10 md:py-16">
      <SiteHeader current="/challenge" />

      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-paper md:text-5xl">
          {page.title}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-paper-2">
          How Hawaiʻi corrected the map before any money was awarded: who could
          file, what evidence counted, and how every challenge was resolved.
        </p>
      </div>

      <Divider />

      <section aria-labelledby="tiles-title">
        <h2 id="tiles-title" className="sr-only">
          Headline figures
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
          {page.items.map((it) => (
            <Tile key={it.key} item={it} />
          ))}
        </div>
      </section>

      <Divider />

      <section aria-labelledby="phases-title">
        <h2
          id="phases-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          Three phases
        </h2>
        <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
          {page.phases.map((p) => (
            <PhaseCard key={p.key} phase={p} />
          ))}
        </div>
      </section>

      <Divider />

      <section aria-labelledby="breakdowns-title">
        <h2
          id="breakdowns-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          One total, three ways
        </h2>
        <div className="grid grid-cols-1 gap-6">
          {page.breakdowns.map((b) => (
            <BreakdownTable
              key={b.key}
              breakdown={b}
              totalItemValue={totalItemValue}
            />
          ))}
        </div>
      </section>

      <Divider />

      <section aria-labelledby="who-title">
        <h2
          id="who-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          Who could file
        </h2>
        <ul className="grid grid-cols-1 gap-4 md:grid-cols-2">
          {page.who.map((w) => (
            <WhoRow key={w.key} item={w} />
          ))}
        </ul>
      </section>

      <Divider />

      <section aria-labelledby="evidence-title">
        <h2
          id="evidence-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          What evidence counted
        </h2>
        <div className="overflow-x-auto rounded border border-ink-800 bg-ink-900">
          <table className="w-full text-left">
            <caption className="sr-only">
              Evidence required for each challenge type
            </caption>
            <thead className="text-xs uppercase tracking-wide text-paper-3">
              <tr>
                <th scope="col" className="px-3 py-2">
                  Challenge type
                </th>
                <th scope="col" className="px-3 py-2">
                  Requirement
                </th>
                <th scope="col" className="px-3 py-2 text-right">
                  Source
                </th>
              </tr>
            </thead>
            <tbody>
              {page.evidence.map((e) => (
                <EvidenceRow key={e.type} item={e} />
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <Divider />

      <AskPanel chips={CHIPS} />

      <Divider />

      <SiteFooter />
    </main>
  );
}
