import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { auth, db } from "../../../firebase";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Payment() {
  const [loading, setLoading] = useState(true);
  const [transactions, setTransactions] = useState<
    { from: string; to: string; amount: number }[]
  >([]);
  const [mates, setMates] = useState<any[]>([]);
  const [paidAmounts, setPaidAmounts] = useState<{ [id: string]: number }>({});
  const [currency, setCurrency] = useState<string>("$"); // default

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        // Get current user info
        const userSnap = await getDoc(doc(db, "users", user.uid));
        const houseId = userSnap.data()?.houseId;
        if (!houseId) return;

        // Get house info
        const houseSnap = await getDoc(doc(db, "houses", houseId));
        const mateIds: string[] = houseSnap.data()?.mates || [];
        const houseCurrency: string = houseSnap.data()?.currency || "$";
        setCurrency(houseCurrency);

        const mateList: any[] = [];
        for (const mateId of mateIds) {
          const mateSnap = await getDoc(doc(db, "users", mateId));
          if (mateSnap.exists())
            mateList.push({ id: mateId, ...mateSnap.data() });
        }
        setMates(mateList);

        // Get expenses
        const expenseSnap = await getDocs(
          collection(db, "houses", houseId, "expenses"),
        );
        const expenses = expenseSnap.docs.map((d) => d.data());

        // 1️⃣ Calculate who paid how much
        const paidMap: { [id: string]: number } = {};
        mateList.forEach((m) => (paidMap[m.id] = 0));
        expenses.forEach((exp) => {
          paidMap[exp.paidBy] += exp.amount;
        });
        setPaidAmounts(paidMap);

        // 2️⃣ Calculate net balance for settlement
        const balance: { [id: string]: number } = {};
        mateList.forEach((m) => (balance[m.id] = 0));

        expenses.forEach((exp) => {
          const split = exp.amount / exp.includedMates.length;
          exp.includedMates.forEach((mateId: string) => {
            if (mateId === exp.paidBy) {
              balance[mateId] += exp.amount - split;
            } else {
              balance[mateId] -= split;
            }
          });
        });

        const creditors = Object.entries(balance)
          .filter(([_, amt]) => amt > 0)
          .map(([id, amt]) => ({ id, amount: amt }));

        const debtors = Object.entries(balance)
          .filter(([_, amt]) => amt < 0)
          .map(([id, amt]) => ({ id, amount: -amt }));

        const txs: { from: string; to: string; amount: number }[] = [];
        let i = 0,
          j = 0;
        while (i < debtors.length && j < creditors.length) {
          const debtor = debtors[i];
          const creditor = creditors[j];
          const minAmount = Math.min(debtor.amount, creditor.amount);

          txs.push({
            from: debtor.id,
            to: creditor.id,
            amount: parseFloat(minAmount.toFixed(2)),
          });

          debtor.amount -= minAmount;
          creditor.amount -= minAmount;

          if (debtor.amount === 0) i++;
          if (creditor.amount === 0) j++;
        }

        setTransactions(txs);
      } catch (err) {
        console.error("Payment fetch error:", err);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  if (loading)
    return (
      <View style={styles.loader}>
        <ActivityIndicator size="large" color="#FF6A6A" />
      </View>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Payments</Text>

        {/* 1️⃣ Paid Amount Section */}
        <Text style={styles.sectionTitle}>Paid Amounts</Text>
        {mates.map((m) => (
          <View key={m.id} style={styles.paidCard}>
            <View style={styles.avatar}>
              <Text style={styles.avatarText}>
                {m.name.charAt(0).toUpperCase()}
              </Text>
            </View>
            <Text
              style={styles.paidText}
              numberOfLines={2}
              ellipsizeMode="tail"
            >
              {m.name} paid {currency} {paidAmounts[m.id]?.toFixed(2) || "0.00"}
            </Text>
          </View>
        ))}

        {/* 2️⃣ Who owes whom */}
        <Text style={styles.sectionTitle}>Settlements</Text>
        {transactions.length === 0 ? (
          <Text style={styles.noTx}>No payments needed!</Text>
        ) : (
          transactions.map((tx, idx) => {
            const fromMate =
              mates.find((m) => m.id === tx.from)?.name || "Unknown";
            const toMate = mates.find((m) => m.id === tx.to)?.name || "Unknown";

            return (
              <View key={idx} style={styles.txCard}>
                <View style={styles.avatar}>
                  <Text style={styles.avatarText}>
                    {fromMate.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <Text
                  style={styles.txText}
                  numberOfLines={3}
                  ellipsizeMode="tail"
                >
                  {fromMate} pays {toMate} {currency} {tx.amount.toFixed(2)}
                </Text>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 20,
    paddingBottom: 50,
    backgroundColor: "#fff",
    flexGrow: 1,
  },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#FF6A6A",
    marginBottom: 20,
    textAlign: "center",
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "bold",
    color: "#FF6A6A",
    marginTop: 20,
    marginBottom: 10,
  },
  paidCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    padding: 12,
    borderRadius: 12,
    marginBottom: 10,
    borderLeftWidth: 5,
    borderLeftColor: "#FF6A6A",
    flexWrap: "wrap",
    width: "100%",
  },
  txCard: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FFF5F5",
    padding: 12,
    borderRadius: 12,
    marginBottom: 12,
    borderLeftWidth: 5,
    borderLeftColor: "#FF6A6A",
    flexWrap: "wrap",
    width: "100%",
  },
  avatar: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: "#FFB88C",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
    flexShrink: 0,
  },
  avatarText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
  paidText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    flexShrink: 1,
  },
  txText: {
    fontSize: 16,
    fontWeight: "500",
    color: "#333",
    flexShrink: 1,
  },
  noTx: { fontSize: 16, color: "#888", marginTop: 10, textAlign: "center" },
});
