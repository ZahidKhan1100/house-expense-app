import { ApiClientError } from "../utils/apiClient";

/** True when the failure is probably transient (offline, timeout) — safe to queue for retry. */
export function isLikelyUnreachableError(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof ApiClientError) {
    const m = String(err.message || "").toLowerCase();
    if (
      m.includes("timed out") ||
      m.includes("connection") ||
      m.includes("network") ||
      m.includes("internet") ||
      m.includes("fetch")
    ) {
      return true;
    }
    return false;
  }
  if (err instanceof TypeError) {
    const m = String(err.message || "").toLowerCase();
    return (
      m.includes("network") ||
      m.includes("failed to fetch") ||
      m.includes("aborted")
    );
  }
  const name = (err as { name?: string })?.name;
  if (name === "AbortError") return true;
  const msg = String((err as Error)?.message ?? err ?? "").toLowerCase();
  return (
    msg.includes("network request failed") ||
    msg.includes("failed to fetch") ||
    msg.includes("aborted")
  );
}
