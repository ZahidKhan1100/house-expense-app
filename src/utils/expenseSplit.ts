/**
 * Split a total into whole-cent shares that sum exactly to the total.
 * Remainder cents go to earlier entries in `orderedIds` (same as backend ExpenseSplit).
 */
export function splitEqualCents(
  total: number,
  orderedIds: number[],
): Record<number, number> {
  const n = orderedIds.length;
  if (n === 0 || !Number.isFinite(total)) return {};
  const centsTotal = Math.round(total * 100);
  const base = Math.floor(centsTotal / n);
  const remainder = centsTotal % n;
  const out: Record<number, number> = {};
  orderedIds.forEach((id, i) => {
    const c = base + (i < remainder ? 1 : 0);
    out[id] = c / 100;
  });
  return out;
}
