import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState, useMemo } from "react";
import {
  ActivityIndicator,
  Alert,
  KeyboardAvoidingView,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  SectionList,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";

import { apiClient } from "../../src/utils/apiClient";
import { useKeyboardBottomPadding } from "../../src/hooks/useKeyboardBottomPadding";
import { useTheme } from "../theme/ThemeContext";

export default function Expenses() {
  const insets = useSafeAreaInsets();
  const modalKeyboardPad = useKeyboardBottomPadding(28);
  const router = useRouter();
  const { isDark } = useTheme();

  const CUSTOM_TAB_BAR_HEIGHT = 70 + insets.bottom;

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#0F172A",
    sub: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#334155" : "#E2E8F0",
    primary: "#FF6A6A",
    accent: "#FF6A6A",
  };

  const sectionListRef = useRef<SectionList>(null);

  // States
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [mates, setMates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currency, setCurrency] = useState("$");
  const [sections, setSections] = useState<any[]>([]);
  const [currentMonthKey, setCurrentMonthKey] = useState(
    new Date().toISOString().slice(0, 7),
  );
  const [currentUser, setCurrentUser] = useState<{
    id: any;
    role: string;
  } | null>(null);

  // Form States
  const [modalVisible, setModalVisible] = useState(false);
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedMates, setSelectedMates] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<any>(null);

  const formatMonth = (month: string) =>
    new Date(month + "-01").toLocaleString("default", {
      month: "short",
      year: "numeric",
    });

  const formatMonthLong = (ym: string) =>
    new Date(ym + "-02").toLocaleString("default", {
      month: "long",
      year: "numeric",
    });

  const fetchData = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;

      setRefreshing(true);
      const dashboard = await apiClient("/dashboard", "GET", undefined, token);
      setMates(dashboard.mates || []);
      setCurrency(dashboard.currency || "$");

      const cats = await apiClient("/categories", "GET", undefined, token);
      setCategories(cats);

      const expenses = await apiClient("/expenses", "GET", undefined, token);

      const grouped = (expenses || []).map((monthData: any) => ({
        title: formatMonth(monthData.month),
        monthKey: monthData.month,
        data: (monthData.records || []).map((record: any) => ({
          ...record,
          amount: parseFloat(record.amount),
          included_mates: (record.included_mates || []).map((mate: any) => ({
            id: mate.id,
            name: mate.name || "Unknown",
          })),
          paid_by: { id: record.paid_by, name: record.paid_by_name },
        })),
      }));

      setSections(grouped);
    } catch (e) {
      console.log("fetchData error:", e);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  const filteredSections = useMemo(() => {
    return sections.filter((s) => s.monthKey === currentMonthKey);
  }, [sections, currentMonthKey]);

  useEffect(() => {
    const fetchUser = async () => {
      const userStr = await AsyncStorage.getItem("user");
      if (userStr) setCurrentUser(JSON.parse(userStr));
    };
    fetchUser();
    fetchData();
  }, []);

  // Rules: Default Selection & Admin Restrictions
  const resetForm = () => {
    setTitle("");
    setAmount("");
    setSelectedCategory(null);
    setSelectedMates(mates.map((m) => m.id)); // Default: Select All
    setPaidBy(currentUser?.id || null); // Default: Current User Paid
    setEditExpense(null);
  };

  // Ensure payer is always in the split
  useEffect(() => {
    if (paidBy && !selectedMates.includes(paidBy)) {
      setSelectedMates((prev) => [...prev, paidBy]);
    }
  }, [paidBy]);

  const handleMonthStep = (step: number) => {
    const [year, monthNum] = currentMonthKey.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + step, 1);
    setCurrentMonthKey(
      `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`,
    );
  };

  const saveExpense = async () => {
    if (!title || !amount || !selectedCategory || !paidBy)
      return Alert.alert("Please fill all fields");
    try {
      const token = await AsyncStorage.getItem("token");
      const payload = {
        description: title,
        amount: parseFloat(amount),
        category_id: selectedCategory.id,
        included_mates: selectedMates,
        paid_by: paidBy,
        month: currentMonthKey,
      };
      if (editExpense) {
        await apiClient(`/records/${editExpense.id}`, "PUT", payload, token!);
      } else {
        await apiClient("/records", "POST", payload, token!);
      }
      resetForm();
      setModalVisible(false);
      fetchData();
    } catch (e) {
      Alert.alert("Error", "Something went wrong");
    }
  };

  // const toggleMate = (id: string) => {
  //   setSelectedMates((prev) => {
  //     return prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
  //   });
  // };

  const toggleMate = (id: string) => {
    setSelectedMates((prev) => {
      if (prev.includes(id) && id === paidBy) {
        Alert.alert(
          "Action Required",
          "The person who paid must stay in the split list.",
        );
        return prev;
      }
      return prev.includes(id) ? prev.filter((m) => m !== id) : [...prev, id];
    });
  };

  const handleDelete = (expense: any) => {
    Alert.alert("Delete Expense", "Are you sure you want to remove this?", [
      { text: "Cancel", style: "cancel" },
      {
        text: "Delete",
        style: "destructive",
        onPress: async () => {
          try {
            const token = await AsyncStorage.getItem("token");
            await apiClient(
              `/records/${expense.id}`,
              "DELETE",
              undefined,
              token!,
            );
            fetchData(); // Refresh list after deletion
          } catch (e) {
            Alert.alert("Error", "Failed to delete expense");
          }
        },
      },
    ]);
  };

  if (loading)
    return (
      <ActivityIndicator
        style={{ flex: 1 }}
        size="large"
        color={colors.primary}
      />
    );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: colors.bg }]}
      edges={["top", "left", "right"]}
    >
      {/* Header */}
      <View style={styles.newHeader}>
        <TouchableOpacity
          onPress={() => router.push("/(tabs)/dashboard")}
          style={styles.circularBackBtn}
        >
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <View style={styles.monthToggleRow}>
            <TouchableOpacity onPress={() => handleMonthStep(-1)} hitSlop={15}>
              <MaterialIcons
                name="chevron-left"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={[styles.screenTitle, { color: colors.text }]}>
                Expenses
              </Text>
              <Text style={[styles.monthSubtitle, { color: colors.sub }]}>
                {formatMonthLong(currentMonthKey)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleMonthStep(1)} hitSlop={15}>
              <MaterialIcons
                name="chevron-right"
                size={28}
                color={colors.primary}
              />
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity
          style={[
            styles.headerActionBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => {
            resetForm();
            setModalVisible(true);
          }}
        >
          <FontAwesome5 name="plus" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <SectionList
        ref={sectionListRef}
        sections={filteredSections}
        keyExtractor={(item) => item.id.toString()}
        stickySectionHeadersEnabled
        contentContainerStyle={[
          styles.listPadding,
          { paddingBottom: CUSTOM_TAB_BAR_HEIGHT + 20 },
        ]}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5
              name="calendar-times"
              size={40}
              color={colors.border}
            />
            <Text style={[styles.emptyText, { color: colors.sub }]}>
              No expenses this month.
            </Text>
          </View>
        }
        renderSectionHeader={({ section }) => (
          <View style={[styles.sectionHeader, { backgroundColor: colors.bg }]}>
            <Text style={[styles.sectionHeaderText, { color: colors.text }]}>
              {section.title}
            </Text>
          </View>
        )}
        renderItem={({ item }) => {
          const canEdit =
            currentUser?.role === "admin" ||
            currentUser?.id === item.paid_by?.id;
          return (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View style={styles.cardInfo}>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.cardTitle, { color: colors.text }]}>
                    {item.description}
                  </Text>
                  <View style={styles.metaRow}>
                    <View style={styles.paidByBadge}>
                      <Text style={styles.paidByText}>
                        Paid by {item.paid_by?.name}
                      </Text>
                    </View>
                    <Text style={[styles.cardSub, { color: colors.sub }]}>
                      {" "}
                      • {item.category?.name}
                    </Text>
                  </View>
                </View>
                <Text style={[styles.cardAmount, { color: colors.text }]}>
                  {currency}
                  {item.amount.toFixed(2)}
                </Text>
              </View>

              <View style={styles.splitRow}>
                <Text style={[styles.splitLabel, { color: colors.sub }]}>
                  Split with:
                </Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false}>
                  <View style={{ flexDirection: "row", gap: 8 }}>
                    {item.included_mates?.map((m: any) => (
                      <View
                        key={m.id}
                        style={[
                          styles.splitPill,
                          { backgroundColor: isDark ? "#334155" : "#F1F5F9" },
                        ]}
                      >
                        <Text
                          style={{
                            color: colors.text,
                            fontSize: 11,
                            fontWeight: "600",
                          }}
                        >
                          {m.name}
                        </Text>
                      </View>
                    ))}
                  </View>
                </ScrollView>
              </View>

              {canEdit && (
                <View style={styles.cardActions}>
                  <TouchableOpacity
                    onPress={() => {
                      setEditExpense(item);
                      setTitle(item.description);
                      setAmount(item.amount.toString());
                      setPaidBy(item.paid_by?.id);
                      setSelectedCategory(item.category);
                      setSelectedMates(
                        item.included_mates.map((m: any) => m.id),
                      );
                      setModalVisible(true);
                    }}
                  >
                    <Text
                      style={{
                        color: colors.accent,
                        fontWeight: "700",
                        marginRight: 20,
                      }}
                    >
                      Edit
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => handleDelete(item)}>
                    <Text style={{ color: "#EF4444", fontWeight: "700" }}>
                      Delete
                    </Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          );
        }}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={fetchData}
            tintColor={colors.primary}
          />
        }
      />

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
        >
          <View style={styles.modalOverlay}>
            <View
              style={[
                styles.modalContent,
                {
                  backgroundColor: colors.card,
                  paddingBottom: Math.max(insets.bottom, 20),
                },
              ]}
            >
              <LinearGradient
                colors={
                  isDark ? ["#FF6A6A", "#EF4444"] : ["#FF8E8E", "#FF6A6A"]
                }
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 1 }}
                style={styles.modalHero}
              >
                <View style={styles.modalHeroRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.modalHeroTitle}>
                      {editExpense ? "Edit Expense" : "New Expense"}
                    </Text>
                    <Text style={styles.modalHeroSub}>
                      {formatMonthLong(currentMonthKey)}
                    </Text>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      setModalVisible(false);
                      resetForm();
                    }}
                    style={styles.modalCloseBtn}
                    hitSlop={10}
                  >
                    <MaterialIcons name="close" size={20} color="#fff" />
                  </TouchableOpacity>
                </View>
              </LinearGradient>

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ paddingBottom: modalKeyboardPad }}
              >
                <View
                  style={[
                    styles.formCard,
                    { backgroundColor: colors.card, borderColor: colors.border },
                  ]}
                >
                  <Text style={[styles.label, { color: colors.text }]}>
                    Expense details
                  </Text>
                  <View style={styles.fieldRow}>
                    <View style={styles.fieldIcon}>
                      <MaterialIcons name="notes" size={18} color={colors.sub} />
                    </View>
                    <TextInput
                      placeholder="Description"
                      placeholderTextColor={colors.sub}
                      style={[
                        styles.input,
                        {
                          color: colors.text,
                          borderColor: colors.border,
                          flex: 1,
                          marginBottom: 0,
                        },
                      ]}
                      value={title}
                      onChangeText={setTitle}
                    />
                  </View>

                  <View style={[styles.fieldRow, { marginTop: 10 }]}>
                    <View style={styles.fieldIcon}>
                      <MaterialIcons
                        name="payments"
                        size={18}
                        color={colors.sub}
                      />
                    </View>
                    <View
                      style={[
                        styles.amountWrap,
                        { borderColor: colors.border },
                      ]}
                    >
                      <Text style={[styles.currencyPill, { color: colors.sub }]}>
                        {currency}
                      </Text>
                      <TextInput
                        placeholder="0.00"
                        placeholderTextColor={colors.sub}
                        keyboardType="numeric"
                        style={[styles.amountInput, { color: colors.text }]}
                        value={amount}
                        onChangeText={setAmount}
                      />
                    </View>
                  </View>
                </View>

                <Text style={[styles.label, { color: colors.text }]}>
                  Category
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectorScroll}
                >
                  {categories.map((cat) => (
                    <TouchableOpacity
                      key={cat.id}
                      onPress={() => setSelectedCategory(cat)}
                      style={[
                        styles.selectorPill,
                        {
                          borderColor:
                            selectedCategory?.id === cat.id
                              ? colors.primary
                              : colors.border,
                          backgroundColor:
                            selectedCategory?.id === cat.id
                              ? colors.primary + "10"
                              : "transparent",
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color:
                            selectedCategory?.id === cat.id
                              ? colors.primary
                              : colors.text,
                          fontWeight:
                            selectedCategory?.id === cat.id ? "800" : "600",
                        }}
                      >
                        {cat.name}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>

                <Text style={[styles.label, { color: colors.text }]}>
                  Who paid? {currentUser?.role !== "admin" && "(Admin only)"}
                </Text>
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  style={styles.selectorScroll}
                >
                  {mates.map((m) => {
                    const isDisabled =
                      currentUser?.role !== "admin" && m.id !== currentUser?.id;
                    return (
                      <TouchableOpacity
                        key={m.id}
                        disabled={isDisabled}
                        onPress={() => setPaidBy(m.id)}
                        style={[
                          styles.selectorPill,
                          {
                            borderColor:
                              paidBy === m.id ? colors.primary : colors.border,
                            backgroundColor:
                              paidBy === m.id
                                ? colors.primary + "10"
                                : "transparent",
                            opacity: isDisabled ? 0.4 : 1,
                          },
                        ]}
                      >
                        <Text
                          style={{
                            color:
                              paidBy === m.id ? colors.primary : colors.text,
                          }}
                        >
                          {m.name}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </ScrollView>

                <Text style={[styles.label, { color: colors.text }]}>
                  Split with who?
                </Text>
                <View style={{ flexDirection: "row", marginBottom: 12 }}>
                  <TouchableOpacity
                    onPress={() => setSelectedMates(mates.map((m) => m.id))}
                    style={[
                      styles.miniBtn,
                      { backgroundColor: colors.primary + "20" },
                    ]}
                  >
                    <Text
                      style={{
                        color: colors.primary,
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Select All
                    </Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    onPress={() => paidBy && setSelectedMates([paidBy])}
                    style={[styles.miniBtn, { backgroundColor: "#EF444415" }]}
                  >
                    <Text
                      style={{
                        color: "#EF4444",
                        fontSize: 12,
                        fontWeight: "700",
                      }}
                    >
                      Deselect Others
                    </Text>
                  </TouchableOpacity>
                </View>

                <View style={styles.mateGrid}>
                  {mates.map((m) => (
                    <TouchableOpacity
                      key={m.id}
                      onPress={() => toggleMate(m.id)}
                      style={[
                        styles.mateCheck,
                        {
                          backgroundColor: selectedMates.includes(m.id)
                            ? colors.accent
                            : colors.border + "50",
                          borderWidth: m.id === paidBy ? 2 : 1,
                          borderColor:
                            m.id === paidBy ? colors.text : colors.border,
                        },
                      ]}
                    >
                      <Text
                        style={{
                          color: selectedMates.includes(m.id)
                            ? "#fff"
                            : colors.text,
                          fontSize: 12,
                          fontWeight: selectedMates.includes(m.id) ? "800" : "700",
                        }}
                      >
                        {m.name} {m.id === paidBy ? "⭐" : ""}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={saveExpense}
                  activeOpacity={0.9}
                >
                  <Text style={styles.saveBtnText}>
                    {editExpense ? "Update expense" : "Save expense"}
                  </Text>
                  <MaterialIcons name="check-circle" size={18} color="#fff" />
                </TouchableOpacity>
              </ScrollView>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  newHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  circularBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FF6A6A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: { flex: 1, alignItems: "center" },
  monthToggleRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  titleCenter: { alignItems: "center" },
  screenTitle: { fontSize: 20, fontWeight: "900" },
  monthSubtitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  headerActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  listPadding: { paddingHorizontal: 20 },
  sectionHeader: { paddingVertical: 12 },
  sectionHeaderText: {
    fontSize: 14,
    fontWeight: "800",
    textTransform: "uppercase",
  },
  card: { padding: 16, borderRadius: 16, marginBottom: 12, borderWidth: 1 },
  cardInfo: { flexDirection: "row", alignItems: "center", marginBottom: 12 },
  cardTitle: { fontSize: 16, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", marginTop: 4 },
  paidByBadge: {
    backgroundColor: "#FF6A6A15",
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  paidByText: { fontSize: 11, color: "#FF6A6A", fontWeight: "700" },
  cardSub: { fontSize: 12 },
  cardAmount: { fontSize: 18, fontWeight: "800" },
  splitRow: {
    flexDirection: "row",
    alignItems: "center",
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.03)",
  },
  splitLabel: { fontSize: 12, marginRight: 8, fontWeight: "600" },
  splitPill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
    marginRight: 4,
  },
  cardActions: {
    flexDirection: "row",
    justifyContent: "flex-end",
    marginTop: 12,
  },
  emptyContainer: {
    alignItems: "center",
    justifyContent: "center",
    marginTop: 100,
    gap: 15,
  },
  emptyText: { fontSize: 14, fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    borderTopLeftRadius: 25,
    borderTopRightRadius: 25,
    padding: 18,
    maxHeight: "90%",
  },
  modalHero: {
    borderRadius: 22,
    padding: 16,
    marginBottom: 14,
  },
  modalHeroRow: { flexDirection: "row", alignItems: "center", gap: 12 },
  modalHeroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  modalHeroSub: { color: "rgba(255,255,255,0.9)", fontSize: 12, fontWeight: "700" },
  modalCloseBtn: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.18)",
    justifyContent: "center",
    alignItems: "center",
  },
  formCard: {
    borderWidth: 1,
    borderRadius: 18,
    padding: 14,
    marginTop: 4,
    marginBottom: 6,
  },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 15 },
  input: {
    borderWidth: 1,
    borderRadius: 12,
    padding: 15,
    marginBottom: 10,
    fontSize: 16,
  },
  fieldRow: { flexDirection: "row", alignItems: "center", gap: 10 },
  fieldIcon: {
    width: 36,
    height: 36,
    borderRadius: 12,
    backgroundColor: "rgba(148,163,184,0.12)",
    justifyContent: "center",
    alignItems: "center",
  },
  amountWrap: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    paddingVertical: 10,
    gap: 10,
  },
  currencyPill: { fontWeight: "900", fontSize: 14 },
  amountInput: { flex: 1, fontSize: 16, fontWeight: "800" },
  selectorScroll: { marginBottom: 10 },
  selectorPill: {
    paddingHorizontal: 15,
    paddingVertical: 8,
    borderRadius: 20,
    borderWidth: 1,
    marginRight: 8,
  },
  miniBtn: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
    marginRight: 10,
  },
  mateGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
    marginBottom: 20,
  },
  mateCheck: { paddingHorizontal: 15, paddingVertical: 10, borderRadius: 12 },
  saveBtn: {
    backgroundColor: "#FF6A6A",
    padding: 16,
    borderRadius: 12,
    alignItems: "center",
    flexDirection: "row",
    justifyContent: "center",
    gap: 10,
    shadowColor: "#000",
    shadowOpacity: 0.18,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  saveBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
