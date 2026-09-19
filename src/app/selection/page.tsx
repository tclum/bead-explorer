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
import { pageUrlFor } from "@/components/page/source";
import ScoreCalculator, {
  type CalculatorReceipt,
} from "@/components/ScoreCalculator";
import type { PageEvidence, PageFile } from "@/lib/types";

export const metadata: Metadata = {
  title: "Subgrantee selection · Hawaiʻi BEAD Explorer",
};

const page = JSON.parse(
  readFileSync(path.join(process.cwd(), "data/pages/selection.json"), "utf8"),
) as PageFile;

const CHIPS: AskChip[] = [
  {
    id: "f12",
    label: "How proposals were scored",
    question:
      "What scoring criteria did Hawaiʻi use to select BEAD deployment subgrantees, and how many points was each criterion worth?",
  },
  {
    id: "f13",
    label: "Speed to Deployment formula",
    question:
      "How is the Speed to Deployment score calculated in Hawaiʻi's BEAD subgrantee scoring?",
  },
  {
    id: "f06",
    label: "Who got the awards?",
    question:
      "Which companies received Hawaiʻi's BEAD deployment awards, and how long is each one's period of performance?",
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

function findEvidence(items: PageEvidence[], type: string): PageEvidence {
  const e = items.find((x) => x.type === type);
  if (!e) throw new Error(`selection: evidence missing "${type}"`);
  return e;
}

function evidenceToReceipt(e: PageEvidence): CalculatorReceipt {
  const link = pageUrlFor(e.source.doc, e.source.page);
  if (!link) {
    throw new Error(
      `selection: no manifest entry for evidence "${e.type}" doc=${e.source.doc}`,
    );
  }
  return {
    quote: e.source.quote,
    short: link.short,
    url: link.url,
    page: e.source.page,
  };
}

function expectedToReceipt(
  id: string,
  quote: string,
  doc: string,
  pageNum: number,
) {
  const link = pageUrlFor(doc, pageNum);
  if (!link) {
    throw new Error(
      `selection: no manifest entry for expected "${id}" doc=${doc}`,
    );
  }
  return {
    id,
    quote,
    short: link.short,
    url: link.url,
    page: pageNum,
  };
}

export default function SelectionPage() {
  if (!page.calculator) {
    throw new Error("selection.json missing calculator");
  }
  const rubricUu = page.breakdowns.find((b) => b.key === "rubric_uu");
  const rubricCai = page.breakdowns.find((b) => b.key === "rubric_cai");
  const speedNetwork = page.breakdowns.find((b) => b.key === "speed_of_network");
  const technology = page.breakdowns.find((b) => b.key === "technology");
  if (!rubricUu || !rubricCai || !speedNetwork || !technology) {
    throw new Error("selection.json missing a required breakdown");
  }

  const part1FormulaEvidence = findEvidence(page.evidence, "Part 1 formula");
  const part2FormulaEvidence = findEvidence(page.evidence, "Part 2 formula");
  const speedFormulaEvidence = findEvidence(
    page.evidence,
    "Speed to Deployment formula",
  );
  const outlaySummationExpected = page.calculator.expected.find(
    (e) => e.id === "outlay-A",
  );
  if (!outlaySummationExpected) {
    throw new Error("selection.json missing outlay-A expected entry");
  }

  const columnReceipts = {
    part1: evidenceToReceipt(part1FormulaEvidence),
    part2: evidenceToReceipt(part2FormulaEvidence),
    outlay: (() => {
      const link = pageUrlFor(
        outlaySummationExpected.source.doc,
        outlaySummationExpected.source.page,
      );
      if (!link) throw new Error("selection: no manifest entry for outlay-A");
      return {
        quote: outlaySummationExpected.source.quote,
        short: link.short,
        url: link.url,
        page: outlaySummationExpected.source.page,
      };
    })(),
    speed: evidenceToReceipt(speedFormulaEvidence),
  };

  const expectedReceipts = page.calculator.expected.map((e) =>
    expectedToReceipt(e.id, e.source.quote, e.source.doc, e.source.page),
  );

  return (
    <main className="mx-auto w-full max-w-[1120px] px-6 py-10 md:py-16">
      <SiteHeader current="/selection" />

      <div className="flex flex-col gap-4">
        <h1 className="font-serif text-4xl font-semibold tracking-tight text-paper md:text-5xl">
          {page.title}
        </h1>
        <p className="max-w-2xl text-base leading-relaxed text-paper-2">
          How Hawaiʻi chose who builds: fixed project areas, a public rubric,
          a formula that rewards the lowest ask, and the outcome.
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

      <section aria-labelledby="timeline-title">
        <h2
          id="timeline-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          Timeline
        </h2>
        <PhaseStrip phases={page.phases} />
      </section>

      <Divider />

      <section aria-labelledby="rubric-title">
        <h2
          id="rubric-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          How points were awarded
        </h2>
        <div className="grid grid-cols-1 gap-6">
          <BreakdownTable breakdown={rubricUu} items={page.items} />
          <BreakdownTable breakdown={rubricCai} items={page.items} />
          <BreakdownTable breakdown={speedNetwork} items={page.items} />
        </div>
      </section>

      <Divider />

      <ScoreCalculator
        defaults={page.calculator.defaults}
        columnReceipts={columnReceipts}
        expectedReceipts={expectedReceipts}
      />

      <Divider />

      <section aria-labelledby="outcome-title">
        <h2
          id="outcome-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          Outcome
        </h2>
        <BreakdownTable breakdown={technology} items={page.items} />
      </section>

      <Divider />

      <section aria-labelledby="who-title">
        <h2
          id="who-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          How the process was run
        </h2>
        <QuoteList items={page.who} />
      </section>

      <Divider />

      <section aria-labelledby="evidence-title">
        <h2
          id="evidence-title"
          className="mb-6 font-serif text-2xl font-medium text-paper"
        >
          Formulas and rules
        </h2>
        <EvidenceTable
          items={page.evidence}
          typeHeader="Rule"
          quoteHeader="Text"
          caption="Formulas and rules from the Final Proposal"
        />
      </section>

      <Divider />

      <AskPanel chips={CHIPS} />

      <Divider />

      <SiteFooter />
    </main>
  );
}
