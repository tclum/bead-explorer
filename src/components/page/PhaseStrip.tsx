import type { PagePhase } from "@/lib/types";
import { ReceiptBlock } from "./source";

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

export default function PhaseStrip({ phases }: { phases: PagePhase[] }) {
  return (
    <div
      className="grid gap-4"
      style={{ gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))" }}
    >
      {phases.map((p) => (
        <PhaseCard key={p.key} phase={p} />
      ))}
    </div>
  );
}
