const listeners = new Set<() => void>();

/** Call after AsyncStorage `user` JSON is written so screens can refresh cached profile fields (e.g. avatar). */
export function notifyStoredUserUpdated() {
  listeners.forEach((fn) => {
    try {
      fn();
    } catch {
      /* noop */
    }
  });
}

export function subscribeStoredUser(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}
