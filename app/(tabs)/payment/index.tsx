import { FontAwesome5, MaterialCommunityIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Dimensions,
  RefreshControl,
  ScrollView,
  Share,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useSettlementLock } from "../../../src/context/SettlementLockContext";
import { ApiClientError, apiClient } from "../../../src/utils/apiClient";
import { UserAvatar } from "../../../src/components/UserAvatar";
import { useTheme } from "../../../src/theme/ThemeContext";
import { useTabBarScrollSync } from "../../../src/context/TabBarScrollContext";

import * as Print from "expo-print";
import { useRouter } from "expo-router";
import * as Sharing from "expo-sharing";

const { width } = Dimensions.get("window");

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, "0")}`;
};

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

function escapeHtml(input: any) {
  return String(input ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");
}

export default function Payment() {
  const router = useRouter();
  const { isDark } = useTheme();
  const { onScroll, scrollEventThrottle } = useTabBarScrollSync();
  const { refreshSettlementLock } = useSettlementLock();

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [isPdfGenerating, setIsPdfGenerating] = useState(false);

  const [mates, setMates] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [categoryBreakdown, setCategoryBreakdown] = useState<any>({});
  const [currency, setCurrency] = useState("$");
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  /** Sum of stock buy-back settlement amounts for the month (separate from logged bills). */
  const [buybackMonthTotal, setBuybackMonthTotal] = useState(0);

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#1E293B",
    subText: isDark ? "#94A3B8" : "#64748B",
    accent: "#FF6A6A",
    border: isDark ? "#334155" : "#E2E8F0",
  };

  const fetchPayments = useCallback(
    async (showLoader = true) => {
      if (showLoader) setLoading(true);
      try {
        // Fetches data specifically for the selected month
        const data = await apiClient(
          `/payments/${currentMonth}`,
          "GET",
          undefined,
        );

        const matesWithPaid = (data.mates || []).map((m: any) => ({
          id: m.id,
          name: m.name,
          avatar_url: m.avatar_url,
          total_paid: data.paid_amounts?.[m.id] || 0,
        }));

        setMates(matesWithPaid);
        setTransactions(data.transactions || []);
        setCategoryBreakdown(data.category_breakdown || {});
        setCurrency(data.currency || "$");

        try {
          const settle = await apiClient(
            `/settlements?month=${currentMonth}`,
            "GET",
            undefined,
          );
          const list = Array.isArray(settle?.settlements)
            ? settle.settlements
            : [];
          const sum = list
            .filter((s: any) => s?.type === "stock_buyback")
            .reduce(
              (acc: number, s: any) => acc + Number(s?.amount ?? 0),
              0,
            );
          setBuybackMonthTotal(sum);
        } catch {
          setBuybackMonthTotal(0);
        }
      } catch (err: any) {
        if (err instanceof ApiClientError && err.status === 401) {
          router.replace("/(auth)/login");
          return;
        }
        console.log("Fetch Error:", err);
        // Handle case where no records exist for the month
        setMates([]);
        setTransactions([]);
        setCategoryBreakdown({});
        setBuybackMonthTotal(0);
      } finally {
        setLoading(false);
        setRefreshing(false);
        void refreshSettlementLock();
      }
    },
    [currentMonth, refreshSettlementLock],
  );

  // Trigger fetch whenever currentMonth changes
  useEffect(() => {
    fetchPayments();
  }, [fetchPayments]);

  const handleMonthStep = (step: number) => {
    const [year, monthNum] = currentMonth.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + step, 1);
    const newMonth = `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`;
    setCurrentMonth(newMonth);
  };

  const totalSpend = mates.reduce((acc, curr) => acc + curr.total_paid, 0);

  /** Ignore sub-cent noise so a fully settled month does not show 0.00 rows. */
  const remainingTransfers = useMemo(
    () => (transactions ?? []).filter((tx: any) => Number(tx.amount) >= 0.01),
    [transactions],
  );

  const shareMateSummary = async (mate: any) => {
    const bills = categoryBreakdown[mate.name] || {};
    const billList = Object.entries(bills)
      .map(([cat, data]: any) => {
        const items = Array.isArray(data?.items) ? data.items : [];
        const itemsLines = items
          .map(
            (it: any) =>
              `   - ${it?.title ?? "Item"}: ${currency}${Number(it?.amount ?? 0).toFixed(2)}`,
          )
          .join("\n");
        const total = Number(data?.total ?? 0);
        return `• ${cat}: ${currency}${total.toFixed(2)}${itemsLines ? `\n${itemsLines}` : ""}`;
      })
      .join("\n");

    const settleMsg = remainingTransfers
      .filter((tx) => tx.from === mate.id || tx.to === mate.id)
      .map((tx) => {
        const other = mates.find(
          (m) => m.id === (tx.from === mate.id ? tx.to : tx.from),
        );
        return tx.from === mate.id
          ? `💸 Pay ${other?.name}: ${currency}${tx.amount.toFixed(2)}`
          : `💰 Receive from ${other?.name}: ${currency}${tx.amount.toFixed(2)}`;
      })
      .join("\n");

    const message = `📊 Expense Summary for ${mate.name}\nMonth: ${formatMonthLabel(currentMonth)}\n\nPaid:\n${billList || "No breakdown available"}\n\nTotal: ${currency}${mate.total_paid.toFixed(2)}\n\nRemaining (after paid settlements):\n${settleMsg || "All settled!"}`;
    await Share.share({ message });
  };

  // Backwards-compatible name (older UI copy used "History")
  const shareMateHistory = shareMateSummary;

  const generatePDF = async () => {
    setIsPdfGenerating(true);
    try {
      let buybackRows: any[] = [];
      try {
        const res = await apiClient(
          `/settlements?month=${currentMonth}`,
          "GET",
          undefined,
        );
        const list = Array.isArray(res?.settlements) ? res.settlements : [];
        buybackRows = list.filter(
          (s: any) => s?.type === "stock_buyback" && Number(s?.amount) >= 0.01,
        );
      } catch (e) {
        console.log("settlements fetch for PDF:", e);
      }

      // 1. Group Summary Rows
      const summaryRows = mates
        .map(
          (m) => `
            <tr>
                <td>${m.name}</td>
                <td style="text-align: right;">${currency}${m.total_paid.toFixed(2)}</td>
            </tr>
        `,
        )
        .join("");

      // 2. Itemized Section (payer -> category -> items)
      const itemizedSections = mates
        .map((m) => {
          const bills = categoryBreakdown?.[m.name] || {};
          const categories = Object.entries(bills);

          const categoryTables = categories
            .map(([cat, data]: any) => {
              const items = Array.isArray(data?.items) ? data.items : [];
              const itemRows = items
                .map(
                  (it: any) => {
                    const excluded = it?.excluded_days_by_user ?? {};
                    const exPairs = Object.entries(excluded)
                      .map(([userId, days]: any) => {
                        const d = Number(days ?? 0);
                        if (!Number.isFinite(d) || d <= 0) return null;
                        const who =
                          mates.find((x: any) => String(x.id) === String(userId))
                            ?.name ?? `User ${userId}`;
                        return `${who}: ${Math.trunc(d)}d`;
                      })
                      .filter(Boolean)
                      .join(", ");

                    const exLine =
                      it?.split_method === "days" && exPairs
                        ? `<div style="margin-top: 4px; color: #94A3B8; font-size: 11px; font-weight: 700;">
                             Bill days: ${Number(it?.bill_period_days ?? "") || "-"} • Excluded days: ${escapeHtml(exPairs)}
                           </div>`
                        : "";

                    return `
                      <tr>
                        <td>
                          ${escapeHtml(it?.title ?? "Item")}
                          ${exLine}
                        </td>
                        <td style="text-align: right;">${currency}${Number(it?.amount ?? 0).toFixed(2)}</td>
                      </tr>
                    `;
                  },
                )
                .join("");
              const catTotal = Number(data?.total ?? 0);

              return `
                <div style="margin-top: 14px;">
                  <div style="display:flex; justify-content: space-between; align-items: baseline; gap: 12px;">
                    <h4 style="margin: 0; color: #334155;">${escapeHtml(cat)}</h4>
                    <div style="font-weight: 800; color: #FF6A6A;">${currency}${catTotal.toFixed(2)}</div>
                  </div>
                  <table>
                    <thead>
                      <tr>
                        <th>Item</th>
                        <th style="text-align: right;">Amount</th>
                      </tr>
                    </thead>
                    <tbody>
                      ${itemRows || `<tr><td colspan="2" style="text-align:center; padding: 12px;">No items</td></tr>`}
                    </tbody>
                  </table>
                </div>
              `;
            })
            .join("");

          const hasAny = categories.length > 0;
          return `
            <div style="margin-top: 22px; padding-top: 12px; border-top: 1px solid #E2E8F0;">
              <h3 style="margin: 0 0 10px 0; color: #64748B; font-size: 16px;">${escapeHtml(m.name)} paid</h3>
              ${hasAny ? categoryTables : `<div style="color:#94A3B8;">No expenses recorded</div>`}
            </div>
          `;
        })
        .join("");

      // 3. Settlement Rows
      const settlementRows = remainingTransfers.length > 0 
        ? remainingTransfers.map(tx => {
            const fromName =
              tx.from_name ??
              mates.find((m) => m.id === tx.from)?.name ??
              "Member";
            const toName =
              tx.to_name ??
              mates.find((m) => m.id === tx.to)?.name ??
              "Member";
            return `
              <tr>
                <td>${fromName}</td>
                <td style="text-align: center;">➔</td>
                <td>${toName}</td>
                <td style="text-align: right; font-weight: bold; color: #FF6A6A;">${currency}${tx.amount.toFixed(2)}</td>
              </tr>
            `;
          }).join("")
        : '<tr><td colspan="4" style="text-align: center; padding: 15px;">All debts are settled!</td></tr>';

      const buybackTableRows =
        buybackRows.length > 0
          ? buybackRows
              .map((tx: any) => {
                const fromName = escapeHtml(
                  tx.from_name ??
                    mates.find((m: any) => m.id === tx.from_user_id)?.name ??
                    "Unknown",
                );
                const toName = escapeHtml(
                  tx.to_name ??
                    mates.find((m: any) => m.id === tx.to_user_id)?.name ??
                    "Unknown",
                );
                const title = escapeHtml(tx.title ?? "Stock buy-back");
                const note = tx.note ? escapeHtml(tx.note) : "";
                const status =
                  tx.status === "paid"
                    ? '<span style="color:#047857;font-weight:800;">Paid</span>'
                    : '<span style="color:#BE123C;font-weight:800;">Pending</span>';
                const noteCell = note
                  ? `<div style="font-size:11px;color:#64748B;margin-top:4px;">${note}</div>`
                  : "";
                return `
              <tr>
                <td>${fromName}</td>
                <td style="text-align:center;">➔</td>
                <td>${toName}</td>
                <td style="text-align:right;font-weight:bold;color:#2EC4B6;">${currency}${Number(tx.amount).toFixed(2)}</td>
                <td>
                  <div style="font-weight:700;color:#334155;">${title}</div>
                  ${noteCell}
                </td>
                <td style="text-align:center;">${status}</td>
              </tr>
            `;
              })
              .join("")
          : `<tr><td colspan="6" style="text-align:center;padding:15px;">No stock buy-backs recorded for this month</td></tr>`;

      const html = `
        <html>
          <head>
            <style>
              body { font-family: 'Helvetica', sans-serif; color: #1E293B; padding: 20px; }
              h1 { color: #FF6A6A; margin-bottom: 5px; }
              h2 { border-bottom: 2px solid #E2E8F0; padding-bottom: 8px; margin-top: 30px; color: #334155; }
              h3 { color: #64748B; margin-bottom: 10px; font-size: 16px; }
              h4 { font-size: 14px; }
              table { width: 100%; border-collapse: collapse; margin-top: 10px; }
              th, td { border: 1px solid #E2E8F0; padding: 12px; text-align: left; }
              th { background-color: #F8FAFC; color: #64748B; text-transform: uppercase; font-size: 12px; }
              .total-box { background: #FF6A6A; color: white; padding: 15px; border-radius: 8px; margin-top: 10px; display: inline-block; }
            </style>
          </head>
          <body>
            <h1>Payment Report</h1>
            <p><strong>Month:</strong> ${formatMonthLabel(currentMonth)}</p>
            
            <div class="total-box">
              <strong>Total Group Spend:</strong> ${currency}${totalSpend.toLocaleString()}
            </div>

            <h2>1. Who Paid What</h2>
            <table>
              <thead>
                <tr>
                  <th>Member Name</th>
                  <th style="text-align: right;">Total Paid</th>
                </tr>
              </thead>
              <tbody>
                ${summaryRows}
              </tbody>
            </table>

            <h2>2. Who paid for which items (by category)</h2>
            ${itemizedSections}

            <h2>3. Remaining transfers — bill splits (after paid settlements)</h2>
            <p style="color:#64748B;font-size:13px;margin:0 0 10px 0;">Suggested payments from shared expenses for this month.</p>
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th style="text-align: center;">Action</th>
                  <th>To</th>
                  <th style="text-align: right;">Amount</th>
                </tr>
              </thead>
              <tbody>
                ${settlementRows}
              </tbody>
            </table>

            <h2>4. Stock buy-backs</h2>
            <p style="color:#64748B;font-size:13px;margin:0 0 10px 0;">Reimbursements for shared purchases (e.g. supplies, move-out items). Split evenly among selected roommates.</p>
            <table>
              <thead>
                <tr>
                  <th>From</th>
                  <th style="text-align:center;">Action</th>
                  <th>To</th>
                  <th style="text-align:right;">Amount</th>
                  <th>Title / note</th>
                  <th style="text-align:center;">Status</th>
                </tr>
              </thead>
              <tbody>
                ${buybackTableRows}
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
      console.error(e);
      Alert.alert("Error", "PDF generation failed");
    } finally {
      setIsPdfGenerating(false);
    }
  };

  if (loading && !refreshing)
    return (
      <View style={[styles.loader, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color={colors.accent} />
        <Text style={{ marginTop: 12, color: colors.subText }}>
          Loading {formatMonthLabel(currentMonth)}...
        </Text>
      </View>
    );

  return (
    <SafeAreaView style={[styles.safeArea, { backgroundColor: colors.bg }]}>
      <View style={styles.topHeader}>
        <View style={styles.headerTitleContainer}>
          <View style={styles.monthToggleRow}>
            <TouchableOpacity onPress={() => handleMonthStep(-1)} hitSlop={15}>
              <MaterialCommunityIcons
                name="chevron-left"
                size={32}
                color={colors.accent}
              />
            </TouchableOpacity>

            <View style={styles.titleCenter}>
              <Text style={[styles.title, { color: colors.text }]}>
                Payments
              </Text>
              <Text style={[styles.monthSubtitle, { color: colors.accent }]}>
                {formatMonthLabel(currentMonth)}
              </Text>
            </View>

            <TouchableOpacity onPress={() => handleMonthStep(1)} hitSlop={15}>
              <MaterialCommunityIcons
                name="chevron-right"
                size={32}
                color={colors.accent}
              />
            </TouchableOpacity>
          </View>
        </View>

        <View style={styles.headerActionGroup}>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.card }]}
            onPress={() =>
              router.push({
                pathname: "/settlements",
                params: { month: currentMonth },
              })
            }
          >
            <MaterialCommunityIcons
              name="cash-multiple"
              size={18}
              color={colors.accent}
            />
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.headerIconBtn, { backgroundColor: colors.card }]}
            onPress={generatePDF}
            disabled={isPdfGenerating}
          >
            {isPdfGenerating ? (
              <ActivityIndicator size="small" color={colors.accent} />
            ) : (
              <FontAwesome5 name="file-pdf" size={18} color={colors.accent} />
            )}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={() => fetchPayments(false)}
            tintColor={colors.accent}
          />
        }
        contentContainerStyle={styles.scrollContainer}
      >
        <LinearGradient colors={["#FF8E8E", "#FF6A6A"]} style={styles.heroCard}>
          <View style={styles.heroInfo}>
            <Text style={styles.heroLabel}>Total Group Spend</Text>
            <Text style={styles.heroAmount}>
              {currency}
              {totalSpend.toLocaleString()}
            </Text>
            {buybackMonthTotal >= 0.01 && (
              <TouchableOpacity
                onPress={() =>
                  router.push({
                    pathname: "/settlements",
                    params: { month: currentMonth },
                  })
                }
                style={styles.heroBuybackRow}
                activeOpacity={0.85}
                accessibilityRole="button"
                accessibilityLabel={`Buy-backs this month ${currency}${buybackMonthTotal.toFixed(2)}. Opens settlements.`}
              >
                <MaterialCommunityIcons
                  name="cash-refund"
                  size={18}
                  color="rgba(255,255,255,0.9)"
                />
                <View style={{ flex: 1 }}>
                  <Text style={styles.heroBuybackLabel}>
                    Buy-backs this month
                  </Text>
                  <Text style={styles.heroBuybackHint}>
                    Reimbursements · tap for details
                  </Text>
                </View>
                <Text style={styles.heroBuybackAmount}>
                  {currency}
                  {buybackMonthTotal.toFixed(2)}
                </Text>
                <MaterialCommunityIcons
                  name="chevron-right"
                  size={22}
                  color="rgba(255,255,255,0.75)"
                />
              </TouchableOpacity>
            )}
          </View>
          <View style={styles.heroIconBg}>
            <MaterialCommunityIcons
              name="bank-transfer"
              size={32}
              color="#fff"
            />
          </View>
        </LinearGradient>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Who Paid What
          </Text>
          <View
            style={[styles.dotSeparator, { backgroundColor: colors.border }]}
          />
        </View>

        <View style={styles.grid}>
          {mates.map((m) => (
            <View
              key={m.id}
              style={[
                styles.mateCard,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.mateHeader}>
                <View style={styles.mateAvatar}>
                  <UserAvatar
                    name={m.name ?? "?"}
                    avatarUrl={
                      typeof m.avatar_url === "string"
                        ? m.avatar_url.trim()
                        : null
                    }
                    size={28}
                    borderRadius={10}
                    bg="#FF6A6A20"
                    letterColor="#FF6A6A"
                    onPress={() => router.push(`/mate/${m.id}` as any)}
                  />
                </View>
                <Text
                  style={[styles.mateName, { color: colors.text }]}
                  numberOfLines={1}
                >
                  {m.name}
                </Text>
                <TouchableOpacity onPress={() => shareMateSummary(m)}>
                  <MaterialCommunityIcons
                    name="share-variant"
                    size={16}
                    color={colors.accent}
                  />
                </TouchableOpacity>
              </View>
              <Text style={[styles.mateAmount, { color: colors.accent }]}>
                {currency}
                {m.total_paid.toFixed(2)}
              </Text>
              <View
                style={[
                  styles.progressBar,
                  { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                ]}
              >
                <View
                  style={[
                    styles.progressFill,
                    {
                      width: `${((m.total_paid || 0) / (totalSpend || 1)) * 100}%`,
                    },
                  ]}
                />
              </View>
            </View>
          ))}
        </View>

        <View style={styles.sectionHeader}>
          <Text style={[styles.sectionTitle, { color: colors.text }]}>
            Remaining to settle
          </Text>
          <View
            style={[styles.dotSeparator, { backgroundColor: colors.border }]}
          />
        </View>

        {remainingTransfers.length === 0 ? (
          <View
            style={[
              styles.emptyState,
              { backgroundColor: isDark ? "#064E3B" : "#ECFDF5" },
            ]}
          >
            <MaterialCommunityIcons
              name="shield-check"
              size={40}
              color={isDark ? "#34D399" : "#059669"}
            />
            <Text
              style={[
                styles.emptyStateText,
                { color: isDark ? "#D1FAE5" : "#064E3B" },
              ]}
            >
              Perfectly Balanced!
            </Text>
          </View>
        ) : (
          remainingTransfers.map((tx, idx) => (
            <View
              key={idx}
              style={[
                styles.txRow,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.txSide}>
                <Text style={[styles.txName, { color: colors.text }]}>
                  {tx.from_name ??
                    mates.find((m) => m.id === tx.from)?.name ??
                    "Member"}
                </Text>
                <Text style={styles.txLabel}>Payer</Text>
              </View>
              <View style={styles.txCenter}>
                <Text style={styles.txAmountText}>
                  {currency}
                  {tx.amount.toFixed(2)}
                </Text>
                <View style={styles.arrowLine}>
                  <View style={styles.line} />
                  <MaterialCommunityIcons
                    name="chevron-right"
                    size={20}
                    color={colors.accent}
                  />
                </View>
              </View>
              <View style={styles.txSide}>
                <Text
                  style={[
                    styles.txName,
                    { color: colors.text, textAlign: "right" },
                  ]}
                >
                  {tx.to_name ??
                    mates.find((m) => m.id === tx.to)?.name ??
                    "Member"}
                </Text>
                <Text style={[styles.txLabel, { textAlign: "right" }]}>
                  Receiver
                </Text>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  topHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  headerTitleContainer: { flex: 1, alignItems: "flex-start" },
  monthToggleRow: { flexDirection: "row", alignItems: "center", gap: 5 },
  titleCenter: { alignItems: "flex-start" },
  title: { fontSize: 22, fontWeight: "900", letterSpacing: -0.5 },
  monthSubtitle: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
    marginTop: -2,
  },
  headerActionGroup: { flexDirection: "row", gap: 8 },
  headerIconBtn: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    elevation: 1,
  },
  scrollContainer: { paddingHorizontal: 20, paddingBottom: 40 },
  heroCard: {
    borderRadius: 24,
    padding: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  heroInfo: { flex: 1 },
  heroLabel: {
    color: "rgba(255,255,255,0.8)",
    fontWeight: "700",
    fontSize: 13,
    textTransform: "uppercase",
  },
  heroAmount: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 4 },
  heroBuybackRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginTop: 14,
    paddingTop: 14,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: "rgba(255,255,255,0.28)",
  },
  heroBuybackLabel: {
    color: "rgba(255,255,255,0.92)",
    fontSize: 13,
    fontWeight: "700",
  },
  heroBuybackHint: {
    color: "rgba(255,255,255,0.65)",
    fontSize: 11,
    fontWeight: "600",
    marginTop: 2,
  },
  heroBuybackAmount: {
    color: "#B8FFF6",
    fontSize: 16,
    fontWeight: "900",
    letterSpacing: -0.3,
  },
  heroIconBg: {
    width: 52,
    height: 52,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.25)",
    justifyContent: "center",
    alignItems: "center",
  },
  sectionHeader: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 25,
    marginBottom: 15,
    gap: 10,
  },
  sectionTitle: { fontSize: 18, fontWeight: "800" },
  dotSeparator: { flex: 1, height: 1 },
  grid: { flexDirection: "row", flexWrap: "wrap", gap: 12 },
  mateCard: {
    width: (width - 52) / 2,
    padding: 15,
    borderRadius: 20,
    borderWidth: 1,
  },
  mateHeader: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    marginBottom: 10,
  },
  mateAvatar: {
    width: 28,
    height: 28,
    borderRadius: 10,
    backgroundColor: "#FF6A6A20",
    justifyContent: "center",
    alignItems: "center",
  },
  mateName: { fontSize: 14, fontWeight: "700", flex: 1 },
  mateAmount: { fontSize: 18, fontWeight: "900" },
  progressBar: { height: 4, borderRadius: 2, marginTop: 8, overflow: "hidden" },
  progressFill: { height: "100%", backgroundColor: "#FF6A6A" },
  txRow: {
    flexDirection: "row",
    padding: 16,
    borderRadius: 20,
    marginBottom: 12,
    alignItems: "center",
    borderWidth: 1,
  },
  txSide: { flex: 1 },
  txCenter: { flex: 1.2, alignItems: "center" },
  txName: { fontSize: 14, fontWeight: "800" },
  txLabel: {
    fontSize: 10,
    color: "#94A3B8",
    fontWeight: "700",
    textTransform: "uppercase",
  },
  txAmountText: {
    fontSize: 15,
    fontWeight: "900",
    color: "#FF6A6A",
    marginBottom: 2,
  },
  arrowLine: { flexDirection: "row", alignItems: "center", width: "100%" },
  line: { flex: 1, height: 2, backgroundColor: "#FF6A6A20", borderRadius: 1 },
  emptyState: { padding: 30, borderRadius: 22, alignItems: "center", gap: 10 },
  emptyStateText: { fontWeight: "800", fontSize: 16 },
});
