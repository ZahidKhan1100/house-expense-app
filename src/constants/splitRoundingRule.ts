/**
 * User-facing copy for cent splits (matches backend BalanceCalculator + settlement).
 * Per-bill: floored shares only. Leftover cents for the month apply when you build the settlement plan.
 */

export const SPLIT_ROUNDING_TITLE = "How we split cents";

export const SPLIT_ROUNDING_SHORT =
  "Each bill uses the same floored share for everyone (no extra cent on the first person). Any leftover cents from all bills in the month are applied once when you build the settlement plan.";

/** Worked example: €10.00 ÷ 3 */
export const SPLIT_ROUNDING_EXAMPLE_TITLE = "Example: €10.00 split 3 ways";

export const SPLIT_ROUNDING_EXAMPLE_LINES = [
  "€10.00 = 1,000 cents",
  "1,000 ÷ 3 → €3.33 each (floored), 1 cent left for the month",
  "That cent is assigned when you build the settlement plan, not on the first person in the list",
] as const;

export const SPLIT_ROUNDING_WHO_GETS_CENT =
  "Leftover cents from every bill in the month are combined and assigned to people who owe money, based on how much they owe (largest debt first for ties). Rebuild the settlement plan after adding or editing bills.";

export const SPLIT_ROUNDING_EQUAL_RULE =
  "Equal split per bill: everyone gets floor(total ÷ people). Remaining cents wait until settlement plan generation for that month.";

export const SPLIT_ROUNDING_WEIGHTED_NOTE =
  "Split by days: each bill uses floored weighted shares; leftover cents from all bills apply together at settlement time.";
