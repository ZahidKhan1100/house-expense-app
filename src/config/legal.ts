/**
 * Canonical marketing / legal URLs (HTTPS). Full legal text lives on the site
 * so App Store updates are not required for copy changes.
 */
const WEB_ORIGIN = "https://habimate.com";

export const LEGAL_URLS = {
  privacy: `${WEB_ORIGIN}/privacy`,
  terms: `${WEB_ORIGIN}/terms`,
} as const;

/** Short promise text (matches site “HabiMate promise” intent). */
export const HABIMATE_PROMISE_SUMMARY = [
  "We use receipt images only to extract amounts, with minimal retention.",
  "We don’t sell your household data to advertisers.",
  "Full Privacy Policy and Terms of Service live on habimate.com — open them below anytime.",
].join(" ");
