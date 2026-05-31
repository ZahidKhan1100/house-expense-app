import * as Linking from "expo-linking";

export type ResetPasswordQuery = { token: string; email: string };

function firstString(q: Record<string, unknown>, key: string): string | undefined {
  const raw = q[key];
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string" && raw[0].length > 0) {
    return raw[0];
  }
  return undefined;
}

function pathMatchesReset(parsed: Linking.ParsedURL): boolean {
  const pathNorm = String(parsed.path ?? "")
    .replace(/^\/+/, "")
    .toLowerCase();
  const hostNorm = String(parsed.hostname ?? "")
    .replace(/^\/+/, "")
    .toLowerCase();
  /** `scheme://reset-password?...` is often parsed with hostname-only (no slash path). */
  return pathNorm === "reset-password" || hostNorm === "reset-password";
}

/**
 * Parses app / HTTPS URLs that should open the reset-password screen.
 */
export function parseResetPasswordLink(url: string): ResetPasswordQuery | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  /** HTTPS: https://habimate.com/reset-password?token=...&email=... */
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      const u = new URL(trimmed);
      const firstSeg = u.pathname.replace(/^\/+|\/+$/g, "").split("/")[0]?.toLowerCase();
      if (firstSeg === "reset-password") {
        const token = u.searchParams.get("token");
        const email = u.searchParams.get("email");
        if (token && email) return { token, email };
      }
    } catch {
      return null;
    }
    return null;
  }

  try {
    const parsed = Linking.parse(trimmed);
    const qp = (parsed.queryParams ?? {}) as Record<string, unknown>;
    const token = firstString(qp, "token");
    const email = firstString(qp, "email");
    if (pathMatchesReset(parsed) && token && email) return { token, email };
  } catch {
    return null;
  }

  return null;
}
