import type { PageCalculatorDefaults, PageCalculatorOfferor } from "./types";

export function part1Points(
  lowestRequested: number,
  requested: number,
  max: number,
): number {
  return (max * lowestRequested) / requested;
}

export function part2Points(
  lowestPerBsl: number,
  perBsl: number,
  max: number,
): number {
  return (max * lowestPerBsl) / perBsl;
}

export function speedToDeploymentPoints(
  months: number,
  horizon: number,
  max: number,
): number | null {
  if (!(months >= 0) || months > horizon) return null;
  return ((horizon - months) / horizon) * max;
}

export function formatPoints(x: number, decimals: number): string {
  const rounded = x.toFixed(decimals);
  return rounded.replace(/(\.\d*?)0+$/, "$1").replace(/\.$/, "");
}

export type OfferorScore = {
  id: string;
  part1: string;
  part2: string;
  outlay: string;
  speed: string;
};

export function scoreOfferors(
  defaults: PageCalculatorDefaults,
): OfferorScore[] {
  const requested = defaults.offerors.map(
    (o: PageCalculatorOfferor) => o.requested_musd,
  );
  const perBsl = defaults.offerors.map(
    (o: PageCalculatorOfferor) => o.cost_per_bsl_kusd,
  );
  const lowestRequested = Math.min(...requested);
  const lowestPerBsl = Math.min(...perBsl);
  return defaults.offerors.map((o) => {
    const p1Raw = part1Points(
      lowestRequested,
      o.requested_musd,
      defaults.max_part1,
    );
    const p2Raw = part2Points(
      lowestPerBsl,
      o.cost_per_bsl_kusd,
      defaults.max_part2,
    );
    // The Final Proposal's example adds the printed (one-decimal) parts —
    // 57.1 + 66.7 = 123.8 — so round each part before summing the outlay.
    const outlayRaw = Number(p1Raw.toFixed(1)) + Number(p2Raw.toFixed(1));
    const speedRaw = speedToDeploymentPoints(
      o.months,
      defaults.horizon_months,
      defaults.max_speed,
    );
    return {
      id: o.id,
      part1: formatPoints(p1Raw, 1),
      part2: formatPoints(p2Raw, 1),
      outlay: formatPoints(outlayRaw, 1),
      speed: speedRaw === null ? "n/a" : formatPoints(speedRaw, 2),
    };
  });
}
