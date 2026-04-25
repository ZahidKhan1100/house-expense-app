/**
 * If `signInAsync` is still pending (iOS system sheet not finishing), we show a help
 * `Alert` after this delay. Not too short (avoid false positives) or too long.
 */
export const APPLE_SIGN_IN_STALL_HELP_MS = 30_000;

/**
 * iOS `ASAuthorizationError` code 1001 is `canceled` (user dismissed the sheet, tapped Back,
 * or the system ended the request). Expo usually surfaces this as `ERR_REQUEST_CANCELED`, but
 * some paths expose 1001 or a message with "1001" / "AuthorizationError".
 */
export function isAppleSignInUserCancellation(err: unknown): boolean {
  const e = err as { code?: string | number; message?: string };
  if (e?.code === "ERR_REQUEST_CANCELED" || e?.code === "ERR_CANCELED") {
    return true;
  }
  if (e?.code === 1001 || e?.code === "1001") {
    return true;
  }
  const msg = typeof e?.message === "string" ? e.message : "";
  if (
    /AuthorizationError.*1001|error 1001|Code=1001/i.test(msg) ||
    (msg.includes("AuthorizationError") && msg.includes("1001"))
  ) {
    return true;
  }
  return false;
}
