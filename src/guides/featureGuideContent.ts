/**
 * In-app procedural help: how math and flows actually work (match backend ExpenseSplit + BalanceCalculator).
 */
export type FeatureGuideSection = {
  id: string;
  title: string;
  items: { title: string; body: string }[];
};

export const FEATURE_GUIDE_SECTIONS: FeatureGuideSection[] = [
  {
    id: "add-expense",
    title: "How adding an expense works",
    items: [
      {
        title: "What you enter",
        body: "Description, amount, category, which month it belongs to, who paid (“Paid by”), and who shares the bill (“Split with”). You need at least one person in Split with—the payer can stay out of that list if they paid for others and shouldn’t owe a share.",
      },
      {
        title: "Split mode: Equal",
        body: "The total is divided only among everyone ticked under Split with. If three people share a €12.00 bill, each share is worked out from the same rules as below (whole cents, exact total).",
      },
      {
        title: "Split mode: By days",
        body: "Each selected person gets a weight from the month: full month minus “away” days from Who’s Home, plus extra “guest” nights (guest nights can count as a fraction of a full day—your house admin sets that %). Rent-style categories lock away/guest overrides to keep rent simple. You can use Advanced split on some categories to type custom away/guest numbers for that bill only.",
      },
      {
        title: "Receipt scan",
        body: "Optional: scan a receipt photo to suggest merchant, date, amount, and a category. Always check the numbers before saving—AI can misread blurry lines.",
      },
      {
        title: "Offline",
        body: "If you lose connection, saves can queue on your phone and sync when you’re online again.",
      },
    ],
  },
  {
    id: "split-math",
    title: "How division & rounding work",
    items: [
      {
        title: "Always whole cents",
        body: "Amounts use two decimals. Each bill gives everyone the same floored share (equal split) or floored weighted share (by days). Leftover cents from every bill in the month are combined and applied when you build the settlement plan—not as an extra cent on the first person on each bill.",
      },
      {
        title: "Example: €10.00 split 3 ways (equal)",
        body: "€10.00 = 1,000 cents. 1,000 ÷ 3 → €3.33 each on that bill (floored). The 1 leftover cent waits until settlement for the month, then is assigned to people who owe money based on their total debt.",
      },
      {
        title: "Equal split rule (summary)",
        body: "Per bill: floor(total ÷ people) for everyone in Split with. Monthly leftover cents: applied once on Settlements → Build settlement plan. Rebuild after you add or edit bills so totals stay exact.",
      },
      {
        title: "Split by days (weighted)",
        body: "Per bill: each person’s share is floored from their day weight. Leftover cents from all bills in the month are applied together at settlement time (weighted toward who owes more).",
      },
      {
        title: "Balances after the split",
        body: "The payer effectively “floated” the cost. Anyone in Split with owes their share toward that float. Splitting excludes the payer if they unchecked themselves: everyone else still owes their shares, and the payer is reimbursed in full through the balance math.",
      },
    ],
  },
  {
    id: "buyback",
    title: "How stock buy-back works",
    items: [
      {
        title: "What it’s for",
        body: "Use when someone bought shared stuff (router, bulk supplies, move-out stock) and housemates should reimburse them through the same settlement system as bills—not as a fake grocery line item.",
      },
      {
        title: "What you set",
        body: "Title, total amount, optional note, month, and Who reimburses (housemates who should pay back). The person creating it is treated as the buyer; they are not in the reimburse list on the form.",
      },
      {
        title: "How the amount is split",
        body: "The total is split across selected reimbursers using the same equal-cent rule as bills: whole cents only, exact total. The screen shows a range (e.g. €20.00–€20.01 each) when remainders make shares differ by a cent.",
      },
      {
        title: "What appears in Pay",
        body: "The app creates pending settlement rows: each selected person pays the buyer for their share. Mark them paid in Pay/settlements when money actually moves (bank/Venmo/cash). That keeps monthly balances truthful.",
      },
    ],
  },
  {
    id: "pay-balances",
    title: "Balances, Pay tab & settlements",
    items: [
      {
        title: "Monthly balance card",
        body: "After all bills and recorded payments (including buy-back rows), the app nets who’s up and who’s down for the month. Tap through to Pay for the suggested transfer plan.",
      },
      {
        title: "Marking transfers paid",
        body: "HabiMate doesn’t move real money—it records who paid whom once you confirm it, so splits don’t get double-counted.",
      },
      {
        title: "Settlement lock (if you see it)",
        body: "If you still owe settlements the app cares about, some areas stay limited until you clear Pay—so nobody edits around money that’s still open.",
      },
    ],
  },
  {
    id: "calendar-categories",
    title: "Who’s Home, categories & rent",
    items: [
      {
        title: "Who’s Home",
        body: "Log trips away and guest nights so “split by days” reflects who was actually around. Guest nights use your house’s guest-day percentage (admin setting).",
      },
      {
        title: "Categories",
        body: "House categories are labels (and icons) used on bills and receipt hints. Rent and some utilities have special split behavior (e.g. rent doesn’t use away-day overrides in the same way).",
      },
    ],
  },
  {
    id: "transparency",
    title: "Where to verify numbers",
    items: [
      {
        title: "Expense log",
        body: "See who edited or removed what, for audits and arguments about “who changed the bill?”",
      },
      {
        title: "Insights & Wrapped-type screens",
        body: "Charts and seasonal summaries sit on top of the same expense data—good for habits, not for legal precision; use individual bills + Pay for the exact cents.",
      },
    ],
  },
  {
    id: "rest",
    title: "Other screens (same data, different view)",
    items: [
      {
        title: "Home",
        body: "Month total, your split balance vs the house after bills & payments, latest bill, category strip, shortcuts (add bill, mates, calendar, Insights, audit, Wrapped-style cards). Tap balance → Pay.",
      },
      {
        title: "Mates & invites",
        body: "House roster and QR/link invites; join requests depend on admin settings.",
      },
      {
        title: "Wall",
        body: "Shared photos, polls, and “running low” items—coordination alongside expenses. Photo snippets (with an image) are removed automatically after 2 days; text-only notes and polls stay until someone deletes them.",
      },
      {
        title: "Profile & house admin",
        body: "Theme, Face ID, house name and currency, guest-night % for day splits, leave house, sign out, legal links.",
      },
    ],
  },
];
