/**
 * Google OAuth via expo-auth-session returns an id_token after the code exchange
 * completes. The first "success" response may only contain `code` — wait until
 * `id_token` (or authentication.idToken) is present before calling the backend.
 */
export function getGoogleIdTokenFromAuthResponse(response: {
  type?: string;
  params?: Record<string, string | undefined>;
  authentication?: { idToken?: string };
} | null): string | null {
  if (!response || response.type !== "success") return null;
  const fromParams = response.params?.id_token;
  const fromAuth = response.authentication?.idToken;
  const token = fromParams || fromAuth;
  return typeof token === "string" && token.length > 0 ? token : null;
}
