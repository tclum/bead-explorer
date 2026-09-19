import { readFileSync } from "node:fs";
import path from "node:path";
import Link from "next/link";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AskPanel, { type AskChip } from "@/components/AskPanel";
import EvidenceTable from "@/components/page/EvidenceTable";
import PageTiles from "@/components/page/PageTiles";
import PhaseStrip from "@/components/page/PhaseStrip";
import QuoteList from "@/components/page/QuoteList";
import type { PageFile } from "@/lib/types";

export const metadata: Metadata = {
  title: "Oversight and accountability · Hawaiʻi BEAD Explorer",
};

const page = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/pages/oversight.json"), "utf8"),
) as PageFile;

const CHIPS: AskChip[] = [
  {
    id: "f14",
    label: "Reporting cadence",
    question:
      "How often must Hawaiʻi's BEAD subgrantees report to UHBO, and when are the quarterly expenditure reports due?",
  },
  {
    id: "f15",
    label: "Completion deadline",
    question:
      "How long before the end of the period of performance must all of Hawaiʻi's BEAD subgrant activities be completed?",
  },
  {
    id: "f05",
    label: "Low-cost option price",
    question:
      "What is the maximum monthly price of the low-cost service option in Hawaiʻi's Initial Proposal?",
  },
];

function Divider() {
  return (
    <hr
      className="my-10 md:my-16 border-0 border-t border-ink-800"
      aria-hidden
    />
  );
}

export default function OversightPage() {
  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 py-10 md:py-16">
      <SiteHeader current="/oversight" />

      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-paper md:text-5xl">
          {page.title}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-paper-2">
          How Hawaiʻi watches the money after the award: what subgrantees
          report and when, how reimbursement is earned, what raises a
          subgrantee&apos;s risk tier, and what the state committed to. The
          commitments are public; performance against them is not yet.
        </p>
      </div>

      <Divider />

      <section aria-labelledby="tiles-title">
        <h2 id="tiles-title" className="sr-only">
          Headline figures
        </h2>
        <PageTiles items={page.items} />
      </section>

      <Divider />

      <section aria-labelledby="cadence-title">
        <h2
          id="cadence-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          Monitoring cadence
        </h2>
        <PhaseStrip phases={page.phases} />
      </section>

      <Divider />

      <section aria-labelledby="monitoring-title">
        <h2
          id="monitoring-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          How monitoring works
        </h2>
        <QuoteList items={page.who} group="monitoring" />
      </section>

      <Divider />

      <section aria-labelledby="risk-title">
        <h2
          id="risk-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          Risk tiers
        </h2>
        <EvidenceTable
          items={page.evidence}
          typeHeader="Tier"
          quoteHeader="Text"
          caption="Risk tiers from the Subgrantee Monitoring Plan"
          group="risk"
        />
        <p className="mt-4 text-sm text-paper-2">
          Assigned at every reporting period; medium and high risk change the
          site-visit and desk-review frequency and can withhold or claw back
          funding.
        </p>
      </section>

      <Divider />

      <section aria-labelledby="reimbursement-title">
        <h2
          id="reimbursement-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          How reimbursement is earned
        </h2>
        <QuoteList items={page.who} group="reimbursement" />
      </section>

      <Divider />

      <section aria-labelledby="commitments-title">
        <h2
          id="commitments-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          What the state committed to
        </h2>
        <EvidenceTable
          items={page.evidence}
          typeHeader="Commitment"
          quoteHeader="Text"
          caption="Commitments the state made in the Final and Initial Proposals"
          group="commitments"
        />
      </section>

      <Divider />

      <section aria-labelledby="report-title">
        <h2
          id="report-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          The receipted report
        </h2>
        <p className="max-w-3xl text-base text-paper-2">
          Every figure and quoted commitment on this site, with its source,
          in one printable document.{" "}
          <Link
            href="/report"
            className="font-mono text-teal hover:underline"
          >
            Open the receipted report →
          </Link>
        </p>
      </section>

      <Divider />

      <AskPanel chips={CHIPS} />

      <Divider />

      <SiteFooter />
    </main>
  );
}
