import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useTheme } from "../../theme/ThemeContext";
import { apiClient } from "../../../src/utils/apiClient";

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
};

export default function Payment() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [mates, setMates] = useState<any[]>([]);
  const [transactions, setTransactions] = useState<any[]>([]);
  const [currency, setCurrency] = useState("$");
  const [currentMonth, setCurrentMonth] = useState(getCurrentMonth());
  const [availableMonths, setAvailableMonths] = useState<string[]>([]);
  const [token, setToken] = useState<string>(""); // Load your auth token

  const fetchPayments = async () => {
    setLoading(true);
    try {
      const data = await apiClient(
        `/payments/${currentMonth}`,
        "GET",
        undefined,
        token,
      );

      // Merge mates with their paid amounts
      const matesWithPaid = (data.mates || []).map((m: any) => ({
        ...m,
        total_paid: data.paid_amounts?.[m.id] || 0,
      }));

      setMates(matesWithPaid);
      setTransactions(data.transactions || []);
      setCurrency(data.currency || "$");
      setAvailableMonths(data.available_months || []);
    } catch (err: any) {
      console.error("Payment fetch error:", err);
      Alert.alert("Error", err.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPayments();
  }, [currentMonth, token]);

  if (loading)
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FF6A6A" />
      </View>
    );

  return (
    <SafeAreaView
      style={[
        styles.safeArea,
        { backgroundColor: isDark ? "#111827" : "#fff" },
      ]}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={[styles.title, { color: isDark ? "#F3F4F6" : "#FF6A6A" }]}>
          Payments
        </Text>

        {/* Month Selector */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={{
            alignItems: "center",
            paddingHorizontal: 10,
          }}
          style={{ marginBottom: 20, height: 40 }}
        >
          {availableMonths.map((m) => (
            <TouchableOpacity
              key={m}
              style={[
                styles.monthBtn,
                {
                  backgroundColor:
                    m === currentMonth
                      ? "#FF6A6A"
                      : isDark
                        ? "#1F2937"
                        : "#EEE",
                },
              ]}
              onPress={() => setCurrentMonth(m)}
            >
              <Text
                style={{
                  color:
                    m === currentMonth ? "#fff" : isDark ? "#F3F4F6" : "#333",
                  fontSize: 14,
                  fontWeight: "600",
                }}
              >
                {m}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Paid Amounts */}
        <Text
          style={[
            styles.sectionTitle,
            { color: isDark ? "#F3F4F6" : "#FF6A6A" },
          ]}
        >
          Paid Amounts
        </Text>
        {mates.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: isDark ? "#1F2937" : "#FFF5F5" },
            ]}
          >
            <Text
              style={[styles.emptyText, { color: isDark ? "#888" : "#666" }]}
            >
              No payments made yet
            </Text>
          </View>
        ) : (
          mates.map((m) => (
            <LinearGradient
              key={m.id}
              colors={isDark ? ["#374151", "#4B5563"] : ["#FFB88C", "#FF6A6A"]}
              style={styles.paidCard}
            >
              <View style={styles.avatar}>
                <Text style={styles.avatarText}>{m.name.charAt(0)}</Text>
              </View>
              <Text style={styles.paidText}>
                {m.name} paid {currency} {m.total_paid.toFixed(2)}
              </Text>
            </LinearGradient>
          ))
        )}

        {/* Settlements */}
        <Text
          style={[
            styles.sectionTitle,
            { color: isDark ? "#F3F4F6" : "#FF6A6A" },
          ]}
        >
          Settlements
        </Text>
        {transactions.length === 0 ? (
          <View
            style={[
              styles.emptyCard,
              { backgroundColor: isDark ? "#1F2937" : "#FFF5F5" },
            ]}
          >
            <Text
              style={[styles.emptyText, { color: isDark ? "#888" : "#666" }]}
            >
              No settlements needed!
            </Text>
          </View>
        ) : (
          transactions.map((tx, idx) => {
            const fromMate =
              mates.find((m) => m.id === tx.from)?.name || "Unknown";
            const toMate = mates.find((m) => m.id === tx.to)?.name || "Unknown";
            return (
              <LinearGradient
                key={idx}
                colors={
                  isDark ? ["#374151", "#4B5563"] : ["#FFB88C", "#FF6A6A"]
                }
                style={styles.txCard}
              >
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>{fromMate.charAt(0)}</Text>
                </View>
                <Text style={styles.txText}>
                  {fromMate} pays {toMate} {currency} {tx.amount.toFixed(2)}
                </Text>
              </LinearGradient>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safeArea: { flex: 1 },
  container: { padding: 20, paddingBottom: 50, flexGrow: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    marginBottom: 20,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    marginTop: 20,
    marginBottom: 10,
  },
  monthBtn: {
    paddingVertical: 6,
    paddingHorizontal: 14,
    borderRadius: 20,
    marginRight: 8,
  },
  paidCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },
  avatarText: { color: "#FF6A6A", fontWeight: "bold", fontSize: 16 },
  paidText: { fontSize: 16, fontWeight: "600", color: "#fff", flexShrink: 1 },
  txText: { fontSize: 16, fontWeight: "600", color: "#fff", flexShrink: 1 },
  emptyCard: {
    padding: 20,
    borderRadius: 16,
    alignItems: "center",
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#FF6A6A33",
  },
  emptyText: { fontSize: 16, fontWeight: "500", textAlign: "center" },
});
