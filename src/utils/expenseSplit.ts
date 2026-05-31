/**
 * Split a total into whole-cent shares that sum exactly to the total.
 * Remainder cents go to earlier entries in `orderedIds` (same as backend ExpenseSplit).
 * Example: €10.00, 3 people → €3.34, €3.33, €3.33 (first id in list gets the extra cent).
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

/**
 * Weighted cent-safe split (days / custom weights). Matches backend ExpenseSplit::sharePerUserWeighted.
 */
export function splitWeightedCents(
  total: number,
  ordered: { id: number; weight: number }[],
): Record<number, number> {
  if (ordered.length === 0 || !Number.isFinite(total)) return {};

  const centsTotal = Math.round(total * 100);
  const weights = ordered.map((m) => (m.weight > 0 ? m.weight : 0));
  const sum = weights.reduce((a, b) => a + b, 0);
  if (sum <= 0) {
    return splitEqualCents(total, ordered.map((m) => m.id));
  }

  const baseCents: number[] = [];
  const fractions: number[] = [];
  let allocated = 0;

  ordered.forEach((m, i) => {
    const portion = (weights[i] / sum) * centsTotal;
    const floor = Math.floor(portion);
    baseCents[i] = floor;
    fractions[i] = portion - floor;
    allocated += floor;
  });

  let remainder = centsTotal - allocated;
  if (remainder > 0) {
    const order = fractions
      .map((f, i) => ({ f, i }))
      .sort((a, b) => b.f - a.f || a.i - b.i);
    for (const { i } of order) {
      if (remainder <= 0) break;
      baseCents[i] += 1;
      remainder -= 1;
    }
  }

  const out: Record<number, number> = {};
  ordered.forEach((m, i) => {
    out[m.id] = (baseCents[i] ?? 0) / 100;
  });
  return out;
}
