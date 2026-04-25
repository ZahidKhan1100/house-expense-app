import { useEffect, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import * as Notifications from "expo-notifications";
import { AppState, Platform } from "react-native";
import Constants from "expo-constants";

import { API_BASE_URL } from "../config/api";
import { apiClient } from "../utils/apiClient";
import { bindChannelDebug, createPusherClient } from "./realtimeClient";
import { showWebNotification } from "./webNotifications";

/** Must match app.json `expo.extra.eas.projectId` when Constants omits it (some dev/edge builds). */
const EAS_PROJECT_ID_FALLBACK = "787a84a2-b8f7-4888-9c5b-43cbcc2d638a";

function resolveEasProjectId(): string {
  const c = Constants as {
    easConfig?: { projectId?: string };
    expoConfig?: { extra?: { eas?: { projectId?: string } } };
    manifest?: { extra?: { eas?: { projectId?: string } } };
    manifest2?: { extra?: { expoClient?: { extra?: { eas?: { projectId?: string } } } } };
  };
  return (
    c.easConfig?.projectId ??
    c.expoConfig?.extra?.eas?.projectId ??
    c.manifest2?.extra?.expoClient?.extra?.eas?.projectId ??
    c.manifest?.extra?.eas?.projectId ??
    EAS_PROJECT_ID_FALLBACK
  );
}

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowAlert: true,
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true,
    shouldShowList: true,
  }),
});

type StoredUser = { id?: number | string; house_id?: number | string } | null;

function toInt(v: any): number | null {
  const n = Number(v);
  return Number.isFinite(n) ? n : null;
}

async function getStoredUser(): Promise<StoredUser> {
  const raw = await AsyncStorage.getItem("user");
  if (!raw) return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

function delay(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function formatRegisterError(e: unknown): string {
  if (e && typeof e === "object" && "message" in e) {
    return String((e as { message?: string }).message ?? e);
  }
  return String(e ?? "unknown");
}

async function ensureExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  if (Platform.OS === "android") {
    // Ensures notifications show reliably on Android (incl. heads-up)
    await Notifications.setNotificationChannelAsync("default", {
      name: "default",
      importance: Notifications.AndroidImportance.MAX,
      vibrationPattern: [0, 250, 250, 250],
      lightColor: "#FF6A6A",
    });
  }

  const perm = await Notifications.getPermissionsAsync();
  let status = perm.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") {
    console.warn(
      "[push] Notifications permission not granted (status:",
      status,
      ") — enable in system Settings to register for push.",
    );
    return null;
  }

  const projectId = resolveEasProjectId();

  try {
    const token = await Notifications.getExpoPushTokenAsync({ projectId });
    return token.data ?? null;
  } catch (e) {
    const msg = String((e as { message?: string })?.message ?? e);
    if (
      Platform.OS === "android" &&
      (msg.includes("Default FirebaseApp is not initialized") ||
        msg.includes("fcm-credentials"))
    ) {
      console.warn(
        "[push] Android: Firebase/FCM not wired in this build. Ensure google-services.json + EAS FCM V1 key, then rebuild.",
      );
    } else {
      console.warn("[push] getExpoPushTokenAsync failed:", e);
    }
    return null;
  }
}

async function registerExpoTokenWithBackend(
  authToken: string,
  opts?: { quietMissing?: boolean },
): Promise<void> {
  const tokenAttempts = 4;
  let expoToken: string | null = null;
  for (let i = 1; i <= tokenAttempts; i++) {
    expoToken = await ensureExpoPushToken();
    if (expoToken) break;
    if (i < tokenAttempts) {
      if (__DEV__) {
        console.warn(`[push] No Expo token yet (${i}/${tokenAttempts}), retrying…`);
      }
      await delay(1200 * i);
    }
  }

  if (!expoToken) {
    if (!opts?.quietMissing) {
      console.warn(
        "[push] No Expo push token — not saved to DB. On Android: grant notification permission, upload FCM V1 key in Expo dashboard, rebuild dev client. On simulator: use a real device for push.",
      );
    }
    return;
  }

  const os =
    Platform.OS === "ios"
      ? "ios"
      : Platform.OS === "android"
        ? "android"
        : Platform.OS === "web"
          ? "web"
          : String(Platform.OS ?? "unknown");

  const postAttempts = 3;
  for (let j = 1; j <= postAttempts; j++) {
    try {
      await apiClient(
        "/push-tokens",
        "POST",
        { token: expoToken, platform: os },
        authToken,
        { "X-Client-Platform": os },
      );
      console.log("[push] Expo token registered with backend");
      return;
    } catch (e) {
      const msg = formatRegisterError(e);
      const looksLikeHttpBlock =
        Platform.OS === "android" &&
        API_BASE_URL.startsWith("http://") &&
        (/Network request failed|Failed to fetch|cleartext/i.test(msg) ||
          msg.length === 0);

      if (looksLikeHttpBlock && __DEV__) {
        console.warn(
          "[push] /push-tokens failed — Android often blocks HTTP to LAN until android:usesCleartextTraffic is true. Rebuild native app after pulling latest app.json + plugins, or use https:// for API_BASE_URL.",
          msg,
        );
      } else if (j >= postAttempts) {
        console.warn(
          "[push] /push-tokens API failed (no DB row) — check auth, migrations, and API URL:",
          msg,
          e,
        );
      } else if (__DEV__) {
        console.warn(`[push] /push-tokens attempt ${j}/${postAttempts} failed, retrying:`, msg);
      }
      if (j < postAttempts) {
        await delay(800 * j);
      }
    }
  }
}

export function useRealtimeNotifications(token: string | null) {
  const pusherRef = useRef<any>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const boot = async () => {
      try {
        // Token registration (best-effort; also runs again on AppState "active")
        await registerExpoTokenWithBackend(token);

        const user = await getStoredUser();
        const userId = toInt(user?.id);
        if (!userId) return;

        // House id: prefer stored user; otherwise ask backend.
        let houseId = toInt(user?.house_id);
        if (!houseId) {
          try {
            const res = await apiClient("/house/current", "GET");
            houseId = toInt(res?.house?.id);
          } catch {
            houseId = null;
          }
        }

        if (cancelled) return;

        const pusher = createPusherClient({ token, userId, houseId });
        pusherRef.current = pusher;

        // Subscribe once
        if (!subscribedRef.current) {
          subscribedRef.current = true;

          // User-only channel (settlement paid to you)
          const userChannel = pusher.subscribe(`private-user.${userId}`);
          bindChannelDebug(userChannel, `private-user.${userId}`);
          userChannel.bind("settlement.paid", (payload: any) => {
            const from = payload?.fromName ?? "Someone";
            const amount = payload?.amount ?? payload?.amountFormatted ?? "";
            showWebNotification({
              title: "Settlement received",
              body: `${from} settled ${amount} with you`,
              force: true,
            });
            Toast.show({
              type: "realtime",
              text1: "Settlement received",
              text2: `${from} settled ${amount} with you`,
              visibilityTime: 4000,
              position: "top",
            });
          });

          userChannel.bind("karma.updated", async (payload: any) => {
            const delta = Number(payload?.delta ?? 0);
            const bal = payload?.karma_balance;
            const lvl = payload?.level;

            showWebNotification({
              title: delta > 0 ? `+${delta} Karma` : "Karma updated",
              body:
                bal != null && lvl != null
                  ? `Lvl ${lvl} • ${Number(bal).toLocaleString()} pts`
                  : undefined,
              force: true,
            });
            Toast.show({
              type: "realtime",
              text1: delta > 0 ? `+${delta} Karma` : "Karma updated",
              text2:
                bal != null && lvl != null
                  ? `Lvl ${lvl} • ${Number(bal).toLocaleString()} pts`
                  : undefined,
              visibilityTime: 3200,
              position: "top",
            });

            // Keep local cached user in sync for Profile header/badges.
            try {
              const raw = await AsyncStorage.getItem("user");
              if (!raw) return;
              const u = JSON.parse(raw);
              if (String(u?.id) !== String(payload?.userId ?? userId)) return;
              const next = {
                ...u,
                karma_balance: bal ?? u.karma_balance,
              };
              await AsyncStorage.setItem("user", JSON.stringify(next));
            } catch {
              // ignore
            }
          });

          // House channel (bill created)
          if (houseId) {
            const houseChannel = pusher.subscribe(`private-house.${houseId}`);
            bindChannelDebug(houseChannel, `private-house.${houseId}`);
            houseChannel.bind("bill.created", (payload: any) => {
              const who = payload?.paidByName ?? payload?.addedByName ?? "A mate";
              const bill = payload?.billName ?? payload?.description ?? "a bill";
              const shares = payload?.shares ?? null;
              const myShare =
                shares && typeof shares === "object" ? shares[String(userId)] ?? shares[userId] : null;
              const formatted =
                myShare != null && payload?.currency
                  ? `${payload.currency}${Number(myShare).toFixed(2)}`
                  : myShare != null
                    ? String(myShare)
                    : payload?.yourShareFormatted ?? payload?.yourShare;
              const shareText = formatted ? ` — your share is ${formatted}` : "";
              showWebNotification({
                title: "New bill added",
                body: `${who} added ${bill}${shareText}`,
                force: true,
              });
              Toast.show({
                type: "realtime",
                text1: "New bill added",
                text2: `${who} added ${bill}${shareText}`,
                visibilityTime: 4500,
                position: "top",
              });
            });
          }
        }
      } catch (e) {
        // no-op: realtime is best-effort
        console.log("Realtime boot failed", e);
      }
    };

    void boot();

    return () => {
      cancelled = true;
      try {
        if (pusherRef.current) {
          pusherRef.current.disconnect();
        }
      } catch {
        // ignore
      } finally {
        pusherRef.current = null;
        subscribedRef.current = false;
      }
    };
  }, [token]);

  // Re-register when app returns to foreground (e.g. user just enabled notifications in Settings).
  useEffect(() => {
    if (!token) return;
    const sub = AppState.addEventListener("change", (next) => {
      if (next === "active") {
        void registerExpoTokenWithBackend(token, { quietMissing: true });
      }
    });
    return () => sub.remove();
  }, [token]);
}

