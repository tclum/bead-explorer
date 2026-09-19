import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import PrintButton from "@/components/PrintButton";
import { pageUrlFor } from "@/components/page/source";
import { BUILD_SHA } from "@/lib/build";
import { loadBeadMeta, loadFccMeta, loadGeoMeta } from "@/lib/gaps";
import { formatCount } from "@/lib/format";
import type {
  Manifest,
  PageEvidence,
  PageFile,
  PageSource,
  PageWho,
  StatusFile,
  StatusItem,
} from "@/lib/types";

export const metadata: Metadata = {
  title: "Receipted report · Hawaiʻi BEAD Explorer",
};

const REPO_URL = "https://github.com/tclum/bead-explorer";
const PAGE_ORDER = ["challenge", "selection", "oversight"] as const;

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

function latestSourceFetchedAt(m: Manifest): string {
  let latest = "";
  for (const s of m.sources) {
    if (s.fetched_at && s.fetched_at > latest) latest = s.fetched_at;
  }
  if (!latest) throw new Error("report: no fetched_at across sources.json");
  return latest;
}

function displayValue(value: string | number): string {
  return typeof value === "number" ? formatCount(value) : value;
}

function ReceiptQuote({ source }: { source: PageSource }) {
  const link = pageUrlFor(source.doc, source.page);
  return (
    <div>
      <div className="whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-sm text-paper">
        “{source.quote}”
      </div>
      {link ? (
        <a
          className="mt-1 inline-block font-mono text-xs text-teal hover:underline"
          href={link.url}
          target="_blank"
          rel="noopener noreferrer"
        >
          {link.short}, p.{source.page}
        </a>
      ) : null}
    </div>
  );
}

function StatusRow({
  item,
  csvRows,
  fccMetaRetrieved,
}: {
  item: StatusItem;
  csvRows: Record<string, string>[];
  fccMetaRetrieved: string;
}) {
  const attr = `status|items|${item.key}`;
  return (
    <div
      data-receipt={attr}
      className="border-t border-ink-800 py-4"
    >
      <div className="text-xs uppercase tracking-wide text-paper-3">
        {item.label}
      </div>
      <div className="mt-1 font-serif text-lg text-paper">{item.value}</div>
      {item.detail ? (
        <div className="mt-1 text-sm text-paper-2">{item.detail}</div>
      ) : null}
      <div className="mt-3">
        {"csv" in item.source ? (
          (() => {
            const src = item.source;
            const row = csvRows.find((r) =>
              Object.entries(src.row).every(([k, v]) => r[k] === v),
            );
            return (
              <div className="whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-xs text-paper-2">
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
                {"\n"}retrieved: {fccMetaRetrieved}
                {src.note ? `\nnote: ${src.note}` : ""}
              </div>
            );
          })()
        ) : (
          <ReceiptQuote source={item.source} />
        )}
      </div>
    </div>
  );
}

function ItemsBlock({ page, pageData }: { page: string; pageData: PageFile }) {
  if (pageData.items.length === 0) return null;
  return (
    <div>
      <h3 className="mb-3 font-serif text-lg font-medium text-paper">Items</h3>
      <div>
        {pageData.items.map((it) => (
          <div
            key={it.key}
            data-receipt={`${page}|items|${it.key}`}
            className="border-t border-ink-800 py-3"
          >
            <div className="text-xs uppercase tracking-wide text-paper-3">
              {it.label}
            </div>
            <div className="mt-1 font-serif text-base text-paper">
              {displayValue(it.value)}
            </div>
            <div className="mt-2">
              <ReceiptQuote source={it.source} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PhasesBlock({ page, pageData }: { page: string; pageData: PageFile }) {
  if (pageData.phases.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="mb-3 font-serif text-lg font-medium text-paper">
        Timeline
      </h3>
      <div>
        {pageData.phases.map((ph) => (
          <div
            key={ph.key}
            data-receipt={`${page}|phases|${ph.key}`}
            className="border-t border-ink-800 py-3"
          >
            <div className="text-xs uppercase tracking-wide text-paper-3">
              {ph.label}
            </div>
            <div className="mt-1 font-serif text-base text-paper">
              {ph.value}
            </div>
            <div className="mt-2">
              <ReceiptQuote source={ph.source} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function BreakdownsBlock({
  page,
  pageData,
}: {
  page: string;
  pageData: PageFile;
}) {
  if (pageData.breakdowns.length === 0) return null;
  return (
    <div className="mt-8">
      <h3 className="mb-3 font-serif text-lg font-medium text-paper">
        Breakdowns
      </h3>
      {pageData.breakdowns.map((b) => {
        const sum = b.rows.reduce((n, r) => n + r.value, 0);
        const item =
          b.total_key !== undefined
            ? pageData.items.find((it) => it.key === b.total_key)
            : undefined;
        const totalValue =
          item && typeof item.value === "number" ? item.value : null;
        let sumLine: string;
        if (b.total_key === undefined || totalValue === null) {
          sumLine = `Rows sum to ${formatCount(sum)}.`;
        } else if (sum === totalValue) {
          sumLine = `Rows sum to ${formatCount(sum)}, the stated total.`;
        } else {
          sumLine = `Rows sum to ${formatCount(sum)} against a stated total of ${formatCount(totalValue)}.${b.note ? ` ${b.note}` : ""}`;
        }
        return (
          <div key={b.key} className="mt-4">
            <h4 className="font-serif text-base font-medium text-paper">
              {b.title}
            </h4>
            <div>
              {b.rows.map((row, idx) => (
                <div
                  key={`${b.key}:${idx}`}
                  data-receipt={`${page}|rows|${b.key}:${idx}`}
                  className="border-t border-ink-800 py-3"
                >
                  <div className="flex items-baseline justify-between gap-4">
                    <div className="text-sm text-paper">{row.label}</div>
                    <div className="font-mono text-sm tabular-nums text-paper">
                      {formatCount(row.value)}
                    </div>
                  </div>
                  <div className="mt-2">
                    <ReceiptQuote source={row.source} />
                  </div>
                </div>
              ))}
            </div>
            <p className="mt-2 text-sm text-paper-2">{sumLine}</p>
          </div>
        );
      })}
    </div>
  );
}

function groupsPresent(items: { group?: string }[]): string[] {
  const groups = new Set<string>();
  for (const it of items) if (it.group) groups.add(it.group);
  return Array.from(groups);
}

function WhoBlock({ page, pageData }: { page: string; pageData: PageFile }) {
  if (pageData.who.length === 0) return null;
  const groups = groupsPresent(pageData.who);
  const buckets: { heading: string | null; entries: PageWho[] }[] =
    groups.length > 0
      ? groups.map((g) => ({
          heading: g,
          entries: pageData.who.filter((w) => w.group === g),
        }))
      : [{ heading: null, entries: pageData.who }];
  return (
    <div className="mt-8">
      <h3 className="mb-3 font-serif text-lg font-medium text-paper">Quotes</h3>
      {buckets.map((bucket, bi) => (
        <div key={bucket.heading ?? `bucket-${bi}`} className="mt-3">
          {bucket.heading ? (
            <h4 className="font-serif text-base font-medium text-paper-2">
              {bucket.heading}
            </h4>
          ) : null}
          <div>
            {bucket.entries.map((w) => (
              <div
                key={w.key}
                data-receipt={`${page}|who|${w.key}`}
                className="border-t border-ink-800 py-3"
              >
                <div className="text-sm font-medium text-paper">{w.label}</div>
                <div className="mt-2">
                  <ReceiptQuote source={w.source} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function EvidenceBlock({
  page,
  pageData,
}: {
  page: string;
  pageData: PageFile;
}) {
  if (pageData.evidence.length === 0) return null;
  const groups = groupsPresent(pageData.evidence);
  const buckets: {
    heading: string | null;
    entries: { e: PageEvidence; index: number }[];
  }[] = groups.length > 0
    ? groups.map((g) => ({
        heading: g,
        entries: pageData.evidence
          .map((e, index) => ({ e, index }))
          .filter((x) => x.e.group === g),
      }))
    : [
        {
          heading: null,
          entries: pageData.evidence.map((e, index) => ({ e, index })),
        },
      ];
  return (
    <div className="mt-8">
      <h3 className="mb-3 font-serif text-lg font-medium text-paper">Rules</h3>
      {buckets.map((bucket, bi) => (
        <div key={bucket.heading ?? `bucket-${bi}`} className="mt-3">
          {bucket.heading ? (
            <h4 className="font-serif text-base font-medium text-paper-2">
              {bucket.heading}
            </h4>
          ) : null}
          <div>
            {bucket.entries.map(({ e, index }) => (
              <div
                key={`${e.type}-${index}`}
                data-receipt={`${page}|evidence|${index}`}
                className="border-t border-ink-800 py-3"
              >
                <div className="text-sm font-medium text-paper">{e.type}</div>
                <div className="mt-2">
                  <ReceiptQuote source={e.source} />
                </div>
              </div>
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

function ComputedBlock({
  page,
  pageData,
}: {
  page: string;
  pageData: PageFile;
}) {
  if (!pageData.calculator) return null;
  return (
    <div className="mt-8">
      <h3 className="mb-3 font-serif text-lg font-medium text-paper">
        Worked examples
      </h3>
      <div>
        {pageData.calculator.expected.map((exp) => (
          <div
            key={exp.id}
            data-receipt={`${page}|computed|${exp.id}`}
            className="border-t border-ink-800 py-3"
          >
            <div className="flex items-baseline justify-between gap-4">
              <div className="font-mono text-sm text-paper-2">{exp.id}</div>
              <div className="font-mono text-sm tabular-nums text-paper">
                {exp.value}
              </div>
            </div>
            <div className="mt-2">
              <ReceiptQuote source={exp.source} />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function PageSection({
  pageData,
}: {
  pageData: PageFile;
}) {
  return (
    <section
      aria-labelledby={`section-${pageData.page}`}
      className="mt-12"
    >
      <h2
        id={`section-${pageData.page}`}
        className="mb-4 font-serif text-2xl font-medium text-paper"
      >
        {pageData.title}
      </h2>
      <ItemsBlock page={pageData.page} pageData={pageData} />
      <PhasesBlock page={pageData.page} pageData={pageData} />
      <BreakdownsBlock page={pageData.page} pageData={pageData} />
      <WhoBlock page={pageData.page} pageData={pageData} />
      <EvidenceBlock page={pageData.page} pageData={pageData} />
      <ComputedBlock page={pageData.page} pageData={pageData} />
    </section>
  );
}

function countReceipts(status: StatusFile, pages: PageFile[]): number {
  let n = status.items.length;
  for (const p of pages) {
    n += p.items.length;
    n += p.phases.length;
    for (const b of p.breakdowns) n += b.rows.length;
    n += p.who.length;
    n += p.evidence.length;
    if (p.calculator) n += p.calculator.expected.length;
  }
  return n;
}

export default function ReportPage() {
  const status = readJson<StatusFile>("data/status.json");
  const manifest = readJson<Manifest>("data/sources.json");
  const csvRows = parseCsv(
    readFileSync(path.join(process.cwd(), "data/fcc-hi-summary.csv"), "utf8"),
  );
  const pages: PageFile[] = PAGE_ORDER.map((name) =>
    readJson<PageFile>(`data/pages/${name}.json`),
  );
  const fccMeta = loadFccMeta();
  const beadMeta = loadBeadMeta();
  const geoMeta = loadGeoMeta();

  const corpusFetched = latestSourceFetchedAt(manifest).slice(0, 10);
  const fccRetrieved = fccMeta.retrieved_at.slice(0, 10);
  const shaShort = BUILD_SHA === "dev" ? "dev" : BUILD_SHA.slice(0, 7);
  const shaHref = BUILD_SHA === "dev" ? null : `${REPO_URL}/commit/${BUILD_SHA}`;

  const receiptCount = countReceipts(status, pages);

  return (
    <main
      className="mx-auto w-full max-w-[1120px] px-6 py-10 md:py-16"
      data-receipt-count={String(receiptCount)}
    >
      <SiteHeader current="/report" />

      <div className="flex flex-col gap-3">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-paper md:text-5xl">
          Receipted report
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-paper-2">
          Every figure and quoted commitment shown on this site, with its
          source.
        </p>
        <div className="font-mono text-xs text-paper-3">
          build{" "}
          {shaHref ? (
            <a
              className="text-teal hover:underline"
              href={shaHref}
              target="_blank"
              rel="noopener noreferrer"
            >
              {shaShort}
            </a>
          ) : (
            <span>{shaShort}</span>
          )}
          {" · corpus fetched "}
          {corpusFetched}
        </div>
        <div className="mt-2">
          <PrintButton />
        </div>
      </div>

      <section aria-labelledby="status-section" className="mt-12">
        <h2
          id="status-section"
          className="mb-4 font-serif text-2xl font-medium text-paper"
        >
          Program status
        </h2>
        <div>
          {status.items.map((item) => (
            <StatusRow
              key={item.key}
              item={item}
              csvRows={csvRows}
              fccMetaRetrieved={fccRetrieved}
            />
          ))}
        </div>
      </section>

      {pages.map((p) => (
        <PageSection key={p.page} pageData={p} />
      ))}

      <section aria-labelledby="sources-section" className="mt-12">
        <h2
          id="sources-section"
          className="mb-4 font-serif text-2xl font-medium text-paper"
        >
          Sources
        </h2>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">
              Corpus sources with retrieval metadata
            </caption>
            <thead className="text-xs uppercase tracking-wide text-paper-3">
              <tr>
                <th scope="col" className="px-2 py-2">Short</th>
                <th scope="col" className="px-2 py-2">Title</th>
                <th scope="col" className="px-2 py-2">Publisher</th>
                <th scope="col" className="px-2 py-2">Date</th>
                <th scope="col" className="px-2 py-2">URL</th>
                <th scope="col" className="px-2 py-2">sha256</th>
                <th scope="col" className="px-2 py-2">fetched_at</th>
              </tr>
            </thead>
            <tbody>
              {manifest.sources.map((s) => (
                <tr key={s.id} className="border-t border-ink-800 align-top">
                  <td className="px-2 py-2 text-paper">{s.short}</td>
                  <td className="px-2 py-2 text-paper">{s.title}</td>
                  <td className="px-2 py-2 text-paper-2">{s.publisher}</td>
                  <td className="px-2 py-2 font-mono text-xs text-paper-2">
                    {s.date ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs">
                    <a
                      href={s.url}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="text-teal hover:underline"
                    >
                      {s.url}
                    </a>
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-paper-3">
                    {s.sha256 ?? "—"}
                  </td>
                  <td className="px-2 py-2 font-mono text-xs text-paper-3">
                    {s.fetched_at ?? "—"}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <h3 className="mt-6 mb-3 font-serif text-lg font-medium text-paper">
          Datasets
        </h3>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <caption className="sr-only">Dataset retrieval metadata</caption>
            <thead className="text-xs uppercase tracking-wide text-paper-3">
              <tr>
                <th scope="col" className="px-2 py-2">Dataset</th>
                <th scope="col" className="px-2 py-2">Source URL</th>
                <th scope="col" className="px-2 py-2">sha256</th>
                <th scope="col" className="px-2 py-2">fetched_at</th>
                <th scope="col" className="px-2 py-2">Note</th>
              </tr>
            </thead>
            <tbody>
              <tr className="border-t border-ink-800 align-top">
                <td className="px-2 py-2 text-paper">FCC BDC summary</td>
                <td className="px-2 py-2 font-mono text-xs">
                  <a
                    href={fccMeta.queries.item}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal hover:underline"
                  >
                    {fccMeta.queries.item}
                  </a>
                </td>
                <td className="px-2 py-2 font-mono text-xs text-paper-3">—</td>
                <td className="px-2 py-2 font-mono text-xs text-paper-3">
                  {fccMeta.retrieved_at}
                </td>
                <td className="px-2 py-2 text-sm text-paper-2">
                  {fccMeta.vintage_sentence ?? "—"}
                </td>
              </tr>
              <tr className="border-t border-ink-800 align-top">
                <td className="px-2 py-2 text-paper">BEAD project areas</td>
                <td className="px-2 py-2 font-mono text-xs">
                  <a
                    href={beadMeta.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal hover:underline"
                  >
                    {beadMeta.source_url}
                  </a>
                </td>
                <td className="px-2 py-2 font-mono text-xs text-paper-3">
                  {beadMeta.sha256}
                </td>
                <td className="px-2 py-2 font-mono text-xs text-paper-3">
                  {beadMeta.fetched_at}
                </td>
                <td className="px-2 py-2 text-sm text-paper-2">
                  {beadMeta.note}
                </td>
              </tr>
              <tr className="border-t border-ink-800 align-top">
                <td className="px-2 py-2 text-paper">County geometry</td>
                <td className="px-2 py-2 font-mono text-xs">
                  <a
                    href={geoMeta.source_url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="text-teal hover:underline"
                  >
                    {geoMeta.source_url}
                  </a>
                </td>
                <td className="px-2 py-2 font-mono text-xs text-paper-3">
                  {geoMeta.output_sha256}
                </td>
                <td className="px-2 py-2 font-mono text-xs text-paper-3">
                  {geoMeta.fetched_at}
                </td>
                <td className="px-2 py-2 text-sm text-paper-2">
                  Census TIGERweb Generalized ACS2023; NWHI rings of Honolulu
                  removed.
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </section>

      <div className="mt-16">
        <SiteFooter />
      </div>
    </main>
  );
}
