const COUNT_FORMATTER = new Intl.NumberFormat("en-US", { useGrouping: true, maximumFractionDigits: 0 });

export function formatCount(n: number): string {
  return COUNT_FORMATTER.format(n);
}
