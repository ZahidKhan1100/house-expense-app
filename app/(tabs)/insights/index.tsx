import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useState } from "react";
import {
  ActivityIndicator,
  Dimensions,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { BarChart, LineChart, PieChart } from "react-native-chart-kit";
import { SafeAreaView } from "react-native-safe-area-context";
import { apiClient } from "../../../src/utils/apiClient";
import { useTheme } from "../../theme/ThemeContext";

const screenWidth = Dimensions.get("window").width;
const COLORS = ["#FF6A6A", "#6366F1", "#10B981", "#F59E0B", "#A29BFE"];

export default function InsightsScreen() {
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [totalExpenses, setTotalExpenses] = useState(0);
  const [monthlyData, setMonthlyData] = useState<{ [key: string]: number }>({});
  const [categoryData, setCategoryData] = useState<any[]>([]);
  const [individualData, setIndividualData] = useState<any[]>([]);
  const [currency, setCurrency] = useState("$");

  const themeColors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "rgba(30, 41, 59, 0.7)" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#1E293B",
    subText: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "rgba(255,255,255,0.1)" : "#E2E8F0",
  };

  useEffect(() => {
    fetchInsights();
  }, []);

  const fetchInsights = async () => {
    try {
      const data = await apiClient("/house/current/insights");
      setMonthlyData(
        data.monthlyTotals.reduce((acc: any, cur: any) => {
          acc[cur.month] = cur.total;
          return acc;
        }, {}),
      );
      const token = await AsyncStorage.getItem("token");

      const profile = await apiClient("/profile", "GET", undefined, token);
      if (profile.house) {
        setCurrency(profile.house.currency || "$");
      }

      setCategoryData(data.categoryTotals);
      setIndividualData(data.individualTotals);
      const total = data.monthlyTotals.reduce(
        (sum: number, m: any) => sum + m.total,
        0,
      );
      setTotalExpenses(total);
    } catch (err: any) {
      console.error("Insights fetch error:", err.message);
    } finally {
      setLoading(false);
    }
  };

  const months = [
    "Jan",
    "Feb",
    "Mar",
    "Apr",
    "May",
    "Jun",
    "Jul",
    "Aug",
    "Sep",
    "Oct",
    "Nov",
    "Dec",
  ];

  const commonChartConfig = {
    backgroundColor: "transparent",
    backgroundGradientFrom: themeColors.bg,
    backgroundGradientTo: themeColors.bg,
    decimalPlaces: 0,
    color: (opacity = 1) =>
      isDark
        ? `rgba(255, 106, 106, ${opacity})`
        : `rgba(255, 106, 106, ${opacity})`,
    labelColor: (opacity = 1) => themeColors.subText,
    style: { borderRadius: 16 },
    propsForDots: { r: "5", strokeWidth: "2", stroke: "#FF6A6A" },
    fillShadowGradient: "#FF6A6A",
    fillShadowGradientOpacity: 0.3,
  };

  if (loading) {
    return (
      <View style={[styles.loader, { backgroundColor: themeColors.bg }]}>
        <ActivityIndicator size="large" color="#FF6A6A" />
      </View>
    );
  }

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: themeColors.bg }]}
    >
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 40 }}
      >
        {/* Header */}
        <View style={styles.headerRow}>
          <View>
            <Text style={[styles.welcomeText, { color: themeColors.subText }]}>
              Analytics
            </Text>
            <Text style={[styles.header, { color: themeColors.text }]}>
              House Insights
            </Text>
          </View>
          <TouchableOpacity
            style={[
              styles.iconBtn,
              {
                backgroundColor: themeColors.card,
                borderColor: themeColors.border,
              },
            ]}
          >
            <MaterialCommunityIcons
              name="filter-variant"
              size={24}
              color="#FF6A6A"
            />
          </TouchableOpacity>
        </View>

        {/* Total Expenses Hero Card */}
        <LinearGradient
          colors={["#FF8E8E", "#FF6A6A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.heroCard}
        >
          <View>
            <Text style={styles.heroTitle}>Cumulative Spending</Text>
            <Text style={styles.heroValue}>
              {currency}
              {totalExpenses.toLocaleString()}
            </Text>
          </View>
          <View style={styles.heroIconBox}>
            <MaterialCommunityIcons name="trending-up" size={32} color="#fff" />
          </View>
        </LinearGradient>

        {/* Category Distribution (Pie) */}
        <Text style={[styles.sectionLabel, { color: themeColors.text }]}>
          Category Distribution
        </Text>
        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <PieChart
            data={categoryData.map((cat, i) => ({
              name: cat.name,
              population: cat.total,
              color: COLORS[i % COLORS.length],
              legendFontColor: themeColors.text,
              legendFontSize: 12,
            }))}
            width={screenWidth - 60}
            height={200}
            chartConfig={commonChartConfig}
            accessor="population"
            backgroundColor="transparent"
            paddingLeft="15"
            absolute
          />
        </View>

        {/* Spending Trend (Line) */}
        <Text style={[styles.sectionLabel, { color: themeColors.text }]}>
          Monthly Trends
        </Text>
        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <LineChart
            data={{
              labels: months,
              datasets: [{ data: months.map((m) => monthlyData[m] || 0) }],
            }}
            width={screenWidth - 40}
            height={220}
            chartConfig={commonChartConfig}
            bezier
            withInnerLines={false}
            withOuterLines={false}
            style={styles.lineChartStyle}
          />
        </View>

        {/* Roommate Contributions (Bar) */}
        <Text style={[styles.sectionLabel, { color: themeColors.text }]}>
          Member Contribution
        </Text>
        <View
          style={[
            styles.chartCard,
            {
              backgroundColor: themeColors.card,
              borderColor: themeColors.border,
            },
          ]}
        >
          <BarChart
            data={{
              labels: individualData.map((u) => u.name.split(" ")[0]),
              datasets: [{ data: individualData.map((u) => u.total || 0) }],
            }}
            width={screenWidth - 40}
            height={220}
            yAxisLabel={`${currency} `}
            yAxisSuffix=""
            chartConfig={{
              ...commonChartConfig,
              color: (opacity = 1) => `rgba(99, 102, 241, ${opacity})`, // Indigo for bars
            }}
            style={styles.lineChartStyle}
            fromZero
            showBarTops={false}
          />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loader: { flex: 1, justifyContent: "center", alignItems: "center" },
  headerRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingHorizontal: 20,
    marginBottom: 20,
  },
  welcomeText: {
    fontSize: 14,
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: 1,
  },
  header: { fontSize: 28, fontWeight: "900" },
  iconBtn: {
    width: 45,
    height: 45,
    borderRadius: 12,
    borderWidth: 1,
    justifyContent: "center",
    alignItems: "center",
  },

  heroCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 25,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 25,
    elevation: 10,
    shadowColor: "#FF6A6A",
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },
  heroTitle: {
    color: "rgba(255,255,255,0.8)",
    fontSize: 14,
    fontWeight: "700",
  },
  heroValue: { color: "#fff", fontSize: 32, fontWeight: "900", marginTop: 4 },
  heroIconBox: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  sectionLabel: {
    fontSize: 18,
    fontWeight: "800",
    marginHorizontal: 20,
    marginBottom: 15,
  },
  chartCard: {
    marginHorizontal: 20,
    borderRadius: 24,
    padding: 10,
    borderWidth: 1,
    marginBottom: 25,
    overflow: "hidden",
  },
  lineChartStyle: { marginVertical: 8, borderRadius: 16, paddingRight: 40 },
});
