import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  Dimensions,
  ScrollView,
  TouchableOpacity,
  Platform,
} from "react-native";
import { MaterialIcons, FontAwesome5 } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import Animated, { FadeInUp } from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { auth, db } from "../../../firebase";
import { doc, getDoc, getDocs, collection } from "firebase/firestore";

const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

interface CategoryExpense {
  id: string;
  name: string;
  icon: string;
  total: number;
}

export default function Dashboard() {
  const router = useRouter();
  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<CategoryExpense[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [currency, setCurrency] = useState("$"); // default

  useEffect(() => {
    const unsubscribe = auth.onAuthStateChanged(async (user) => {
      if (!user) {
        router.replace("/login");
        return;
      }

      try {
        const userSnap = await getDoc(doc(db, "users", user.uid));
        if (!userSnap.exists()) return;

        const data = userSnap.data();
        setIsAdmin(data.role === "admin");

        if (!data.houseId) {
          router.replace("/pending");
          return;
        }

        const houseId = data.houseId;

        // Fetch house data for currency
        const houseSnap = await getDoc(doc(db, "houses", houseId));
        if (houseSnap.exists()) {
          const houseData = houseSnap.data();
          setCurrency(houseData.currency || "$");
        }

        // Fetch all expenses
        const expenseSnap = await getDocs(
          collection(db, "houses", houseId, "expenses"),
        );
        const allExpenses = expenseSnap.docs.map((d) => ({
          id: d.id,
          ...d.data(),
        }));

        // Fetch categories
        const catSnap = await getDocs(
          collection(db, "houses", houseId, "categories"),
        );
        const categories = catSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Aggregate expenses by category
        const categoryTotals: { [key: string]: CategoryExpense } = {};
        let totalSum = 0;

        allExpenses.forEach((exp) => {
          const cat = categories.find((c) => c.id === exp.categoryId);
          if (!cat) return;

          totalSum += exp.amount;

          if (!categoryTotals[cat.id]) {
            categoryTotals[cat.id] = {
              id: cat.id,
              name: cat.name,
              icon: cat.icon || "tag",
              total: 0,
            };
          }

          categoryTotals[cat.id].total += exp.amount;
        });

        setExpenses(Object.values(categoryTotals));
        setTotalSpent(totalSum);
      } catch (err) {
        console.error("Dashboard fetch error:", err);
      } finally {
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, []);

  if (loading)
    return (
      <View style={styles.loading}>
        <Text>Loading...</Text>
      </View>
    );

  const actions = [
    {
      label: "Add Expense",
      icon: <FontAwesome5 name="plus-circle" size={30} color="#fff" />,
      bgColor: "#FF6A6A",
      onPress: () => router.push("/expenses/addExpense"),
    },
    {
      label: "Add Payment",
      icon: <MaterialIcons name="payment" size={30} color="#fff" />,
      bgColor: "#6A8DFF",
      onPress: () => console.log("Add Payment clicked"),
    },
  ];

  if (isAdmin) {
    actions.push(
      {
        label: "Add Mate",
        icon: <MaterialIcons name="person-add" size={30} color="#fff" />,
        bgColor: "#FF1493",
        onPress: () => router.push("/house/addMate"),
      },
      {
        label: "Categories",
        icon: <MaterialIcons name="category" size={30} color="#fff" />,
        bgColor: "#6A8DFF",
        onPress: () => router.push("/categories/manage"),
      },
    );
  }

  const buttonsPerRow = isWeb ? 4 : 2;
  const rows = [];
  for (let i = 0; i < actions.length; i += buttonsPerRow) {
    rows.push(actions.slice(i, i + buttonsPerRow));
  }

  return (
    <SafeAreaView style={styles.container}>
      <ScrollView
        style={styles.container}
        contentContainerStyle={{
          paddingBottom: Platform.OS === "ios" ? 120 : 110,
        }}
      >
        {/* Home Summary */}
        <LinearGradient
          colors={["#FF6A6A", "#FFB88C"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.homeCard}
        >
          <Text style={styles.homeTitle}>My Home</Text>
          <Text style={styles.homeBalance}>
            {currency}
            {totalSpent.toFixed(2)}
          </Text>
          <Text style={styles.homeSubtitle}>Total Spent</Text>
        </LinearGradient>

        {/* Expenses by Category */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Expenses by Category</Text>
          {expenses.length === 0 && (
            <Text style={{ color: "#666" }}>No expenses yet</Text>
          )}
          {expenses.map((expense, index) => (
            <Animated.View
              key={expense.id}
              entering={FadeInUp.delay(50 * index)}
            >
              <LinearGradient
                colors={["#FFF5F5", "#FFEAEA"]}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.expenseCard}
              >
                <View style={styles.iconCircle}>
                  <FontAwesome5
                    name={expense.icon as any}
                    size={22}
                    color="#FF6A6A"
                  />
                </View>
                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={styles.expenseTitle}>{expense.name}</Text>
                </View>
                <Text style={styles.expenseAmount}>
                  {currency}
                  {expense.total.toFixed(2)}
                </Text>
              </LinearGradient>
            </Animated.View>
          ))}
        </View>

        {/* Quick Actions */}
        <View style={styles.section}>
          <Text style={styles.sectionTitle}>Quick Actions</Text>
          {rows.map((row, idx) => (
            <View key={idx} style={styles.actionsRow}>
              {row.map((action) => (
                <TouchableOpacity
                  key={action.label}
                  style={[
                    styles.actionButton,
                    { backgroundColor: action.bgColor },
                  ]}
                  onPress={action.onPress}
                >
                  {action.icon}
                  <Text style={styles.actionLabel}>{action.label}</Text>
                </TouchableOpacity>
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F5F5F5" },
  loading: { flex: 1, justifyContent: "center", alignItems: "center" },
  homeCard: {
    margin: 20,
    borderRadius: 20,
    padding: 25,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowOffset: { width: 0, height: 5 },
    shadowRadius: 10,
    elevation: 5,
  },
  homeTitle: { color: "#fff", fontSize: 22, fontWeight: "600" },
  homeBalance: {
    color: "#fff",
    fontSize: 36,
    fontWeight: "700",
    marginVertical: 5,
  },
  homeSubtitle: { color: "#fff", fontSize: 14 },
  section: { paddingHorizontal: 20, marginTop: 20 },
  sectionTitle: {
    fontSize: 20,
    fontWeight: "700",
    marginBottom: 15,
    color: "#222",
  },
  expenseCard: {
    flexDirection: "row",
    alignItems: "center",
    padding: 15,
    borderRadius: 20,
    marginBottom: 12,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 2,
  },
  iconCircle: {
    width: 45,
    height: 45,
    borderRadius: 25,
    backgroundColor: "#FFEAEA",
    justifyContent: "center",
    alignItems: "center",
  },
  expenseTitle: { fontSize: 16, fontWeight: "600", color: "#333" },
  expenseAmount: { fontSize: 16, fontWeight: "700", color: "#FF6A6A" },
  actionsRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginBottom: 10,
  },
  actionButton: {
    flex: 1,
    height: 90,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    marginHorizontal: 5,
  },
  actionLabel: {
    color: "#fff",
    marginTop: 5,
    fontWeight: "600",
    textAlign: "center",
  },
});
