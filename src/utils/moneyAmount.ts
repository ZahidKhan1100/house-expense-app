/**
 * Parse and sanitize money typed on mobile keyboards (EU comma vs US dot).
 * parseFloat("45,40") === 45 — always normalize before parsing.
 */

/** Keep digits and a single decimal separator; EU commas become dots; max 2 fraction digits. */
export function sanitizeMoneyAmountInput(raw: string): string {
  if (!raw) return "";

  let s = raw.replace(/\s/g, "").replace(/,/g, ".");
  s = s.replace(/[^\d.]/g, "");

  const dot = s.indexOf(".");
  if (dot === -1) {
    return s;
  }

  const whole = s.slice(0, dot);
  const frac = s.slice(dot + 1).replace(/\./g, "").slice(0, 2);

  if (whole === "" && frac === "") return "";
  if (whole === "") return `.${frac}`;
  if (frac === "") return `${whole}.`;
  return `${whole}.${frac}`;
}

/** Parse a display amount for API / math (NaN if empty or invalid). */
export function parseMoneyAmount(text: string): number {
  const normalized = sanitizeMoneyAmountInput(String(text ?? "").trim());
  if (!normalized || normalized === ".") {
    return NaN;
  }
  const n = parseFloat(normalized);
  return Number.isFinite(n) ? n : NaN;
}
