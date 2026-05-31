/** Normalize category / description text for comparison. */
export function normalizeCategoryText(value: string): string {
  return value.trim().toLowerCase();
}

/**
 * Find a house category that matches free-text (description, receipt hint, etc.).
 * Exact name first, then substring match (either direction).
 */
export function findCategoryByDescription(
  text: string | null | undefined,
  categories: { id?: unknown; name?: string }[],
): (typeof categories)[number] | null {
  if (!text?.trim() || !categories?.length) return null;

  const h = normalizeCategoryText(text);

  const exact = categories.find(
    (c) => normalizeCategoryText(String(c?.name ?? "")) === h,
  );
  if (exact) return exact;

  const partial = categories.find((c) => {
    const n = normalizeCategoryText(String(c?.name ?? ""));
    if (!n || n.length < 2 || h.length < 2) return false;
    return n.includes(h) || h.includes(n);
  });
  if (partial) return partial;

  return null;
}

/** Description sent to API: user text or category name when empty. */
export function resolveExpenseDescription(
  description: string,
  categoryName: string | null | undefined,
): string {
  const trimmed = description.trim();
  if (trimmed) return trimmed.slice(0, 48);
  const fromCategory = String(categoryName ?? "").trim();
  return fromCategory.slice(0, 48);
}
