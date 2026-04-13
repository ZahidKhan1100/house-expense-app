import React, { useMemo } from "react";
import { View, Text, StyleSheet, Platform } from "react-native";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { Ionicons } from "@expo/vector-icons";

export default function SettleUp({ trip, people }: any) {
  const transactions = useMemo(() => {
    const balances: { [key: number]: number } = {};
    people.forEach((p: any) => (balances[p.id] = 0));

    trip.expenses.forEach((exp: any) => {
      const share = exp.amount / (exp.splitBetween?.length || 1);
      balances[exp.paidBy] += exp.amount;
      exp.splitBetween?.forEach((pid: number) => {
        balances[pid] -= share;
      });
    });

    let debtors = people
      .map((p: any) => ({ ...p, balance: balances[p.id] }))
      .filter((p: any) => p.balance < -0.01)
      .sort((a: any, b: any) => a.balance - b.balance);

    let creditors = people
      .map((p: any) => ({ ...p, balance: balances[p.id] }))
      .filter((p: any) => p.balance > 0.01)
      .sort((a: any, b: any) => b.balance - a.balance);

    const steps = [];
    while (debtors.length > 0 && creditors.length > 0) {
      const debtor = debtors[0];
      const creditor = creditors[0];
      const amount = Math.min(Math.abs(debtor.balance), creditor.balance);

      steps.push({
        from: debtor.name,
        to: creditor.name,
        amount: amount.toFixed(2),
      });

      debtor.balance += amount;
      creditor.balance -= amount;

      if (Math.abs(debtor.balance) < 0.01) debtors.shift();
      if (Math.abs(creditor.balance) < 0.01) creditors.shift();
    }
    return steps;
  }, [trip, people]);

  if (transactions.length === 0) return null;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionTitle}>💰 Settlement Plan</Text>
      {transactions.map((t, i) => (
        <View key={i} style={styles.cardWrapper}>
          <BlurView
            intensity={Platform.OS === "web" ? 0 : 60}
            tint="light"
            style={styles.card}
          >
            <View style={styles.side}>
              <Text style={styles.name}>{t.from}</Text>
              <Text style={styles.sub}>Pays</Text>
            </View>

            <View style={styles.center}>
              <LinearGradient
                colors={["#FF6B6B", "#4E54C8"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.badge}
              >
                <Text style={styles.amount}>${t.amount}</Text>
              </LinearGradient>
              <Ionicons name="arrow-forward" size={14} color="#CBD5E1" />
            </View>

            <View style={[styles.side, { alignItems: "flex-end" }]}>
              <Text style={styles.name}>{t.to}</Text>
              <Text style={[styles.sub, { color: "#10B981" }]}>Receives</Text>
            </View>
          </BlurView>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { marginTop: 30, width: "100%" },
  sectionTitle: {
    fontSize: 13,
    fontWeight: "800",
    color: "#94A3B8",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 15,
  },
  cardWrapper: {
    marginBottom: 12,
    borderRadius: 20,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.5)",
    backgroundColor: "#fff",
  },
  card: { flexDirection: "row", alignItems: "center", padding: 16 },
  side: { flex: 1 },
  name: { fontSize: 15, fontWeight: "800", color: "#1E293B" },
  sub: {
    fontSize: 10,
    fontWeight: "700",
    color: "#FF6B6B",
    textTransform: "uppercase",
    marginTop: 2,
  },
  center: { flex: 1.2, alignItems: "center", gap: 4 },
  badge: { paddingHorizontal: 12, paddingVertical: 4, borderRadius: 10 },
  amount: { color: "#fff", fontSize: 14, fontWeight: "900" },
});
