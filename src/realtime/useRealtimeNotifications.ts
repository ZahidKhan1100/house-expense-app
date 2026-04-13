import { useEffect, useMemo, useRef } from "react";
import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";
import * as Notifications from "expo-notifications";
import { Platform } from "react-native";

import { apiClient } from "../utils/apiClient";
import { createPusherClient } from "./realtimeClient";

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

async function ensureExpoPushToken(): Promise<string | null> {
  if (Platform.OS === "web") return null;

  const perm = await Notifications.getPermissionsAsync();
  let status = perm.status;
  if (status !== "granted") {
    const req = await Notifications.requestPermissionsAsync();
    status = req.status;
  }
  if (status !== "granted") return null;

  const token = await Notifications.getExpoPushTokenAsync();
  return token.data ?? null;
}

export function useRealtimeNotifications(token: string | null) {
  const pusherRef = useRef<any>(null);
  const subscribedRef = useRef(false);

  useEffect(() => {
    if (!token) return;

    let cancelled = false;

    const boot = async () => {
      try {
        // Token registration (best-effort)
        const expoToken = await ensureExpoPushToken();
        if (expoToken) {
          try {
            await apiClient("/push-tokens", "POST", { token: expoToken });
          } catch {
            // backend may not have endpoint yet; ignore
          }
        }

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
          userChannel.bind("settlement.paid", (payload: any) => {
            const from = payload?.fromName ?? "Someone";
            const amount = payload?.amount ?? payload?.amountFormatted ?? "";
            Toast.show({
              type: "realtime",
              text1: "Settlement received",
              text2: `${from} settled ${amount} with you`,
              visibilityTime: 4000,
              position: "top",
            });
          });

          // House channel (bill created)
          if (houseId) {
            const houseChannel = pusher.subscribe(`private-house.${houseId}`);
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
}

