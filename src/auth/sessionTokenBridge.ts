/**
 * Auth screens and authService persist the token to AsyncStorage, but React state
 * (AuthContext) only loaded once on launch. Without syncing, useRealtimeNotifications
 * never sees a token after login — push registration and other token-bound effects skip.
 */
type Listener = (token: string | null) => void;

const listeners = new Set<Listener>();

export function subscribeSessionToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}

export function notifySessionTokenCommitted(token: string | null): void {
  listeners.forEach((l) => {
    try {
      l(token);
    } catch {
      // ignore
    }
  });
}
