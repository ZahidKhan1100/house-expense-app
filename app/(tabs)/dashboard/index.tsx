import React, { useCallback, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  StatusBar,
} from "react-native";
import {
  MaterialIcons,
  FontAwesome5,
  MaterialCommunityIcons,
} from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp, FadeInRight } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter, useFocusEffect } from "expo-router";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../theme/ThemeContext";
import { apiClient } from "../../../src/utils/apiClient";

const { width } = Dimensions.get("window");

type LatestBill = {
  id: number;
  description?: string | null;
  amount: number;
  paid_by_name?: string | null;
  category_name?: string | null;
  timestamp?: string | null;
};

function formatBillTime(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function Dashboard() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [currency, setCurrency] = useState("$");
  const [latestBill, setLatestBill] = useState<LatestBill | null>(null);

  const fetchDashboard = useCallback(async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) {
        router.replace("/login");
        return;
      }

      const data: any = await apiClient("/dashboard", "GET", undefined, token);

      setCurrency(data.currency || "$");
      setTotalSpent(data.total_spent || 0);
      setExpenses(data.category_expenses || []);
      setLatestBill(data.latest_bill ?? null);
    } catch (err: any) {
      console.error("Dashboard API error:", err.message);
      Toast.show({ type: "error", text1: "Sync Error", text2: err.message });
    } finally {
      setLoading(false);
    }
  }, [router]);

  useFocusEffect(
    useCallback(() => {
      fetchDashboard();
    }, [fetchDashboard]),
  );

  const handleAction = (route: string) => {
    router.push(route as any);
  };

  if (loading)
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
        ]}
      >
        <ActivityIndicator size="large" color="#FF6A6A" />
      </View>
    );

  const stylesDynamic = createStyles(isDark);
  const categoryRows = expenses.filter((e) => Number(e.total) > 0.005);
  const maxExpense = Math.max(...categoryRows.map((e) => e.total), 0);

  return (
    <SafeAreaView style={stylesDynamic.container}>
      <StatusBar barStyle={isDark ? "light-content" : "dark-content"} />
      <ScrollView
        contentContainerStyle={{ paddingBottom: 120 }}
        showsVerticalScrollIndicator={false}
      >
        <Animated.View entering={FadeInUp.duration(600).springify()}>
          <LinearGradient
            colors={["#FF6B6B", "#FF8E8E"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={stylesDynamic.homeCard}
          >
            <View style={stylesDynamic.cardHeader}>
              <Text style={stylesDynamic.homeTitle}>My Home</Text>
              <View style={stylesDynamic.modeBadge}>
                <View style={stylesDynamic.onlineDot} />
                <Text style={stylesDynamic.modeText}>House Active</Text>
              </View>
            </View>
            <Text style={stylesDynamic.homeBalance}>
              {currency}
              {totalSpent.toLocaleString(undefined, {
                minimumFractionDigits: 2,
              })}
            </Text>
            <Text style={stylesDynamic.homeSubtitle}>
              Total monthly expenses
            </Text>
          </LinearGradient>
        </Animated.View>

        {/* Latest expense */}
        <View style={stylesDynamic.sectionTight}>
          <Text style={stylesDynamic.sectionTitle}>Latest expense</Text>
          {latestBill ? (
            <TouchableOpacity
              style={stylesDynamic.latestBillCard}
              onPress={() => handleAction("/expenses/addExpense")}
              activeOpacity={0.85}
            >
              <View style={stylesDynamic.latestBillIcon}>
                <MaterialCommunityIcons
                  name="receipt-text-outline"
                  size={22}
                  color="#FF6A6A"
                />
              </View>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text
                  style={stylesDynamic.latestBillTitle}
                  numberOfLines={1}
                >
                  {latestBill.description?.trim() || "Expense"}
                </Text>
                <Text style={stylesDynamic.latestBillMeta} numberOfLines={1}>
                  {[
                    latestBill.paid_by_name,
                    latestBill.category_name,
                    formatBillTime(latestBill.timestamp),
                  ]
                    .filter(Boolean)
                    .join(" · ")}
                </Text>
              </View>
              <Text style={stylesDynamic.latestBillAmount}>
                {currency}
                {Number(latestBill.amount).toFixed(2)}
              </Text>
              <MaterialIcons
                name="chevron-right"
                size={22}
                color={isDark ? "#64748B" : "#94A3B8"}
              />
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={stylesDynamic.latestBillEmpty}
              onPress={() => handleAction("/expenses/addExpense")}
              activeOpacity={0.85}
            >
              <MaterialCommunityIcons
                name="plus-circle-outline"
                size={22}
                color="#FF6A6A"
              />
              <Text style={stylesDynamic.latestBillEmptyText}>
                No bills yet — tap to add one
              </Text>
            </TouchableOpacity>
          )}
        </View>

        {/* Category breakdown — only categories with spend */}
        <View style={stylesDynamic.section}>
          <Text style={stylesDynamic.sectionTitle}>Expense breakdown</Text>
          {categoryRows.length === 0 ? (
            <Text style={stylesDynamic.emptyHint}>
              Category totals will appear once you add expenses this month.
            </Text>
          ) : (
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              contentContainerStyle={{ paddingLeft: 20, paddingRight: 10 }}
            >
              {categoryRows.map((expense, index) => (
                <Animated.View
                  key={expense.id || index}
                  entering={FadeInRight.delay(index * 80).duration(400)}
                  style={stylesDynamic.expenseCard}
                >
                  <View style={stylesDynamic.iconCircle}>
                    <FontAwesome5
                      name={expense.icon || "receipt"}
                      size={18}
                      color="#FF6A6A"
                    />
                  </View>
                  <Text style={stylesDynamic.expenseName} numberOfLines={1}>
                    {expense.name}
                  </Text>
                  <View style={stylesDynamic.progressBg}>
                    <View
                      style={[
                        stylesDynamic.progressFill,
                        {
                          width: `${(expense.total / (maxExpense || 1)) * 100}%`,
                        },
                      ]}
                    />
                  </View>
                  <Text style={stylesDynamic.expenseValue}>
                    {currency}
                    {expense.total.toFixed(2)}
                  </Text>
                </Animated.View>
              ))}
            </ScrollView>
          )}
        </View>

        {/* Compact quick actions */}
        <View style={stylesDynamic.section}>
          <Text style={stylesDynamic.sectionTitle}>Quick actions</Text>
          <View style={stylesDynamic.actionsRow}>
            <TouchableOpacity
              style={[styles.compactAction, { backgroundColor: "#FF6A6A" }]}
              onPress={() => handleAction("/expenses/addExpense")}
              activeOpacity={0.88}
            >
              <View style={styles.compactIconCircle}>
                <FontAwesome5 name="plus" size={15} color="#FF6A6A" />
              </View>
              <Text style={styles.compactLabel}>Add bill</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.compactAction, { backgroundColor: "#4E54C8" }]}
              onPress={() => handleAction("/house/addMate")}
              activeOpacity={0.88}
            >
              <View style={styles.compactIconCircle}>
                <MaterialIcons name="person-add" size={18} color="#4E54C8" />
              </View>
              <Text style={styles.compactLabel}>Add mate</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.compactAction, { backgroundColor: "#6366F1" }]}
              onPress={() => handleAction("/categories/manage")}
              activeOpacity={0.88}
            >
              <View style={styles.compactIconCircle}>
                <MaterialCommunityIcons
                  name="view-grid-plus"
                  size={17}
                  color="#6366F1"
                />
              </View>
              <Text style={styles.compactLabel}>Categories</Text>
            </TouchableOpacity>
          </View>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? "#0F172A" : "#F8FAFC" },
    homeCard: {
      marginHorizontal: 20,
      marginTop: 8,
      borderRadius: 24,
      padding: 22,
      elevation: 6,
      shadowColor: "#FF6B6B",
      shadowOffset: { width: 0, height: 8 },
      shadowOpacity: 0.22,
      shadowRadius: 12,
    },
    cardHeader: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    modeBadge: {
      flexDirection: "row",
      alignItems: "center",
      backgroundColor: "rgba(255,255,255,0.22)",
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 16,
    },
    onlineDot: {
      width: 7,
      height: 7,
      borderRadius: 4,
      backgroundColor: "#4ade80",
      marginRight: 5,
    },
    modeText: {
      color: "#fff",
      fontSize: 10,
      fontWeight: "800",
      textTransform: "uppercase",
      letterSpacing: 0.4,
    },
    homeTitle: { color: "#fff", fontSize: 16, fontWeight: "700", opacity: 0.92 },
    homeBalance: {
      color: "#fff",
      fontSize: 34,
      fontWeight: "900",
      letterSpacing: -0.5,
    },
    homeSubtitle: {
      color: "rgba(255,255,255,0.88)",
      fontWeight: "600",
      fontSize: 12,
      marginTop: 4,
    },

    section: { marginTop: 22 },
    sectionTight: { marginTop: 18 },
    sectionTitle: {
      fontSize: 17,
      fontWeight: "800",
      marginBottom: 12,
      color: isDark ? "#F1F5F9" : "#1E293B",
      paddingHorizontal: 20,
      letterSpacing: -0.3,
    },
    emptyHint: {
      paddingHorizontal: 24,
      fontSize: 13,
      color: isDark ? "#94A3B8" : "#64748B",
      fontWeight: "500",
      lineHeight: 19,
    },

    latestBillCard: {
      marginHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      paddingVertical: 12,
      paddingHorizontal: 14,
      borderRadius: 16,
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0",
      gap: 10,
    },
    latestBillIcon: {
      width: 40,
      height: 40,
      borderRadius: 12,
      backgroundColor: isDark ? "rgba(255,106,106,0.12)" : "#FFF1F1",
      justifyContent: "center",
      alignItems: "center",
    },
    latestBillTitle: {
      fontSize: 15,
      fontWeight: "800",
      color: isDark ? "#F1F5F9" : "#0F172A",
    },
    latestBillMeta: {
      fontSize: 12,
      marginTop: 3,
      color: isDark ? "#94A3B8" : "#64748B",
      fontWeight: "500",
    },
    latestBillAmount: {
      fontSize: 15,
      fontWeight: "900",
      color: "#FF6A6A",
    },
    latestBillEmpty: {
      marginHorizontal: 20,
      flexDirection: "row",
      alignItems: "center",
      gap: 10,
      paddingVertical: 14,
      paddingHorizontal: 14,
      borderRadius: 16,
      borderWidth: 1,
      borderStyle: "dashed",
      borderColor: isDark ? "#334155" : "#CBD5E1",
      backgroundColor: isDark ? "rgba(30,41,59,0.5)" : "#F8FAFC",
    },
    latestBillEmptyText: {
      flex: 1,
      fontSize: 13,
      fontWeight: "600",
      color: isDark ? "#94A3B8" : "#64748B",
    },

    expenseCard: {
      width: width * 0.46,
      backgroundColor: isDark ? "#1E293B" : "#fff",
      borderRadius: 20,
      padding: 16,
      marginRight: 12,
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.05)" : "#F1F5F9",
      elevation: 2,
    },
    iconCircle: {
      width: 40,
      height: 40,
      borderRadius: 14,
      backgroundColor: isDark ? "rgba(255,106,106,0.15)" : "#FFF1F1",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 12,
    },
    expenseName: {
      fontSize: 15,
      fontWeight: "800",
      color: isDark ? "#fff" : "#334155",
    },
    progressBg: {
      width: "100%",
      height: 5,
      backgroundColor: isDark ? "#334155" : "#F1F5F9",
      borderRadius: 8,
      marginVertical: 10,
      overflow: "hidden",
    },
    progressFill: {
      height: "100%",
      backgroundColor: "#FF6A6A",
      borderRadius: 8,
    },
    expenseValue: {
      fontWeight: "900",
      color: "#FF6A6A",
      fontSize: 16,
      textAlign: "right",
    },

    actionsRow: {
      flexDirection: "row",
      paddingHorizontal: 20,
      gap: 10,
    },
  });

const styles = StyleSheet.create({
  compactAction: {
    flex: 1,
    minHeight: 78,
    maxHeight: 88,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    paddingVertical: 10,
    paddingHorizontal: 6,
    elevation: 3,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.12,
    shadowRadius: 6,
  },
  compactIconCircle: {
    width: 34,
    height: 34,
    borderRadius: 11,
    backgroundColor: "rgba(255,255,255,0.95)",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 6,
  },
  compactLabel: {
    color: "#fff",
    fontWeight: "800",
    fontSize: 11,
    letterSpacing: 0.2,
    textAlign: "center",
  },
  loading: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
});
