import { readFileSync } from "node:fs";
import path from "node:path";
import type { Metadata } from "next";
import SiteHeader from "@/components/SiteHeader";
import SiteFooter from "@/components/SiteFooter";
import AskPanel, { type AskChip } from "@/components/AskPanel";
import BreakdownTable from "@/components/page/BreakdownTable";
import EvidenceTable from "@/components/page/EvidenceTable";
import PageTiles from "@/components/page/PageTiles";
import PhaseStrip from "@/components/page/PhaseStrip";
import QuoteList from "@/components/page/QuoteList";
import type { PageFile } from "@/lib/types";

export const metadata: Metadata = {
  title: "Challenge process · Hawaiʻi BEAD Explorer",
};

const page = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/pages/challenge.json"), "utf8"),
) as PageFile;

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

function Divider() {
  return (
    <hr
      className="my-10 md:my-16 border-0 border-t border-ink-800"
      aria-hidden
    />
  );
}

export default function ChallengePage() {
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
        <PageTiles items={page.items} />
      </section>

      <Divider />

      <section aria-labelledby="phases-title">
        <h2
          id="phases-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          Three phases
        </h2>
        <PhaseStrip phases={page.phases} />
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
            <BreakdownTable key={b.key} breakdown={b} items={page.items} />
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
        <QuoteList items={page.who} />
      </section>

      <Divider />

      <section aria-labelledby="evidence-title">
        <h2
          id="evidence-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          What evidence counted
        </h2>
        <EvidenceTable
          items={page.evidence}
          typeHeader="Challenge type"
          quoteHeader="Requirement"
          caption="Evidence required for each challenge type"
        />
      </section>

      <Divider />

      <AskPanel chips={CHIPS} />

      <Divider />

      <SiteFooter />
    </main>
  );
}
