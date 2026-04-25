import * as Sentry from "@sentry/react-native";

/**
 * Production crash reporting. Set in EAS env or a local `.env`:
 *   EXPO_PUBLIC_SENTRY_DSN=https://xxxx@xxxx.ingest.sentry.io/xxxx
 * Optional: EXPO_PUBLIC_SENTRY_DEBUG=1 for verbose SDK logs in dev.
 */
const dsn = process.env.EXPO_PUBLIC_SENTRY_DSN;

if (typeof dsn === "string" && dsn.startsWith("https://")) {
  Sentry.init({
    dsn,
    enableAutoSessionTracking: true,
    enableAutoPerformanceTracing: true,
    debug: __DEV__ && process.env.EXPO_PUBLIC_SENTRY_DEBUG === "1",
    tracesSampleRate: __DEV__ ? 1.0 : 0.12,
    sendDefaultPii: false,
    beforeSend(event) {
      if (event.user) {
        delete event.user.email;
        delete event.user.username;
        delete event.user.ip_address;
      }
      if (event.request) {
        delete event.request.cookies;
      }
      return event;
    },
    beforeBreadcrumb(breadcrumb) {
      if (breadcrumb.data) {
        for (const key of Object.keys(breadcrumb.data)) {
          const k = key.toLowerCase();
          if (
            k.includes("email") ||
            k.includes("name") ||
            k.includes("phone") ||
            k.includes("token")
          ) {
            breadcrumb.data[key] = "[redacted]";
          }
        }
      }
      return breadcrumb;
    },
  });
} else if (__DEV__) {
  console.warn(
    "[Sentry] EXPO_PUBLIC_SENTRY_DSN not set — native crash reports disabled until you add your DSN.",
  );
}

export { Sentry };
