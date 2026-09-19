"use client";

import { useMemo, useState } from "react";
import { scoreOfferors } from "@/lib/score";
import type { PageCalculatorDefaults } from "@/lib/types";

export type CalculatorReceipt = {
  quote: string;
  short: string;
  url: string;
  page: number;
};

type OfferorState = {
  id: string;
  requested_musd: string;
  cost_per_bsl_kusd: string;
  months: string;
};

function toStrings(defaults: PageCalculatorDefaults): OfferorState[] {
  return defaults.offerors.map((o) => ({
    id: o.id,
    requested_musd: String(o.requested_musd),
    cost_per_bsl_kusd: String(o.cost_per_bsl_kusd),
    months: String(o.months),
  }));
}

type Range = { min: number; maxInclusive: number | null; label: string };

function parseInput(
  raw: string,
  range: Range,
): { value: number; valid: boolean } {
  const n = Number(raw);
  if (raw === "" || !Number.isFinite(n)) return { value: 0, valid: false };
  if (n < range.min) return { value: n, valid: false };
  if (range.maxInclusive !== null && n > range.maxInclusive) {
    return { value: n, valid: false };
  }
  return { value: n, valid: true };
}

const OUTSIDE_LABEL = "outside the published formula";

function OutputCell({
  id,
  value,
  best,
}: {
  id: string;
  value: string;
  best: boolean;
}) {
  const outside = value === "n/a";
  const cls = outside
    ? "px-2 py-2 text-right font-mono text-xs text-amber"
    : best
      ? "px-2 py-2 text-right font-mono text-sm text-teal"
      : "px-2 py-2 text-right font-mono text-sm text-paper";
  return (
    <td className={cls} data-computed={`${id}|${value}`}>
      {outside ? OUTSIDE_LABEL : value}
    </td>
  );
}

function ColumnHeaderReceipt({ receipt }: { receipt: CalculatorReceipt }) {
  return (
    <details className="mt-2 text-[10px] font-normal normal-case text-paper-3">
      <summary className="cursor-pointer select-none hover:text-paper-2">
        Formula
      </summary>
      <div className="mt-2 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper">
        “{receipt.quote}”
      </div>
      <a
        className="mt-2 inline-block font-mono text-teal hover:underline"
        href={receipt.url}
        target="_blank"
        rel="noopener noreferrer"
      >
        {receipt.short}, p.{receipt.page}
      </a>
    </details>
  );
}

export default function ScoreCalculator({
  defaults,
  columnReceipts,
  expectedReceipts,
}: {
  defaults: PageCalculatorDefaults;
  columnReceipts: {
    part1: CalculatorReceipt;
    part2: CalculatorReceipt;
    outlay: CalculatorReceipt;
    speed: CalculatorReceipt;
  };
  expectedReceipts: {
    id: string;
    quote: string;
    short: string;
    url: string;
    page: number;
  }[];
}) {
  const [rows, setRows] = useState<OfferorState[]>(() => toStrings(defaults));

  const parsed = useMemo(() => {
    return rows.map((r) => {
      const req = parseInput(r.requested_musd, {
        min: Number.EPSILON,
        maxInclusive: null,
        label: "requested",
      });
      const bsl = parseInput(r.cost_per_bsl_kusd, {
        min: Number.EPSILON,
        maxInclusive: null,
        label: "cost_per_bsl",
      });
      const mos = parseInput(r.months, {
        min: 0,
        maxInclusive: defaults.horizon_months,
        label: "months",
      });
      return { id: r.id, req, bsl, mos };
    });
  }, [rows, defaults.horizon_months]);

  const scored = useMemo(() => {
    const anyInvalidPart = parsed.some((p) => !p.req.valid || !p.bsl.valid);
    if (anyInvalidPart) {
      return parsed.map((p) => ({
        id: p.id,
        part1: p.req.valid && p.bsl.valid ? "" : "n/a",
        part2: p.req.valid && p.bsl.valid ? "" : "n/a",
        outlay: p.req.valid && p.bsl.valid ? "" : "n/a",
        speed: p.mos.valid ? "" : "n/a",
      }));
    }
    const scoredValid = scoreOfferors({
      max_part1: defaults.max_part1,
      max_part2: defaults.max_part2,
      max_speed: defaults.max_speed,
      horizon_months: defaults.horizon_months,
      offerors: parsed.map((p) => ({
        id: p.id,
        requested_musd: p.req.value,
        cost_per_bsl_kusd: p.bsl.value,
        months: p.mos.value,
      })),
    });
    return parsed.map((p, i) => {
      const s = scoredValid[i];
      return {
        id: p.id,
        part1: s.part1,
        part2: s.part2,
        outlay: s.outlay,
        speed: p.mos.valid ? s.speed : "n/a",
      };
    });
  }, [
    parsed,
    defaults.max_part1,
    defaults.max_part2,
    defaults.max_speed,
    defaults.horizon_months,
  ]);

  function bestOf(field: "part1" | "part2" | "outlay" | "speed"): Set<string> {
    const nums = scored
      .map((s) => ({ id: s.id, v: Number(s[field]) }))
      .filter((x) => Number.isFinite(x.v));
    if (nums.length === 0) return new Set();
    const max = nums.reduce((m, x) => (x.v > m ? x.v : m), -Infinity);
    return new Set(nums.filter((x) => x.v === max).map((x) => x.id));
  }
  const bestPart1 = bestOf("part1");
  const bestPart2 = bestOf("part2");
  const bestOutlay = bestOf("outlay");
  const bestSpeed = bestOf("speed");

  function setField(
    idx: number,
    field: "requested_musd" | "cost_per_bsl_kusd" | "months",
    v: string,
  ) {
    setRows((prev) => {
      const next = prev.slice();
      next[idx] = { ...next[idx], [field]: v };
      return next;
    });
  }

  function reset() {
    setRows(toStrings(defaults));
  }

  const inputCls =
    "w-24 rounded border border-ink-800 bg-ink-950 px-2 py-1 font-mono text-sm text-paper outline-none focus:border-teal";

  return (
    <section aria-labelledby="calc-title" className="rounded border border-ink-800 bg-ink-900 p-5">
      <h3 id="calc-title" className="font-serif text-lg font-medium text-paper">
        Run the published formula
      </h3>
      <p className="mt-2 max-w-3xl text-sm text-paper-2">
        Computed here from the formulas on Final Proposal pages 25 to 26,
        starting from the document&apos;s own examples. These are illustrations
        of the rubric, not figures about Hawaiʻi&apos;s actual bids, which are
        not public.
      </p>
      <div className="mt-4 overflow-x-auto">
        <table className="w-full text-sm">
          <caption className="sr-only">Scoring calculator</caption>
          <thead className="text-xs uppercase tracking-wide text-paper-3 align-bottom">
            <tr>
              <th scope="col" className="px-2 py-2 text-left">Offeror</th>
              <th scope="col" className="px-2 py-2 text-right">Requested ($M)</th>
              <th scope="col" className="px-2 py-2 text-right">Cost per BSL ($k)</th>
              <th scope="col" className="px-2 py-2 text-right">Months</th>
              <th scope="col" className="px-2 py-2 text-right">
                Part 1
                <ColumnHeaderReceipt receipt={columnReceipts.part1} />
              </th>
              <th scope="col" className="px-2 py-2 text-right">
                Part 2
                <ColumnHeaderReceipt receipt={columnReceipts.part2} />
              </th>
              <th scope="col" className="px-2 py-2 text-right">
                Outlay
                <ColumnHeaderReceipt receipt={columnReceipts.outlay} />
              </th>
              <th scope="col" className="px-2 py-2 text-right">
                Speed
                <ColumnHeaderReceipt receipt={columnReceipts.speed} />
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((r, i) => {
              const s = scored[i];
              return (
                <tr key={r.id} className="border-t border-ink-800">
                  <th scope="row" className="px-2 py-2 text-left font-medium text-paper">
                    Offeror {r.id}
                  </th>
                  <td className="px-2 py-2 text-right">
                    <label className="sr-only" htmlFor={`req-${r.id}`}>
                      Requested BEAD funding for Offeror {r.id} in $ millions
                    </label>
                    <input
                      id={`req-${r.id}`}
                      className={inputCls}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={r.requested_musd}
                      onChange={(e) => setField(i, "requested_musd", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <label className="sr-only" htmlFor={`bsl-${r.id}`}>
                      Cost per BSL for Offeror {r.id} in $ thousands
                    </label>
                    <input
                      id={`bsl-${r.id}`}
                      className={inputCls}
                      type="number"
                      inputMode="decimal"
                      step="0.1"
                      min="0"
                      value={r.cost_per_bsl_kusd}
                      onChange={(e) => setField(i, "cost_per_bsl_kusd", e.target.value)}
                    />
                  </td>
                  <td className="px-2 py-2 text-right">
                    <label className="sr-only" htmlFor={`mos-${r.id}`}>
                      Months to complete for Offeror {r.id} (0 to {defaults.horizon_months})
                    </label>
                    <input
                      id={`mos-${r.id}`}
                      className={inputCls}
                      type="number"
                      inputMode="numeric"
                      step="1"
                      min="0"
                      max={defaults.horizon_months}
                      value={r.months}
                      onChange={(e) => setField(i, "months", e.target.value)}
                    />
                  </td>
                  <OutputCell id={`part1-${r.id}`} value={s.part1} best={bestPart1.has(r.id)} />
                  <OutputCell id={`part2-${r.id}`} value={s.part2} best={bestPart2.has(r.id)} />
                  <OutputCell id={`outlay-${r.id}`} value={s.outlay} best={bestOutlay.has(r.id)} />
                  <OutputCell id={`speed-${r.id}`} value={s.speed} best={bestSpeed.has(r.id)} />
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      <div className="mt-4 flex flex-wrap items-center gap-3">
        <button
          type="button"
          className="rounded border border-ink-700 bg-ink-800 px-3 py-1.5 text-sm text-paper hover:bg-ink-700"
          onClick={reset}
        >
          Reset to the Final Proposal&apos;s examples
        </button>
      </div>
      <p className="mt-3 max-w-3xl text-sm text-paper-2">
        Not computed: the 15 percent rule that decides whether secondary
        criteria apply, and the technical sub-scores, which the review
        committee judged.
      </p>
      <details className="mt-4 text-xs text-paper-3">
        <summary className="cursor-pointer select-none hover:text-paper-2">
          Worked examples ({expectedReceipts.length})
        </summary>
        <ul className="mt-2 space-y-3">
          {expectedReceipts.map((r) => (
            <li key={r.id}>
              <div className="text-paper-2 font-mono">{r.id}</div>
              <div className="mt-1 whitespace-pre-wrap break-words rounded border-l-2 border-teal bg-ink-950 px-3 py-2 font-mono text-paper">
                “{r.quote}”
              </div>
              <a
                className="mt-2 inline-block font-mono text-teal hover:underline"
                href={r.url}
                target="_blank"
                rel="noopener noreferrer"
              >
                {r.short}, p.{r.page}
              </a>
            </li>
          ))}
        </ul>
      </details>
    </section>
  );
}
