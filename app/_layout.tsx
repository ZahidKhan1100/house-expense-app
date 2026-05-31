import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Linking from "expo-linking";
import * as WebBrowser from "expo-web-browser";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { useContext, useEffect, useRef } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { notifySessionTokenCommitted } from "../src/auth/sessionTokenBridge";
import { notifyStoredUserUpdated } from "../src/auth/userSessionBridge";
import { AuthContext, AuthProvider } from "../src/context/AuthContext";
import { SettlementLockProvider } from "../src/context/SettlementLockContext";
import { toastConfig } from "../src/realtime/toastConfig";
import { useRealtimeNotifications } from "../src/realtime/useRealtimeNotifications";
import { ThemeProvider } from "../src/theme/ThemeContext";
import { apiClient } from "../src/utils/apiClient";
import { PendingSyncListener } from "../src/offline/PendingSyncListener";
import { WhatsNewGate } from "../src/whatsnew/WhatsNewGate";
import {
  setPendingHouseCode,
  tryParseHouseInviteUrl,
} from "../src/utils/houseInviteLink";
import { parseResetPasswordLink } from "../src/utils/parseResetPasswordLink";

WebBrowser.maybeCompleteAuthSession();

/**
 * Listens to notification taps and routes after auth has settled.
 *
 * Mounted INSIDE AuthProvider's "loaded" branch so:
 *   - The Stack navigator is mounted before we call `router.push` (otherwise
 *     navigation calls are dropped and the user is stuck on the JS splash).
 *   - We can decide between protected route vs `/login` based on token.
 *   - We process the saved "last response" exactly once per app process,
 *     instead of re-firing on every cold start.
 */
function NotificationRouter() {
  const router = useRouter();
  const { loading, token } = useContext(AuthContext);
  const lastResponseHandled = useRef(false);
  const navigatorReadyDelayed = useRef(false);

  const handleData = (data: any) => {
    const type = String(data?.type ?? "");
    if (!type) return;

    const requiresAuth =
      type === "settlement.paid" ||
      type === "stock_buyback" ||
      type === "house.running_low" ||
      type === "house_calendar" ||
      type === "bill.created" ||
      type === "leaderboard.overtake";

    if (requiresAuth && !token) {
      router.replace("/(auth)/login" as any);
      return;
    }

    if (type === "settlement.paid" || type === "stock_buyback") {
      const month = String(data?.month ?? "").trim();
      router.push({
        pathname: "/settlements",
        params: month ? { month } : undefined,
      } as any);
      return;
    }
    if (type === "house.running_low") {
      router.push("/(tabs)/wall" as any);
      return;
    }
    if (type === "house_calendar") {
      router.push("/whos-home" as any);
      return;
    }
    if (type === "bill.created") {
      router.push("/(tabs)/dashboard" as any);
      return;
    }
    if (type === "leaderboard.overtake") {
      router.push("/(tabs)/mates" as any);
      return;
    }
  };

  // Live taps while the app is foreground or backgrounded (not killed).
  useEffect(() => {
    if (loading) return;
    const sub = Notifications.addNotificationResponseReceivedListener(
      (resp) => {
        const data =
          resp?.notification?.request?.content?.data ??
          (resp as any)?.notification?.data ??
          null;
        if (data) handleData(data);
      },
    );
    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, token]);

  // Cold start from a killed state via notification tap.
  // Process exactly once after auth is settled and after the navigator has
  // mounted; without the short delay, the first `router.push` can land
  // before the root Stack is ready and end up swallowed (user stuck on
  // splash).
  useEffect(() => {
    if (loading) return;
    if (lastResponseHandled.current) return;
    lastResponseHandled.current = true;

    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification?.request?.content?.data ?? null;
        if (!data) return;

        if (!navigatorReadyDelayed.current) {
          navigatorReadyDelayed.current = true;
          await new Promise((r) => setTimeout(r, 250));
        }
        handleData(data);
      } catch {
        // ignore
      }
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading]);

  return null;
}

/**
 * Handles inbound URLs once auth storage has finished loading and the root Stack exists.
 */
function DeepLinkRouter() {
  const router = useRouter();
  const { loading } = useContext(AuthContext);
  const initialUrlHandled = useRef(false);

  useEffect(() => {
    if (loading) return;

    const runWhenStackReady = (fn: () => void) => {
      requestAnimationFrame(() => {
        setTimeout(fn, 120);
      });
    };

    const handleDeepLink = (event: { url: string }) => {
      const url = event.url?.trim?.() ?? "";

      const resetParams = parseResetPasswordLink(url);
      if (resetParams) {
        runWhenStackReady(() =>
          router.replace({
            pathname: "/reset-password",
            params: resetParams as any,
          }),
        );
        return;
      }

      if (__DEV__) {
        const dbg = Linking.parse(url);
        console.log(
          "🔗 Deep link:",
          url,
          "path:",
          dbg.path,
          "hostname:",
          dbg.hostname,
        );
      }

      const inviteCode = tryParseHouseInviteUrl(url);
      if (inviteCode) {
        void (async () => {
          await setPendingHouseCode(inviteCode);
          const tokenStored = await AsyncStorage.getItem("token");
          runWhenStackReady(() =>
            tokenStored
              ? router.replace("/choose-house" as any)
              : router.replace("/(auth)/signup" as any),
          );
        })();
        return;
      }

      const data = Linking.parse(url);
      const pathNorm = String(data.path ?? "")
        .replace(/^\/+/, "")
        .toLowerCase();
      const hostNorm = String(data.hostname ?? "")
        .replace(/^\/+/, "")
        .toLowerCase();
      const isVerified =
        pathNorm === "verified" ||
        pathNorm.endsWith("/verified") ||
        hostNorm === "verified";
      if (isVerified) {
        const raw = data.queryParams?.token;
        const sessionToken = Array.isArray(raw) ? raw[0] : raw;
        if (typeof sessionToken === "string" && sessionToken.length > 0) {
          void (async () => {
            try {
              await AsyncStorage.setItem("token", sessionToken);
              await AsyncStorage.removeItem("pending_email");
              notifySessionTokenCommitted(sessionToken);
              const profile = await apiClient("/profile", "GET", undefined, sessionToken);
              await AsyncStorage.setItem("user", JSON.stringify(profile));
              notifyStoredUserUpdated();
              await AsyncStorage.setItem("active_mode", "house");
              const status = (profile as { status?: string })?.status;
              const houseId = (profile as { house_id?: number | null })?.house_id;
              runWhenStackReady(() => {
                if (status === "pending") {
                  router.replace("/(tabs)/dashboard" as any);
                } else if (!houseId) {
                  router.replace("/choose-house" as any);
                } else {
                  router.replace("/(tabs)/dashboard" as any);
                }
              });
            } catch (e) {
              console.warn("Email verify deep link: session failed", e);
              runWhenStackReady(() =>
                router.replace("/(auth)/login" as any),
              );
            }
          })();
        }
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);

    void Linking.getInitialURL().then((initial) => {
      if (!initial || initialUrlHandled.current) return;
      initialUrlHandled.current = true;
      handleDeepLink({ url: initial });
    });

    return () => sub.remove();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, router]);

  return null;
}

function AppContent() {
  const { loading, token } = useContext(AuthContext);

  // Boots Pusher listeners + Expo push token registration (best-effort)
  useRealtimeNotifications(token);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return (
    <>
      <DeepLinkRouter />
      <NotificationRouter />
      <Stack screenOptions={{ headerShown: false }} />
    </>
  );
}

function RootLayout() {
  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <GestureHandlerRootView style={styles.container}>
          <AuthProvider>
            <PendingSyncListener />
            <WhatsNewGate />
            <SettlementLockProvider>
              <AppContent />
            </SettlementLockProvider>
            <Toast config={toastConfig} />
          </AuthProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

export default RootLayout;

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
});