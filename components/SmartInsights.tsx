import React, { useMemo } from "react";
import { View, Text, StyleSheet, Dimensions, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

export default function SmartInsights({ trip }: any) {
  const { expenses, budget, spent, people } = trip;

  const insights = useMemo(() => {
    if (!expenses || expenses.length === 0) return null;

    // 1. Calculate Category breakdown
    const categoryMap: any = {};
    expenses.forEach((e: any) => {
      categoryMap[e.category] = (categoryMap[e.category] || 0) + e.amount;
    });

    // 2. Identify the "High Roller" (Who paid for the most expensive items)
    const payerMap: any = {};
    expenses.forEach((e: any) => {
      payerMap[e.paidBy] = (payerMap[e.paidBy] || 0) + e.amount;
    });
    const highRollerID = Object.keys(payerMap).reduce((a, b) =>
      payerMap[a] > payerMap[b] ? a : b,
    );
    const highRollerName =
      people.find((p: any) => p.id.toString() === highRollerID)?.name ||
      "Someone";

    // 3. Logic-based "AI" Narrative
    const percentSpent = (spent / budget) * 100;
    let status = {
      label: "On Track",
      color: "#10B981",
      message: "Your spending velocity looks healthy for this habitat.",
      icon: "checkmark-circle",
    };

    if (percentSpent > 90) {
      status = {
        label: "Critical",
        color: "#EF4444",
        message: "Budget exhaustion imminent. Tighten the belt!",
        icon: "alert-circle",
      };
    } else if (percentSpent > 70) {
      status = {
        label: "Warning",
        color: "#F59E0B",
        message:
          "You've tapped into 70% of resources. Chill on the 'Fun' category.",
        icon: "warning",
      };
    }

    // 4. Determine Top Category
    const topCat = Object.keys(categoryMap).reduce(
      (a, b) => (categoryMap[a] > categoryMap[b] ? a : b),
      "food",
    );

    return { status, highRollerName, topCat, categoryMap };
  }, [trip]);

  if (!insights) return null;

  return (
    <View style={styles.container}>
      <BlurView
        intensity={isWeb ? 0 : 80}
        tint="light"
        style={styles.glassCard}
      >
        <View style={styles.header}>
          <View style={styles.aiBadge}>
            <MaterialCommunityIcons
              name="robot-love"
              size={14}
              color="#4E54C8"
            />
            <Text style={styles.aiBadgeText}>HABIMATE AI</Text>
          </View>
          <View
            style={[
              styles.statusPill,
              { backgroundColor: `${insights.status.color}15` },
            ]}
          >
            <Ionicons
              name={insights.status.icon as any}
              size={12}
              color={insights.status.color}
            />
            <Text style={[styles.statusText, { color: insights.status.color }]}>
              {insights.status.label}
            </Text>
          </View>
        </View>

        <Text style={styles.mainInsight}>{insights.status.message}</Text>

        <View style={styles.divider} />

        <View style={styles.statsRow}>
          <View style={styles.statBox}>
            <Text style={styles.statLabel}>Top Category</Text>
            <View style={styles.statValueRow}>
              <MaterialCommunityIcons name="fire" size={16} color="#FF6B6B" />
              <Text style={styles.statValue}>
                {insights.topCat.toUpperCase()}
              </Text>
            </View>
          </View>

          <View
            style={[
              styles.statBox,
              { borderLeftWidth: 1, borderColor: "#F1F5F9" },
            ]}
          >
            <Text style={styles.statLabel}>High Roller</Text>
            <View style={styles.statValueRow}>
              <MaterialCommunityIcons name="crown" size={16} color="#F59E0B" />
              <Text style={styles.statValue}>{insights.highRollerName}</Text>
            </View>
          </View>
        </View>

        <LinearGradient
          colors={["#4E54C810", "transparent"]}
          style={styles.tipBox}
        >
          <Text style={styles.tipText}>
            💡 <Text style={{ fontWeight: "800" }}>Pro Tip:</Text>{" "}
            {insights.highRollerName} is currently carrying the load. Try
            splitting the next few bills!
          </Text>
        </LinearGradient>
      </BlurView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    marginTop: 25,
    marginBottom: 10,
    width: "100%",
  },
  glassCard: {
    borderRadius: 24,
    padding: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: isWeb ? "#fff" : "transparent",
    ...Platform.select({
      web: { boxShadow: "0px 10px 30px rgba(0,0,0,0.05)" },
      ios: { shadowColor: "#000", shadowOpacity: 0.05, shadowRadius: 10 },
      android: { elevation: 3 },
    }),
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 15,
  },
  aiBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#4E54C815",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    gap: 5,
  },
  aiBadgeText: {
    fontSize: 10,
    fontWeight: "900",
    color: "#4E54C8",
    letterSpacing: 1,
  },
  statusPill: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  statusText: {
    fontSize: 11,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  mainInsight: {
    fontSize: 16,
    fontWeight: "700",
    color: "#1E293B",
    lineHeight: 22,
    marginBottom: 15,
  },
  divider: {
    height: 1,
    backgroundColor: "#F1F5F9",
    width: "100%",
    marginBottom: 15,
  },
  statsRow: {
    flexDirection: "row",
    marginBottom: 15,
  },
  statBox: {
    flex: 1,
    paddingHorizontal: 5,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "700",
    color: "#94A3B8",
    textTransform: "uppercase",
    marginBottom: 4,
  },
  statValueRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
  },
  statValue: {
    fontSize: 14,
    fontWeight: "900",
    color: "#334155",
  },
  tipBox: {
    padding: 12,
    borderRadius: 14,
    marginTop: 5,
  },
  tipText: {
    fontSize: 13,
    color: "#475569",
    lineHeight: 18,
    fontWeight: "500",
  },
});
