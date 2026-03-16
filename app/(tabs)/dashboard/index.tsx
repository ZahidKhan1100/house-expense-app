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
import Animated, {
  FadeInUp,
  useSharedValue,
  useAnimatedStyle,
  withSpring,
} from "react-native-reanimated";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import Toast from "react-native-toast-message";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { useTheme } from "../../theme/ThemeContext";
import { apiClient } from "../../../src/utils/apiClient";

const { width } = Dimensions.get("window");
const isWeb = Platform.OS === "web";

interface CategoryExpense {
  id: number;
  name: string;
  icon: string;
  total: number;
}

interface DashboardResponse {
  user: {
    id: number;
    name: string;
    email: string;
    house_id: number;
    role: string;
    status: string;
  };
  currency: string;
  total_spent: number;
  category_expenses: CategoryExpense[];
}

export default function Dashboard() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [isAdmin, setIsAdmin] = useState(false);
  const [loading, setLoading] = useState(true);
  const [expenses, setExpenses] = useState<CategoryExpense[]>([]);
  const [totalSpent, setTotalSpent] = useState(0);
  const [currency, setCurrency] = useState("$");

  useEffect(() => {
    const fetchDashboard = async () => {
      try {
        const token = await AsyncStorage.getItem("token");
        if (!token) {
          router.replace("/login");
          return;
        }

        const data: DashboardResponse = await apiClient(
          "/dashboard",
          "GET",
          undefined,
          token,
        );

        setIsAdmin(data.user.role === "admin");
        setCurrency(data.currency || "$");
        setTotalSpent(data.total_spent || 0);
        setExpenses(data.category_expenses || []);
      } catch (err: any) {
        console.error("Dashboard API error:", err.message);
        Toast.show({
          type: "error",
          text1: "Failed to fetch dashboard",
          text2: err.message,
        });
      } finally {
        setLoading(false);
      }
    };

    fetchDashboard();
  }, []);

  const handleAction = (route: string, label: string) => {
    Toast.show({
      type: "success",
      text1: label,
    });

    router.push(route as any);
  };

  if (loading)
    return (
      <View
        style={[
          styles.loading,
          { backgroundColor: isDark ? "#121212" : "#F5F5F5" },
        ]}
      >
        <Text style={{ color: isDark ? "#fff" : "#000" }}>Loading...</Text>
      </View>
    );

  const actions = [
    {
      label: "Add Expense",
      icon: <FontAwesome5 name="plus-circle" size={28} color="#fff" />,
      bgColor: "#FF6A6A",
      route: "/expenses/addExpense",
    },
    {
      label: "Add Payment",
      icon: <MaterialIcons name="payment" size={28} color="#fff" />,
      bgColor: "#6A8DFF",
      route: "/payments",
    },
  ];

  if (isAdmin) {
    actions.push(
      {
        label: "Manage Mate",
        icon: <MaterialIcons name="person-add" size={28} color="#fff" />,
        bgColor: "#FF1493",
        route: "/house/addMate",
      },
      {
        label: "Categories",
        icon: <MaterialIcons name="category" size={28} color="#fff" />,
        bgColor: "#6A8DFF",
        route: "/categories/manage",
      },
    );
  }

  const buttonsPerRow = isWeb ? 4 : 2;
  const rows = [];
  for (let i = 0; i < actions.length; i += buttonsPerRow) {
    rows.push(actions.slice(i, i + buttonsPerRow));
  }

  const stylesDynamic = createStyles(isDark);

  return (
    <SafeAreaView style={stylesDynamic.container}>
      <ScrollView contentContainerStyle={{ paddingBottom: 120 }}>
        {/* SUMMARY CARD */}
        <Animated.View entering={FadeInUp.duration(500)}>
          <LinearGradient
            colors={["#FF6A6A", "#FFB88C"]}
            style={stylesDynamic.homeCard}
          >
            <Text style={stylesDynamic.homeTitle}>My Home</Text>
            <Text style={stylesDynamic.homeBalance}>
              {currency}
              {totalSpent.toFixed(2)}
            </Text>
            <Text style={stylesDynamic.homeSubtitle}>Total Spent</Text>
          </LinearGradient>
        </Animated.View>

        {/* CATEGORY EXPENSES */}
        <View style={stylesDynamic.section}>
          <Text style={stylesDynamic.sectionTitle}>Expenses by Category</Text>

          {expenses.map((expense, index) => (
            <Animated.View
              key={expense.id}
              entering={FadeInUp.delay(index * 80)}
            >
              <View style={stylesDynamic.expenseCard}>
                <View style={stylesDynamic.iconCircle}>
                  <FontAwesome5
                    name={expense.icon as any}
                    size={20}
                    color="#FF6A6A"
                  />
                </View>

                <View style={{ flex: 1, marginLeft: 15 }}>
                  <Text style={stylesDynamic.expenseTitle}>{expense.name}</Text>
                </View>

                <Text style={stylesDynamic.expenseAmount}>
                  {currency}
                  {expense.total.toFixed(2)}
                </Text>
              </View>
            </Animated.View>
          ))}
        </View>

        {/* QUICK ACTIONS */}
        <View style={stylesDynamic.section}>
          <Text style={stylesDynamic.sectionTitle}>Quick Actions</Text>

          {rows.map((row, idx) => (
            <View key={idx} style={stylesDynamic.actionsRow}>
              {row.map((action) => (
                <ActionButton
                  key={action.label}
                  action={action}
                  onPress={() => handleAction(action.route, action.label)}
                />
              ))}
            </View>
          ))}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

/* Animated Button */
function ActionButton({ action, onPress }: any) {
  const scale = useSharedValue(1);
  const animatedStyle = useAnimatedStyle(() => ({
    transform: [{ scale: scale.value }],
  }));

  const handlePress = () => {
    scale.value = withSpring(0.9);
    setTimeout(() => (scale.value = withSpring(1)), 120);
    onPress();
  };

  return (
    <Animated.View style={[{ flex: 1, marginHorizontal: 5 }, animatedStyle]}>
      <TouchableOpacity
        style={[styles.actionButton, { backgroundColor: action.bgColor }]}
        onPress={handlePress}
      >
        {action.icon}
        <Text style={styles.actionLabel}>{action.label}</Text>
      </TouchableOpacity>
    </Animated.View>
  );
}

/* Styles */
const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#121212" : "#F5F5F5",
    },
    loading: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
    },
    homeCard: {
      margin: 20,
      borderRadius: 20,
      padding: 25,
    },
    homeTitle: {
      color: "#fff",
      fontSize: 22,
      fontWeight: "600",
    },
    homeBalance: {
      color: "#fff",
      fontSize: 36,
      fontWeight: "700",
      marginVertical: 5,
    },
    homeSubtitle: {
      color: "#fff",
    },
    section: {
      paddingHorizontal: 20,
      marginTop: 10,
    },
    sectionTitle: {
      fontSize: 20,
      fontWeight: "700",
      marginBottom: 15,
      color: isDark ? "#fff" : "#222",
    },
    expenseCard: {
      flexDirection: "row",
      alignItems: "center",
      padding: 15,
      borderRadius: 16,
      marginBottom: 12,
      backgroundColor: isDark ? "#1E1E1E" : "#fff",
    },
    iconCircle: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: "#FFEAEA",
      justifyContent: "center",
      alignItems: "center",
    },
    expenseTitle: {
      fontSize: 16,
      fontWeight: "600",
      color: isDark ? "#fff" : "#333",
    },
    expenseAmount: {
      fontWeight: "700",
      color: "#FF6A6A",
    },
    actionsRow: {
      flexDirection: "row",
      justifyContent: "space-between",
      marginBottom: 10,
    },
  });

const styles = StyleSheet.create({
  actionButton: {
    height: 90,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
  },
  actionLabel: {
    color: "#fff",
    marginTop: 5,
    fontWeight: "600",
    textAlign: "center",
  },
});
