import React, { useEffect, useState, useRef } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  SectionList,
  ScrollView,
  StyleSheet,
  ActivityIndicator,
  RefreshControl,
  Alert,
  Modal,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../../src/utils/apiClient";
import { useTheme } from "../theme/ThemeContext";

export default function Expenses() {
  const router = useRouter();
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#0F172A",
    sub: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "#334155" : "#E2E8F0",
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const [currentUser, setCurrentUser] = useState<any>(null);
  const [mates, setMates] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [currency, setCurrency] = useState("$");

  const [sections, setSections] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [currentMonth, setCurrentMonth] = useState<string>("");

  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [selectedMates, setSelectedMates] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [editExpense, setEditExpense] = useState<any>(null);

  const sectionListRef = useRef<SectionList>(null);

  const getAuthData = async () => {
    const userJson = await AsyncStorage.getItem("user");
    const token = await AsyncStorage.getItem("token");
    const user = userJson ? JSON.parse(userJson) : null;
    return { user, token };
  };

  const fetchData = async () => {
    setRefreshing(true);
    try {
      const { user, token } = await getAuthData();
      if (!user || !token) return;

      setCurrentUser(user);
      setPaidBy(user.id);

      const dashboard = await apiClient("/dashboard", "GET", undefined, token);
      setMates(dashboard.mates || []);
      setCurrency(dashboard.currency || "$");
      setSelectedMates(dashboard.mates.map((m: any) => m.id));

      const cats = await apiClient("/categories", "GET", undefined, token);
      setCategories(cats);

      const expenses = await apiClient("/expenses", "GET", undefined, token);
      const grouped = expenses.map((m: any) => ({
        title: formatMonth(m.month),
        monthKey: m.month,
        data: (m.records || []).map((r: any) => ({
          id: r.id,
          description: r.description,
          amount: parseFloat(r.amount),
          category: r.category,
          category_id: r.category?.id,
          paid_by: r.paid_by,
          included_mates: r.included_mates || [],
        })),
      }));
      setSections(grouped);
      if (grouped.length > 0) setCurrentMonth(grouped[0].title);
    } catch (e) {
      console.log(e);
    }
    setLoading(false);
    setRefreshing(false);
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatMonth = (month: string) => {
    const date = new Date(month + "-01");
    return date.toLocaleString("default", { month: "short", year: "numeric" });
  };

  const resetForm = () => {
    setTitle("");
    setAmount("");
    setSelectedCategory(null);
    setSelectedMates(mates.map((m) => m.id));
    setPaidBy(currentUser?.id);
    setEditExpense(null);
  };

  const saveExpense = async () => {
    if (!title || !amount || !selectedCategory) {
      return Alert.alert("Please fill all fields");
    }

    try {
      const { token } = await getAuthData();
      const payload = {
        description: title,
        amount: parseFloat(amount),
        category_id: selectedCategory.id,
        included_mates: selectedMates,
        paid_by: paidBy,
      };

      if (editExpense) {
        await apiClient(`/records/${editExpense.id}`, "PUT", payload, token);
      } else {
        await apiClient("/records", "POST", payload, token);
      }

      resetForm();
      setModalVisible(false);
      fetchData();
    } catch (e) {
      console.log(e);
    }
  };

  const handleDelete = (expense: any) => {
    Alert.alert("Delete Expense", "Are you sure?", [
      { text: "Cancel" },
      {
        text: "Delete",
        onPress: async () => {
          const { token } = await getAuthData();
          await apiClient(`/records/${expense.id}`, "DELETE", undefined, token);
          fetchData();
        },
      },
    ]);
  };

  const startEdit = (item: any) => {
    setEditExpense(item);
    setTitle(item.description);
    setAmount(item.amount.toString());
    setSelectedCategory(categories.find((c) => c.id === item.category_id));
    setSelectedMates(item.included_mates);
    setPaidBy(item.paid_by);
    setModalVisible(true);
  };

  const renderExpense = ({ item }: any) => {
    const payer = mates.find((m) => m.id === item.paid_by)?.name || "Unknown";
    const included = item.included_mates
      .map((id: string) => mates.find((m) => m.id === id)?.name)
      .join(", ");

    const canEdit =
      currentUser?.role === "admin" || item.paid_by === currentUser?.id;

    return (
      <View style={[styles.card, { backgroundColor: colors.card }]}>
        <View style={styles.row}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>
              {item.description}
            </Text>
            <Text style={{ color: colors.sub, fontSize: 12 }}>
              Paid by {payer}
            </Text>
            <Text style={{ color: colors.sub, fontSize: 12 }}>
              Split: {included}
            </Text>
          </View>
          <Text style={[styles.amount, { color: colors.text }]}>
            {currency}
            {item.amount.toFixed(2)}
          </Text>
        </View>

        {canEdit && (
          <View style={styles.actions}>
            <TouchableOpacity
              style={styles.editBtn}
              onPress={() => startEdit(item)}
            >
              <Text style={{ color: "#fff" }}>Edit</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.deleteBtn}
              onPress={() => handleDelete(item)}
            >
              <Text style={{ color: "#fff" }}>Delete</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>
    );
  };

  const scrollToMonth = (title: string) => {
    const index = sections.findIndex((s) => s.title === title);
    if (index !== -1 && sectionListRef.current) {
      sectionListRef.current.scrollToLocation({
        sectionIndex: index,
        itemIndex: 0,
        animated: true,
      });
      setCurrentMonth(title);
    }
  };

  if (loading)
    return (
      <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6A6A" />
    );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: colors.bg, paddingTop: 20 }, // add top padding
      ]}
    >
      {/* Back Button */}
      <TouchableOpacity
        onPress={() => router.push("/(tabs)/dashboard")}
        style={{
          flexDirection: "row",
          alignItems: "center",
          paddingVertical: 8,
          paddingHorizontal: 14,
          borderRadius: 24,
          backgroundColor: "#FF6A6A",
          alignSelf: "flex-start",
          marginBottom: 16,
        }}
      >
        <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        <Text style={{ color: "#fff", fontWeight: "600", marginLeft: 8 }}>
          Dashboard
        </Text>
      </TouchableOpacity>

      {/* Month Selector */}


<ScrollView
  horizontal
  showsHorizontalScrollIndicator={false}
  style={{ marginBottom: 16 }}
  contentContainerStyle={{ paddingHorizontal: 12 }}
>
  {sections.map((sec) => (
    <TouchableOpacity
      key={sec.title}
      onPress={() => scrollToMonth(sec.title)}
      style={{
        paddingVertical: Platform.select({ ios: 6, android: 10, default: 8 }),
        paddingHorizontal: 16,
        borderRadius: 25,
        marginRight: 10,
        backgroundColor:
          sec.title === currentMonth ? "#FF6A6A" : colors.card,
        borderWidth: sec.title === currentMonth ? 0 : 1,
        borderColor: colors.border,
        minHeight: Platform.select({ ios: 28, android: 40, default: 32 }),
        justifyContent: "center",
        alignItems: "center",
      }}
    >
      <Text
        style={{
          color: sec.title === currentMonth ? "#fff" : colors.text,
          fontWeight: "600",
          fontSize: 14,
        }}
      >
        {sec.title}
      </Text>
    </TouchableOpacity>
  ))}
</ScrollView>

      <SectionList
        ref={sectionListRef}
        sections={sections}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderExpense}
        renderSectionHeader={({ section }) => (
          <Text style={[styles.month, { color: colors.text }]}>
            {section.title}
          </Text>
        )}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={fetchData} />
        }
        contentContainerStyle={{ padding: 20, paddingBottom: 100 }}
      />

      {/* Floating Add Button */}
      <TouchableOpacity
        style={styles.fab}
        onPress={() => setModalVisible(true)}
      >
        <FontAwesome5 name="plus" size={20} color="#fff" />
      </TouchableOpacity>

      {/* Modal */}
      <Modal visible={modalVisible} animationType="slide" transparent={true}>
        <SafeAreaView
          style={[
            styles.modal,
            {
              backgroundColor: colors.bg,
              paddingTop: Platform.OS === "ios" ? 50 : 20,
            },
          ]}
        >
          <ScrollView style={{ padding: 20 }}>
            <Text style={[styles.header, { color: colors.text }]}>
              {editExpense ? "Edit Expense" : "Add Expense"}
            </Text>

            <TextInput
              placeholder="Title"
              value={title}
              onChangeText={setTitle}
              style={[
                styles.input,
                { backgroundColor: colors.card, color: colors.text },
              ]}
            />

            <TextInput
              placeholder="0.00"
              keyboardType="numeric"
              value={amount}
              onChangeText={(t) => setAmount(t.replace(/[^0-9.]/g, ""))}
              style={[
                styles.input,
                { backgroundColor: colors.card, color: colors.text },
              ]}
            />

            {/* Categories */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={{ marginVertical: 10 }}
            >
              {categories.map((c) => {
                const isSelected = selectedCategory?.id === c.id;
                return (
                  <TouchableOpacity
                    key={c.id}
                    onPress={() => setSelectedCategory(c)}
                    style={[
                      styles.category,
                      {
                        backgroundColor: isSelected ? "#FF6A6A" : colors.card,
                        borderColor: isSelected ? "#FF6A6A" : colors.border,
                      },
                    ]}
                  >
                    <FontAwesome5
                      name={c.icon || "tag"}
                      size={18}
                      color={isSelected ? "#fff" : colors.text}
                    />
                    <Text
                      style={{
                        fontSize: 12,
                        color: isSelected ? "#fff" : colors.text,
                      }}
                    >
                      {c.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>

            {/* Split Among */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Split Among
            </Text>
            <View style={styles.wrap}>
              {mates.map((m) => {
                const selected = selectedMates.includes(m.id);
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => {
                      setSelectedMates((prev) =>
                        selected
                          ? prev.filter((id) => id !== m.id)
                          : [...prev, m.id],
                      );
                    }}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: selected ? "#6366F1" : colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: selected ? "#fff" : colors.text }}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Paid By */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>
              Paid By
            </Text>
            <View style={styles.wrap}>
              {mates.map((m) => {
                const active = paidBy === m.id;
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setPaidBy(m.id)}
                    style={[
                      styles.chip,
                      {
                        backgroundColor: active ? "#FF6A6A" : colors.card,
                        borderColor: colors.border,
                      },
                    ]}
                  >
                    <Text style={{ color: active ? "#fff" : colors.text }}>
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <TouchableOpacity style={styles.saveBtn} onPress={saveExpense}>
              <Text style={{ color: "#fff", fontWeight: "600" }}>
                {editExpense ? "Update Expense" : "Add Expense"}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              onPress={() => setModalVisible(false)}
              style={{ marginTop: 15, alignItems: "center" }}
            >
              <Text style={{ color: "#FF6A6A" }}>Cancel</Text>
            </TouchableOpacity>
          </ScrollView>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  month: { fontSize: 18, fontWeight: "700", marginBottom: 10 },
  card: { padding: 16, borderRadius: 14, marginBottom: 10 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  title: { fontSize: 16, fontWeight: "600" },
  amount: { fontSize: 16, fontWeight: "700" },
  actions: { flexDirection: "row", marginTop: 10 },
  editBtn: {
    backgroundColor: "#4F46E5",
    padding: 8,
    borderRadius: 8,
    marginRight: 10,
  },
  deleteBtn: { backgroundColor: "#EF4444", padding: 8, borderRadius: 8 },
  fab: {
    position: "absolute",
    bottom: 30,
    right: 20,
    backgroundColor: "#FF6A6A",
    width: 60,
    height: 60,
    borderRadius: 30,
    alignItems: "center",
    justifyContent: "center",
    elevation: 5,
  },
  modal: { flex: 1 },
  header: { fontSize: 22, fontWeight: "700", marginBottom: 15 },
  input: { padding: 15, borderRadius: 12, marginBottom: 10 },
  category: {
    width: 70,
    height: 70,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 10,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginTop: 20,
    marginBottom: 10,
  },
  wrap: { flexDirection: "row", flexWrap: "wrap" },
  chip: {
    paddingVertical: 10,
    paddingHorizontal: 14,
    borderRadius: 20,
    margin: 5,
    borderWidth: 1,
  },
  saveBtn: {
    backgroundColor: "#FF6A6A",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 20,
  },
});
