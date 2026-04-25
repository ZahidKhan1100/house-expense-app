import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import ViewShot, { captureRef } from "react-native-view-shot";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { useSafeAreaInsets } from "react-native-safe-area-context";

import { apiClient } from "../../src/utils/apiClient";
import { useTheme } from "../../src/theme/ThemeContext";

const CORAL = "#FF6A6A";

/** Current calendar month (matches backend house-wrapped default). */
function getDefaultWrappedMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function getMaxWrappedMonth(): string {
  return getDefaultWrappedMonth();
}

function formatMonthLabel(ym: string) {
  try {
    return new Date(ym + "-02").toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return ym;
  }
}

type Wrapped = {
  month: string;
  house_name: string;
  total_house_spend_formatted: string;
  karma_king: {
    name: string;
    karma_balance: number;
    level: number;
    karma_earned_month: number | null;
  };
  most_active_poll: {
    post_id: number;
    question: string;
    engagement_count: number;
  } | null;
  share_line: string;
};

export default function HouseWrappedScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<Wrapped | null>(null);
  const [month, setMonth] = useState(getDefaultWrappedMonth);
  const [sharing, setSharing] = useState(false);
  const [shotRef, setShotRef] = useState<any>(null);

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0F172A" : "#F8FAFC",
      card: isDark ? "#1E293B" : "#FFFFFF",
      text: isDark ? "#F1F5F9" : "#0F172A",
      sub: isDark ? "#94A3B8" : "#64748B",
      border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    }),
    [isDark],
  );

  const handleMonthStep = useCallback((step: number) => {
    setMonth((prev) => {
      const [y, m] = prev.split("-").map(Number);
      const d = new Date(y, m - 1 + step, 1);
      return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
    });
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiClient(`/house-wrapped?month=${month}`, "GET");
      if (!res?.success) {
        throw new Error(res?.message ?? "Could not load");
      }
      setData({
        month: res.month,
        house_name: res.house_name,
        total_house_spend_formatted: res.total_house_spend_formatted ?? "$0",
        karma_king: res.karma_king,
        most_active_poll: res.most_active_poll ?? null,
        share_line: res.share_line,
      });
    } catch (e: any) {
      Alert.alert("House Wrapped", e?.message ?? "Try again later");
    } finally {
      setLoading(false);
    }
  }, [month]);

  useEffect(() => {
    load();
  }, [load]);

  const onShare = async () => {
    if (!data || !shotRef) return;
    try {
      setSharing(true);

      const tmp = await captureRef(shotRef, {
        format: "png",
        quality: 1,
        result: "tmpfile",
      });

      const safeHouse = String(data.house_name ?? "house")
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, "-")
        .replace(/^-|-$/g, "")
        .slice(0, 24);

      const dest = `${FileSystem.cacheDirectory}house-wrapped-${data.month}-${safeHouse}.png`;
      try {
        await FileSystem.deleteAsync(dest, { idempotent: true });
      } catch {}
      await FileSystem.copyAsync({ from: tmp, to: dest });

      const canShare = await Sharing.isAvailableAsync();
      if (!canShare) {
        Alert.alert("Share", "Sharing is not available on this device.");
        return;
      }

      await Sharing.shareAsync(dest, {
        mimeType: "image/png",
        dialogTitle: "Share House Wrapped",
      });
    } catch {
      Alert.alert("Share", "Could not open share sheet");
    } finally {
      setSharing(false);
    }
  };

  const maxMonth = getMaxWrappedMonth();

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/dashboard"))}
          style={styles.backBtn}
        >
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>House Wrapped</Text>
          <Text style={[styles.sub, { color: colors.sub }]}>Your month in one story card</Text>
        </View>
        <TouchableOpacity onPress={load} style={[styles.iconBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="refresh" size={18} color={CORAL} />
        </TouchableOpacity>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{
          // This screen is outside the bottom tab navigator, so we can't use
          // useBottomTabBarHeight(). Instead, pad for safe-area + a cushion
          // so the CTA stays reachable on Android.
          paddingBottom: Math.max(18, insets.bottom + 84),
        }}
      >
        <View style={[styles.monthRow, { paddingHorizontal: 18 }]}>
          <TouchableOpacity
            onPress={() => handleMonthStep(-1)}
            activeOpacity={0.85}
            style={[
              styles.monthBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <MaterialCommunityIcons name="chevron-left" size={20} color={CORAL} />
          </TouchableOpacity>
          <View style={{ flex: 1, alignItems: "center" }}>
            <Text style={[styles.monthLabel, { color: colors.text }]}>
              {formatMonthLabel(month)}
            </Text>
            <Text style={[styles.monthSub, { color: colors.sub }]}>{month}</Text>
          </View>
          <TouchableOpacity
            onPress={() => handleMonthStep(1)}
            activeOpacity={0.85}
            disabled={month >= maxMonth}
            style={[
              styles.monthBtn,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
                opacity: month >= maxMonth ? 0.45 : 1,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="chevron-right"
              size={20}
              color={CORAL}
            />
          </TouchableOpacity>
        </View>

        {loading || !data ? (
          <View style={styles.loader}>
            <ActivityIndicator size="large" color={CORAL} />
          </View>
        ) : (
          <View style={{ paddingHorizontal: 18, paddingTop: 8 }}>
            <ViewShot
              ref={setShotRef}
              options={{ format: "png", quality: 1 }}
              style={{ borderRadius: 24, overflow: "hidden" }}
            >
              <LinearGradient
                colors={["#312E81", "#FF6A6A", "#EA580C"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.hero}
              >
                <Text style={styles.heroKicker}>Habimate House Wrapped</Text>
                <Text style={styles.heroMonth}>{formatMonthLabel(data.month)}</Text>
                <Text style={styles.heroHouse}>{data.house_name}</Text>

                <View style={styles.spendBlock}>
                  <Text style={styles.spendLabel}>Total house spend</Text>
                  <Text style={styles.spendValue}>
                    {data.total_house_spend_formatted}
                  </Text>
                </View>

                <View style={styles.kingRow}>
                  <MaterialCommunityIcons name="crown" size={24} color="#FFD700" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.kingLabel}>Karma King of the month</Text>
                    <Text style={styles.kingName}>@{data.karma_king.name}</Text>
                    <Text style={styles.kingMeta}>
                      {data.karma_king.karma_earned_month != null
                        ? `${data.karma_king.karma_earned_month.toLocaleString()} pts earned · `
                        : ""}
                      Lvl {data.karma_king.level} ·{" "}
                      {data.karma_king.karma_balance.toLocaleString()} pts balance
                    </Text>
                  </View>
                </View>

                {data.most_active_poll ? (
                  <View style={styles.pollBlock}>
                    <Text style={styles.pollLabel}>Most buzzing poll</Text>
                    <Text style={styles.pollQ} numberOfLines={3}>
                      “{data.most_active_poll.question}”
                    </Text>
                    <Text style={styles.pollEng}>
                      {data.most_active_poll.engagement_count} reactions (votes, hearts & emojis)
                    </Text>
                  </View>
                ) : (
                  <View style={styles.pollBlock}>
                    <Text style={styles.pollMuted}>
                      No poll heat this month — start one on the wall.
                    </Text>
                  </View>
                )}

                <View style={styles.brandRow}>
                  <MaterialCommunityIcons
                    name="home-heart"
                    size={16}
                    color="rgba(255,255,255,0.92)"
                  />
                  <Text style={styles.brandText}>Habimate</Text>
                </View>
              </LinearGradient>
            </ViewShot>

            <Text style={[styles.blurb, { color: colors.sub }]}>{data.share_line}</Text>

            <TouchableOpacity
              style={[styles.shareBtn, sharing && { opacity: 0.7 }]}
              onPress={onShare}
              activeOpacity={0.9}
              disabled={sharing}
            >
              {sharing ? (
                <ActivityIndicator color="#fff" />
              ) : (
                <>
                  <MaterialCommunityIcons name="instagram" size={22} color="#fff" />
                  <Text style={styles.shareBtnText}>Share to Stories / TikTok</Text>
                </>
              )}
            </TouchableOpacity>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: CORAL, alignItems: "center", justifyContent: "center" },
  iconBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "900" },
  sub: { fontSize: 12, fontWeight: "700", marginTop: -2 },
  monthRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingBottom: 10 },
  monthBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  monthLabel: { fontWeight: "900", fontSize: 14 },
  monthSub: { fontWeight: "800", fontSize: 11, marginTop: 2 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { borderRadius: 24, padding: 20, marginBottom: 16 },
  heroKicker: { color: "rgba(255,255,255,0.88)", fontWeight: "800", fontSize: 11, textTransform: "uppercase", letterSpacing: 1 },
  heroMonth: { color: "#fff", fontWeight: "900", fontSize: 26, marginTop: 6 },
  heroHouse: { color: "rgba(255,255,255,0.95)", fontWeight: "800", fontSize: 15, marginBottom: 18 },
  spendBlock: {
    backgroundColor: "rgba(0,0,0,0.25)",
    borderRadius: 18,
    padding: 16,
    marginBottom: 14,
  },
  spendLabel: { color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 11, textTransform: "uppercase" },
  spendValue: { color: "#fff", fontWeight: "900", fontSize: 36, marginTop: 6, letterSpacing: -1 },
  kingRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: 14, borderRadius: 16, backgroundColor: "rgba(0,0,0,0.22)" },
  kingLabel: { color: "rgba(255,255,255,0.8)", fontWeight: "800", fontSize: 11, textTransform: "uppercase" },
  kingName: { color: "#fff", fontWeight: "900", fontSize: 18, marginTop: 2 },
  kingMeta: { color: "rgba(255,255,255,0.9)", fontWeight: "700", fontSize: 12, marginTop: 4 },
  pollBlock: {
    marginTop: 12,
    padding: 14,
    borderRadius: 16,
    backgroundColor: "rgba(0,0,0,0.18)",
  },
  pollLabel: { color: "rgba(255,255,255,0.8)", fontWeight: "800", fontSize: 11, textTransform: "uppercase", marginBottom: 6 },
  pollQ: { color: "#fff", fontWeight: "800", fontSize: 15, lineHeight: 21 },
  pollEng: { color: "rgba(255,255,255,0.88)", fontWeight: "700", fontSize: 12, marginTop: 8 },
  pollMuted: { color: "rgba(255,255,255,0.85)", fontWeight: "700", fontSize: 13 },
  brandRow: { flexDirection: "row", alignItems: "center", gap: 8, marginTop: 14, opacity: 0.92 },
  brandText: { color: "rgba(255,255,255,0.95)", fontWeight: "900", fontSize: 13 },
  blurb: { fontWeight: "700", fontSize: 14, lineHeight: 20, marginBottom: 16 },
  shareBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    backgroundColor: CORAL,
    paddingVertical: 16,
    borderRadius: 16,
  },
  shareBtnText: { color: "#fff", fontWeight: "900", fontSize: 16 },
});
