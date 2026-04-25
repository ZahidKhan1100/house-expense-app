import "../src/instrumentation/sentry";

import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Sentry from "@sentry/react-native";
import * as Linking from "expo-linking";
import * as Notifications from "expo-notifications";
import { Stack, useRouter } from "expo-router";
import { useContext, useEffect } from "react";
import { ActivityIndicator, StyleSheet, View } from "react-native";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { notifySessionTokenCommitted } from "../src/auth/sessionTokenBridge";
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

  return <Stack screenOptions={{ headerShown: false }} />;
}

function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const handleNotificationTap = (data: any) => {
      const type = String(data?.type ?? "");
      if (!type) return;

      if (type === "settlement.paid") {
        const month = String(data?.month ?? "").trim();
        router.push({
          pathname: "/settlements",
          params: month ? { month } : undefined,
        } as any);
        return;
      }

      if (type === "stock_buyback") {
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

    const sub = Notifications.addNotificationResponseReceivedListener(
      (resp) => {
        const data =
          resp?.notification?.request?.content?.data ??
          (resp as any)?.notification?.data ??
          null;
        handleNotificationTap(data);
      },
    );

    // App opened from a killed state by tapping a notification.
    void (async () => {
      try {
        const last = await Notifications.getLastNotificationResponseAsync();
        const data = last?.notification?.request?.content?.data ?? null;
        if (data) handleNotificationTap(data);
      } catch {
        // ignore
      }
    })();

    return () => sub.remove();
  }, [router]);

  useEffect(() => {
    const handleDeepLink = (event: { url: string }) => {
      const data = Linking.parse(event.url);

      if (__DEV__) {
        console.log("🔗 Deep link path:", data.path, "hostname:", data.hostname);
      }

      if (data.path === "reset-password") {
        router.push({
          pathname: "/reset-password",
          params: {
            token: data.queryParams?.token,
            email: data.queryParams?.email,
          },
        });
        return;
      }

      const inviteCode = tryParseHouseInviteUrl(event.url);
      if (inviteCode) {
        void (async () => {
          await setPendingHouseCode(inviteCode);
          const token = await AsyncStorage.getItem("token");
          if (token) {
            router.replace("/choose-house" as any);
          } else {
            router.replace("/(auth)/signup" as any);
          }
        })();
        return;
      }

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
        const token = Array.isArray(raw) ? raw[0] : raw;
        if (typeof token === "string" && token.length > 0) {
          void (async () => {
            try {
              await AsyncStorage.setItem("token", token);
              await AsyncStorage.removeItem("pending_email");
              notifySessionTokenCommitted(token);
              const profile = await apiClient("/profile", "GET", undefined, token);
              await AsyncStorage.setItem("user", JSON.stringify(profile));
              await AsyncStorage.setItem("active_mode", "house");
              const status = (profile as { status?: string })?.status;
              const houseId = (profile as { house_id?: number | null })?.house_id;
              if (status === "pending") {
                router.replace("/(tabs)/dashboard" as any);
              } else if (!houseId) {
                router.replace("/choose-house" as any);
              } else {
                router.replace("/(tabs)/dashboard" as any);
              }
            } catch (e) {
              console.warn("Email verify deep link: session failed", e);
              router.replace("/(auth)/login" as any);
            }
          })();
        }
      }
    };

    const sub = Linking.addEventListener("url", handleDeepLink);

    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => sub.remove();
  }, [router]);

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

export default Sentry.wrap(RootLayout);

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
});