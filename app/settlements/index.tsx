import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  Platform,
  RefreshControl,
  ScrollView,
  Share,
  StatusBar,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import DateTimePicker from "@react-native-community/datetimepicker";
import * as Print from "expo-print";
import * as Sharing from "expo-sharing";
import { useKarmaBurst } from "../../src/rewards/useKarmaBurst";
import { useFocusEffect } from "@react-navigation/native";

import { useSettlementLock } from "../../src/context/SettlementLockContext";
import { useTheme } from "../../src/theme/ThemeContext";
import { apiClient } from "../../src/utils/apiClient";

const { width } = Dimensions.get("window");

// Helper: Get local YYYY-MM
const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
};

function formatMonthLabel(ym: string) {
  try {
    // Adding -02 ensures we don't hit timezone wrap-around issues
    return new Date(ym + "-02").toLocaleString("default", {
      month: "long",
      year: "numeric",
    });
  } catch {
    return ym;
  }
}

function escapeHtml(input: any) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function Settlements() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ month?: string }>();
  const month = raw.month ?? getCurrentMonth();

  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [generating, setGenerating] = useState(false);
  const [showPicker, setShowPicker] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const [mates, setMates] = useState<
    Record<number, { id: number; name?: string }>
  >({});
  const [settlements, setSettlements] = useState<any[]>([]);
  const [currency, setCurrency] = useState("$");
  const { burst, KarmaBurst } = useKarmaBurst();
  const { refreshSettlementLock } = useSettlementLock();

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0F172A" : "#F8FAFC",
      card: isDark ? "#1E293B" : "#FFFFFF",
      text: isDark ? "#F1F5F9" : "#1E293B",
      sub: isDark ? "#94A3B8" : "#64748B",
      border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
      primary: "#FF6A6A",
      paidBg: isDark ? "#064E3B" : "#ECFDF5",
      paidBorder: isDark ? "#047857" : "#A7F3D0",
      paidText: isDark ? "#6EE7B7" : "#059669",
    }),
    [isDark],
  );

  // NAVIGATION LOGIC: Increments or decrements month
  const handleMonthStep = (step: number) => {
    const [year, monthNum] = month.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + step, 1);
    const newMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    router.setParams({ month: newMonth });
  };

  const onDateChange = (event: any, selectedDate?: Date) => {
    if (Platform.OS === "android") setShowPicker(false);

    if (selectedDate && event.type !== "dismissed") {
      const y = selectedDate.getFullYear();
      const m = (selectedDate.getMonth() + 1).toString().padStart(2, "0");
      router.setParams({ month: `${y}-${m}` });
    }
  };

  const resolveName = useCallback(
    (tx: any, role: "from" | "to") => {
      const id = role === "from" ? tx.from_user_id : tx.to_user_id;
      const direct =
        role === "from"
          ? (tx.from_name ?? tx.from_user?.name)
          : (tx.to_name ?? tx.to_user?.name);
      if (direct) return direct;
      return mates[id]?.name ?? "User";
    },
    [mates],
  );

  const fetchData = useCallback(
    async (showFullLoader = true) => {
      if (showFullLoader) setLoading(true);
      try {
        const res = await apiClient(`/settlements?month=${month}`, "GET");
        setSettlements(res.settlements || []);
        setCurrency(res.currency || "$");

        const map: Record<number, { id: number; name?: string }> = {};
        (res.settlements || []).forEach((s: any) => {
          const fromId = s.from_user_id;
          const toId = s.to_user_id;
          map[fromId] = {
            id: fromId,
            name: s.from_name ?? s.from_user?.name ?? map[fromId]?.name,
          };
          map[toId] = {
            id: toId,
            name: s.to_name ?? s.to_user?.name ?? map[toId]?.name,
          };
        });
        setMates(map);
      } catch (e) {
        console.log(e);
      } finally {
        if (showFullLoader) setLoading(false);
        setRefreshing(false);
      }
    },
    [month],
  );

  useEffect(() => {
    fetchData(true);
  }, [fetchData]);

  // Refresh when returning from sub-screens (e.g. buy-backs)
  useFocusEffect(
    useCallback(() => {
      void fetchData(false);
      return () => {};
    }, [fetchData]),
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchData(false);
  }, [fetchData]);

  const pendingCount = settlements.filter((s) => s.status !== "paid").length;

  const runGeneratePlan = useCallback(async () => {
    setGenerating(true);
    try {
      await apiClient(`/settlements/generate`, "POST", { month });
      await fetchData(false);
    } catch (e: any) {
      Alert.alert(
        "Could not build plan",
        e?.message ?? "Try again or check your connection.",
      );
    } finally {
      setGenerating(false);
    }
  }, [month, fetchData]);

  const onGeneratePlan = useCallback(() => {
    if (pendingCount > 0) {
      Alert.alert(
        "Replace pending transfers?",
        "This rebuilds pending rows from current expense balances. Completed (paid) transfers are not removed.",
        [
          { text: "Cancel", style: "cancel" },
          { text: "Continue", onPress: () => void runGeneratePlan() },
        ],
      );
      return;
    }
    void runGeneratePlan();
  }, [pendingCount, runGeneratePlan]);

  const pendingTotal = settlements
    .filter((s) => s.status !== "paid")
    .reduce((acc, s) => acc + Number(s.amount || 0), 0);

  const paidTotal = settlements
    .filter((s) => s.status === "paid")
    .reduce((acc, s) => acc + Number(s.amount || 0), 0);

  const onSharePdf = useCallback(async () => {
    setIsPdfGenerating(true);
    try {
      const pending = settlements.filter((s) => s.status !== "paid");
      const paid = settlements.filter((s) => s.status === "paid");

      const rowHtml = (tx: any, badge: string) => {
        const from = escapeHtml(resolveName(tx, "from"));
        const to = escapeHtml(resolveName(tx, "to"));
        const amt = `${currency}${Number(tx.amount || 0).toFixed(2)}`;
        const kind =
          tx.type === "stock_buyback"
            ? '<span style="color:#0F766E;font-weight:800;">Buy-back</span>'
            : '<span style="color:#475569;font-weight:700;">Bill split</span>';
        const detailParts = [tx.title, tx.note].filter(
          (x: any) => x && String(x).trim(),
        );
        const detail =
          detailParts.length > 0
            ? escapeHtml(detailParts.join(" — "))
            : "—";
        return `
          <tr>
            <td>${from}</td>
            <td style="text-align:center;">➔</td>
            <td>${to}</td>
            <td style="text-align:right; font-weight: 800;">${amt}</td>
            <td style="text-align:center;">${kind}</td>
            <td style="font-size:12px;color:#475569;">${detail}</td>
            <td style="text-align:center;">${badge}</td>
          </tr>
        `;
      };

      const pendingRows =
        pending.length > 0
          ? pending.map((tx) => rowHtml(tx, "⏳ Pending")).join("")
          : `<tr><td colspan="7" style="text-align:center; padding: 14px;">No remaining transfers</td></tr>`;

      const paidRows =
        paid.length > 0
          ? paid.map((tx) => rowHtml(tx, "✅ Paid")).join("")
          : `<tr><td colspan="7" style="text-align:center; padding: 14px;">No paid settlements yet</td></tr>`;

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; color: #1E293B; padding: 20px; }
              h1 { color: #FF6A6A; margin-bottom: 5px; }
              h2 { border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-top: 24px; color: #334155; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #E2E8F0; padding: 12px; text-align: left; }
              th { background-color: #F8FAFC; color: #64748B; text-transform: uppercase; font-size: 12px; }
              .pillRow { margin-top: 10px; display: flex; gap: 10px; flex-wrap: wrap; }
              .pill { display: inline-block; padding: 10px 12px; border-radius: 999px; font-weight: 800; font-size: 12px; }
              .pill.pending { background: #FFF1F2; color: #BE123C; }
              .pill.paid { background: #ECFDF5; color: #047857; }
              .pill.total { background: #FF6A6A; color: #fff; }
            </style>
          </head>
          <body>
            <h1>Settlements Report</h1>
            <p><strong>Month:</strong> ${escapeHtml(formatMonthLabel(month))}</p>

            <div class="pillRow">
              <div class="pill total">Total rows: ${settlements.length}</div>
              <div class="pill pending">Remaining: ${currency}${pendingTotal.toFixed(2)} (${pending.length})</div>
              <div class="pill paid">Paid: ${currency}${paidTotal.toFixed(2)} (${paid.length})</div>
            </div>

            <h2>1. Remaining (Pending)</h2>
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th style="text-align:center;">Action</th>
                  <th>To</th>
                  <th style="text-align:right;">Amount</th>
                  <th style="text-align:center;">Type</th>
                  <th>Details</th>
                  <th style="text-align:center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${pendingRows}
              </tbody>
            </table>

            <h2>2. Paid settlements</h2>
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th style="text-align:center;">Action</th>
                  <th>To</th>
                  <th style="text-align:right;">Amount</th>
                  <th style="text-align:center;">Type</th>
                  <th>Details</th>
                  <th style="text-align:center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${paidRows}
              </tbody>
            </table>

            <div style="margin-top: 50px; text-align: center; font-size: 10px; color: #94A3B8;">
              Generated on ${new Date().toLocaleDateString()} via HabiMate
            </div>
          </body>
        </html>
      `;

      const { uri } = await Print.printToFileAsync({ html });
      await Sharing.shareAsync(uri, {
        UTI: ".pdf",
        mimeType: "application/pdf",
      });
    } catch (e) {
      console.log(e);
      Alert.alert("Error", "PDF generation failed");
    } finally {
      setIsPdfGenerating(false);
    }
  }, [
    currency,
    month,
    paidTotal,
    pendingTotal,
    resolveName,
    settlements,
  ]);

  const onShare = async () => {
    const text = settlements
      .map((tx) => {
        const from = resolveName(tx, "from");
        const to = resolveName(tx, "to");
        return `${from} → ${to}: ${currency}${Number(tx.amount).toFixed(2)} ${tx.status === "paid" ? "✅ PAID" : "⏳ PENDING"}`;
      })
      .join("\n");

    await Share.share({
      message: `💸 Settlement plan — ${formatMonthLabel(month)}\n\n${text || "All settled!"}`,
    });
  };

  const markPaid = async (id: number) => {
    setSettlements((prev) =>
      prev.map((s) =>
        s.id === id ? { ...s, status: "paid", settled_at: new Date() } : s,
      ),
    );
    try {
      await apiClient(`/settlements/${id}/mark-paid`, "POST");
      void refreshSettlementLock();
      // Optimistic dopamine: show the reward burst (backend awards based on 12h rule)
      burst("+50 Karma");
    } catch (e) {
      fetchData(false);
      console.log(e);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/payment");
  };

  if (loading && !refreshing) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.safe, { backgroundColor: colors.bg }]}
      edges={["top"]}
    >
      <KarmaBurst />
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />

      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.circularBackBtn}>
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>

        {/* Updated Month Picker Header */}
        <View style={styles.headerTitleContainer}>
          <View style={styles.monthToggleRow}>
            <TouchableOpacity onPress={() => handleMonthStep(-1)} hitSlop={15}>
              <MaterialCommunityIcons
                name="chevron-left"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setShowPicker(true)}
              style={styles.titleCenter}
            >
              <Text style={[styles.screenTitle, { color: colors.text }]}>
                Settlements
              </Text>
              <Text style={[styles.screenSubtitle, { color: colors.sub }]}>
                {formatMonthLabel(month)}{" "}
                <MaterialCommunityIcons name="menu-down" size={14} />
              </Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => handleMonthStep(1)} hitSlop={15}>
              <MaterialCommunityIcons
                name="chevron-right"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerActionRow}>
          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={onSharePdf}
            disabled={isPdfGenerating}
          >
            {isPdfGenerating ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <FontAwesome5 name="file-pdf" size={16} color={colors.primary} />
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[
              styles.headerActionBtn,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
            onPress={onShare}
          >
            <MaterialCommunityIcons
              name="share-variant"
              size={18}
              color={colors.primary}
            />
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={styles.scrollContent}
      >
        <Animated.View entering={FadeInUp.duration(500).springify()}>
          <LinearGradient
            colors={["#FF8E8E", "#FF6A6A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.heroCard}
          >
            <View style={styles.heroCol}>
              <Text style={styles.heroLabel}>Transfers this month</Text>
              <Text style={styles.heroStat}>{settlements.length}</Text>
              <Text style={styles.heroHint}>
                {settlements.length === 0
                  ? "Tap below to create rows from expenses"
                  : pendingCount === 0
                    ? "No pending transfers"
                    : `${pendingCount} still pending`}
              </Text>
            </View>
            <View style={styles.heroColRight}>
              <Text style={styles.heroLabel}>Outstanding</Text>
              <Text style={styles.heroAmount}>
                {currency}
                {pendingTotal.toLocaleString(undefined, {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </Text>
              <View style={styles.heroIconBg}>
                <MaterialCommunityIcons
                  name="bank-transfer-out"
                  size={28}
                  color="#fff"
                />
              </View>
            </View>
          </LinearGradient>
        </Animated.View>

        <TouchableOpacity
          style={[
            styles.generatePlanBtn,
            generating && styles.generatePlanBtnDisabled,
          ]}
          onPress={onGeneratePlan}
          disabled={generating}
          activeOpacity={0.85}
        >
          {generating ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons
                name="cash-sync"
                size={20}
                color="#fff"
              />
              <Text style={styles.generatePlanBtnText}>
                Build settlement plan
              </Text>
            </>
          )}
        </TouchableOpacity>

        <TouchableOpacity
          style={[
            styles.generatePlanBtn,
            { marginTop: 10, backgroundColor: "#2EC4B6" },
          ]}
          onPress={() => router.push({ pathname: "/buybacks/new", params: { month } } as any)}
          activeOpacity={0.85}
        >
          <MaterialCommunityIcons name="refresh" size={20} color="#fff" />
          <Text style={styles.generatePlanBtnText}>Record stock buy-back</Text>
        </TouchableOpacity>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Who pays whom
          </Text>
          <View
            style={[styles.dotSeparator, { backgroundColor: colors.border }]}
          />
        </View>

        {settlements.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              {
                backgroundColor: colors.card,
                borderColor: colors.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="clipboard-text-outline"
              size={40}
              color={colors.primary}
            />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>
              No settlement rows yet
            </Text>
            <Text style={[styles.emptySub, { color: colors.sub }]}>
              Expenses are tracked separately. Use “Build settlement plan” above
              to create pending transfers from this month’s balances (or you may
              be perfectly even).
            </Text>
          </View>
        ) : (
          settlements.map((tx) => {
            const from = resolveName(tx, "from");
            const to = resolveName(tx, "to");
            const isPaid = tx.status === "paid";
            const isBuyback = tx.type === "stock_buyback";
            return (
              <View
                key={tx.id}
                style={[
                  styles.txRow,
                  {
                    backgroundColor: isPaid ? colors.paidBg : colors.card,
                    borderColor: isPaid ? colors.paidBorder : colors.border,
                  },
                ]}
              >
                <View style={styles.txRowTop}>
                  <View style={styles.txSide}>
                    <View style={styles.nameRow}>
                      <View
                        style={[
                          styles.miniAvatar,
                          { backgroundColor: colors.primary + "22" },
                        ]}
                      >
                        <Text style={styles.miniAvatarText}>
                          {from.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text
                          style={[styles.txName, { color: colors.text }]}
                          numberOfLines={1}
                        >
                          {from}
                        </Text>
                        <Text style={[styles.txLabel, { color: colors.sub }]}>
                          Pays
                        </Text>
                      </View>
                    </View>
                  </View>

                  <View style={styles.txCenter}>
                    <Text style={styles.txAmountText}>
                      {currency}
                      {Number(tx.amount).toFixed(2)}
                    </Text>
                    <View style={styles.arrowLine}>
                      <View
                        style={[
                          styles.line,
                          {
                            backgroundColor: isPaid
                              ? colors.paidText + "33"
                              : colors.primary + "33",
                          },
                        ]}
                      />
                      <MaterialCommunityIcons
                        name="chevron-right"
                        size={20}
                        color={isPaid ? colors.paidText : colors.primary}
                      />
                    </View>
                  </View>

                  <View style={[styles.txSide, { alignItems: "flex-end" }]}>
                    <View
                      style={[styles.nameRow, { flexDirection: "row-reverse" }]}
                    >
                      <View
                        style={[
                          styles.miniAvatar,
                          {
                            backgroundColor: isPaid
                              ? colors.paidText + "33"
                              : "#6366F1" + "33",
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.miniAvatarText,
                            { color: isPaid ? colors.paidText : "#6366F1" },
                          ]}
                        >
                          {to.charAt(0).toUpperCase()}
                        </Text>
                      </View>
                      <View style={{ flex: 1, alignItems: "flex-end" }}>
                        <Text
                          style={[
                            styles.txName,
                            { color: colors.text, textAlign: "right" },
                          ]}
                          numberOfLines={1}
                        >
                          {to}
                        </Text>
                        <Text
                          style={[
                            styles.txLabel,
                            { color: colors.sub, textAlign: "right" },
                          ]}
                        >
                          Receives
                        </Text>
                      </View>
                    </View>
                  </View>
                </View>

                {isBuyback && (
                  <View style={{ marginTop: 10 }}>
                    <View
                      style={{
                        alignSelf: "flex-start",
                        paddingHorizontal: 10,
                        paddingVertical: 6,
                        borderRadius: 999,
                        backgroundColor: isDark ? "rgba(46,196,182,0.18)" : "rgba(46,196,182,0.12)",
                        borderWidth: 1,
                        borderColor: isDark ? "rgba(46,196,182,0.35)" : "rgba(46,196,182,0.25)",
                      }}
                    >
                      <Text
                        style={{
                          fontSize: 12,
                          fontWeight: "800",
                          color: "#2EC4B6",
                        }}
                      >
                        Stock buy-back{tx.title ? ` · ${tx.title}` : ""}
                      </Text>
                    </View>
                    {!!tx.note && (
                      <Text style={{ marginTop: 6, fontSize: 12, color: colors.sub }}>
                        {String(tx.note)}
                      </Text>
                    )}
                  </View>
                )}

                <View style={styles.actionRow}>
                  {isPaid ? (
                    <View style={styles.paidPill}>
                      <MaterialCommunityIcons
                        name="check-decagram"
                        size={16}
                        color={colors.paidText}
                      />
                      <Text
                        style={[
                          styles.paidPillText,
                          { color: colors.paidText },
                        ]}
                      >
                        Paid
                      </Text>
                    </View>
                  ) : (
                    <TouchableOpacity
                      style={styles.markPaidBtn}
                      onPress={() => markPaid(tx.id)}
                      activeOpacity={0.85}
                    >
                      <Text style={styles.markPaidBtnText}>Mark paid</Text>
                      <MaterialCommunityIcons
                        name="check"
                        size={18}
                        color="#fff"
                      />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            );
          })
        )}
      </ScrollView>

      {showPicker && (
        <DateTimePicker
          value={new Date(month + "-02")}
          mode="date"
          display={Platform.OS === "ios" ? "spinner" : "default"}
          onChange={onDateChange}
        />
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  circularBackBtn: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: "#FF6A6A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: { flex: 1, alignItems: "center" },
  monthToggleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  titleCenter: { alignItems: "center" },
  screenTitle: { fontSize: 20, fontWeight: "900", letterSpacing: -0.5 },
  screenSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerActionBtn: {
    width: 40,
    height: 40,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  headerActionRow: { flexDirection: "row", gap: 8 },
  scrollContent: { paddingHorizontal: 20, paddingBottom: 40 },
  generatePlanBtn: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    backgroundColor: "#FF6A6A",
    paddingVertical: 14,
    paddingHorizontal: 18,
    borderRadius: 16,
    marginBottom: 8,
  },
  generatePlanBtnDisabled: { opacity: 0.75 },
  generatePlanBtnText: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 15,
  },
  heroCard: {
    borderRadius: 24,
    padding: 22,
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 8,
  },
  heroCol: { flex: 1 },
  heroColRight: { flex: 1, alignItems: "flex-end" },
  heroLabel: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
    fontSize: 10,
    textTransform: "uppercase",
  },
  heroStat: { color: "#fff", fontSize: 32, fontWeight: "900" },
  heroHint: { color: "#fff", fontSize: 12, fontWeight: "600" },
  heroAmount: { color: "#fff", fontSize: 22, fontWeight: "900" },
  heroIconBg: {
    marginTop: 8,
    width: 44,
    height: 44,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 20,
    marginBottom: 12,
    gap: 10,
  },
  sectionTitle: { fontSize: 16, fontWeight: "800" },
  dotSeparator: { flex: 1, height: 1 },
  emptyState: {
    padding: 30,
    borderRadius: 20,
    alignItems: "center",
    borderWidth: 1,
  },
  emptyTitle: { fontWeight: "800", fontSize: 16 },
  emptySub: { fontSize: 12, textAlign: "center" },
  txRow: { borderRadius: 20, marginBottom: 12, borderWidth: 1, padding: 16 },
  txRowTop: { flexDirection: "row", alignItems: "center" },
  txSide: { flex: 1 },
  txCenter: { flex: 1.2, alignItems: "center" },
  txName: { fontSize: 13, fontWeight: "800" },
  txLabel: { fontSize: 9, fontWeight: "700", textTransform: "uppercase" },
  txAmountText: { fontSize: 14, fontWeight: "900", color: "#FF6A6A" },
  arrowLine: { flexDirection: "row", alignItems: "center", width: "100%" },
  line: { flex: 1, height: 2 },
  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  miniAvatar: {
    width: 32,
    height: 32,
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
  },
  miniAvatarText: { fontWeight: "800", fontSize: 12, color: "#FF6A6A" },
  actionRow: {
    marginTop: 12,
    paddingTop: 10,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(0,0,0,0.1)",
    alignItems: "center",
  },
  paidPill: { flexDirection: "row", alignItems: "center", gap: 4 },
  paidPillText: { fontWeight: "800", fontSize: 12 },
  markPaidBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#FF6A6A",
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 12,
  },
  markPaidBtnText: { color: "#fff", fontWeight: "800", fontSize: 13 },
});
