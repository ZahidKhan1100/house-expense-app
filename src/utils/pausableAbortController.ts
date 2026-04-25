import { AppState, type AppStateStatus } from "react-native";

type TimerEntry = {
  controller: AbortController;
  remainingMs: number;
  startedAt: number;
  timeoutId: ReturnType<typeof setTimeout> | null;
};

let currentState: AppStateStatus = AppState.currentState;
const timers = new Set<TimerEntry>();
let subscribed = false;

function ensureSubscribed() {
  if (subscribed) return;
  subscribed = true;
  AppState.addEventListener("change", (next) => {
    const prev = currentState;
    currentState = next;

    // Pause countdowns when app is not active.
    if (prev === "active" && next !== "active") {
      const now = Date.now();
      for (const t of timers) {
        if (!t.timeoutId) continue;
        const elapsed = now - t.startedAt;
        t.remainingMs = Math.max(0, t.remainingMs - elapsed);
        clearTimeout(t.timeoutId);
        t.timeoutId = null;
      }
      return;
    }

    // Resume countdowns when app becomes active.
    if (prev !== "active" && next === "active") {
      for (const t of timers) {
        if (t.timeoutId) continue;
        // If time already ran out while we were backgrounded, abort immediately.
        if (t.remainingMs <= 0) {
          try {
            t.controller.abort();
          } catch {
            // ignore
          }
          continue;
        }
        t.startedAt = Date.now();
        t.timeoutId = setTimeout(() => {
          try {
            t.controller.abort();
          } catch {
            // ignore
          }
        }, t.remainingMs);
      }
    }
  });
}

export function createPausableAbortController(timeoutMs: number): {
  controller: AbortController;
  cleanup: () => void;
} {
  ensureSubscribed();

  const controller = new AbortController();
  const entry: TimerEntry = {
    controller,
    remainingMs: Math.max(0, timeoutMs),
    startedAt: Date.now(),
    timeoutId: null,
  };

  // If app isn't active (e.g. background → foreground transition), start paused.
  if (currentState === "active") {
    entry.timeoutId = setTimeout(() => {
      try {
        controller.abort();
      } catch {
        // ignore
      }
    }, entry.remainingMs);
  }

  timers.add(entry);

  const cleanup = () => {
    timers.delete(entry);
    if (entry.timeoutId) clearTimeout(entry.timeoutId);
    entry.timeoutId = null;
  };

  return { controller, cleanup };
}

