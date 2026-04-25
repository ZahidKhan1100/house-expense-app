export type WebNotificationPayload = {
  title: string;
  body?: string;
  /** If true, show even when tab is visible (still requires permission). */
  force?: boolean;
};

export function webNotificationsSupported(): boolean {
  return typeof window !== "undefined" && typeof Notification !== "undefined";
}

export async function requestWebNotificationPermission(): Promise<NotificationPermission> {
  if (!webNotificationsSupported()) return "denied";
  if (Notification.permission === "granted") return "granted";
  return await Notification.requestPermission();
}

export function showWebNotification(payload: WebNotificationPayload): void {
  if (!webNotificationsSupported()) return;
  if (Notification.permission !== "granted") return;

  // Default: only pop OS notifications when the tab is hidden / backgrounded.
  // If the user wants notifications while active, set force=true.
  const isHidden = typeof document !== "undefined" ? document.hidden : false;
  if (!isHidden && !payload.force) return;

  try {
    new Notification(payload.title, payload.body ? { body: payload.body } : undefined);
  } catch {
    // ignore
  }
}

