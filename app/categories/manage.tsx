import { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  StyleSheet,
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  ScrollView,
} from "react-native";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../../src/utils/apiClient";
import { useKeyboardBottomPadding } from "../../src/hooks/useKeyboardBottomPadding";
import { useTheme } from "../theme/ThemeContext";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";

const iconList = [
  "shopping-cart",
  "utensils",
  "bolt",
  "tint",
  "wifi",
  "home",
  "car",
  "gift",
  "apple-alt",
  "book",
  "camera",
  "coffee",
  "heart",
  "music",
  "map",
  "wallet",
  "leaf",
  "phone",
  "star",
  "pen",
  "film",
  "plug",
  "bus",
  "plane",
  "medkit",
  "lightbulb",
  "trash",
  "tools",
  "broom",
  "tshirt",
];

export default function ManageCategories() {
  const router = useRouter();
  const { isDark } = useTheme();
  const insets = useSafeAreaInsets();
  const modalKeyboardPad = useKeyboardBottomPadding(24);

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#0F172A",
    sub: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    primary: "#FF6A6A",
    accent: "#6A8DFF",
  };

  const [categories, setCategories] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [modalMode, setModalMode] = useState<"form" | "icon">("form");
  const [iconSearch, setIconSearch] = useState("");
  const [newName, setNewName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("shopping-cart");
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  const fetchCategories = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return;
      const cats = await apiClient("/categories", "GET", undefined, token);
      setCategories(cats);
    } catch (e) {
      console.log(e);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchCategories();
  }, []);

  const openModal = (category?: any) => {
    if (category) {
      setEditingCategory(category);
      setNewName(category.name);
      setSelectedIcon(category.icon);
    } else {
      setEditingCategory(null);
      setNewName("");
      setSelectedIcon("shopping-cart");
    }
    setModalMode("form");
    setModalVisible(true);
  };

  const saveCategory = async () => {
    if (!newName.trim()) return;
    try {
      const token = await AsyncStorage.getItem("token");
      const payload = { name: newName, icon: selectedIcon };
      if (editingCategory) {
        await apiClient(
          `/categories/${editingCategory.id}`,
          "PUT",
          payload,
          token!,
        );
      } else {
        await apiClient("/categories", "POST", payload, token!);
      }
      fetchCategories();
      setModalVisible(false);
    } catch (e) {
      console.log(e);
    }
  };

  const deleteCategory = async (id: number) => {
    try {
      const token = await AsyncStorage.getItem("token");
      await apiClient(`/categories/${id}`, "DELETE", undefined, token!);
      fetchCategories();
    } catch (e) {
      console.log("Delete error:", e);
    }
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      {/* Header */}
      <View style={styles.newHeader}>
        <TouchableOpacity
          onPress={() => router.back()}
          style={styles.circularBackBtn}
        >
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            Categories
          </Text>
          <Text style={[styles.screenSubtitle, { color: colors.sub }]}>
            Organize your spending
          </Text>
        </View>
        <TouchableOpacity
          style={[
            styles.headerActionBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => openModal()}
        >
          <FontAwesome5 name="plus" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <ActivityIndicator
          size="large"
          color={colors.primary}
          style={{ marginTop: 50 }}
        />
      ) : (
        <FlatList
          data={categories}
          keyExtractor={(i) => i.id.toString()}
          renderItem={({ item }) => (
            <View
              style={[
                styles.card,
                { backgroundColor: colors.card, borderColor: colors.border },
              ]}
            >
              <View
                style={[
                  styles.iconCircle,
                  { backgroundColor: colors.primary + "15" },
                ]}
              >
                <FontAwesome5
                  name={item.icon}
                  size={18}
                  color={colors.primary}
                />
              </View>
              <Text style={[styles.categoryName, { color: colors.text }]}>
                {item.name}
              </Text>
              <View style={styles.actionButtons}>
                <TouchableOpacity
                  onPress={() => openModal(item)}
                  style={styles.editBtn}
                >
                  <MaterialIcons name="edit" size={20} color={colors.accent} />
                </TouchableOpacity>
                <TouchableOpacity onPress={() => deleteCategory(item.id)}>
                  <MaterialIcons
                    name="delete-outline"
                    size={22}
                    color="#EF4444"
                  />
                </TouchableOpacity>
              </View>
            </View>
          )}
          contentContainerStyle={{ paddingHorizontal: 20, paddingBottom: 100 }}
        />
      )}

      <TouchableOpacity
        style={[styles.fab, { backgroundColor: colors.primary }]}
        onPress={() => openModal()}
      >
        <FontAwesome5 name="plus" size={20} color="#fff" />
      </TouchableOpacity>

      <Modal visible={modalVisible} animationType="slide" transparent>
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.overlay}>
            <View
              style={[
                styles.modal,
                {
                  backgroundColor: colors.card,
                  paddingBottom: Math.max(insets.bottom, 12),
                },
              ]}
            >
              {modalMode === "form" ? (
                <ScrollView
                  keyboardShouldPersistTaps="handled"
                  keyboardDismissMode="interactive"
                  showsVerticalScrollIndicator={false}
                  contentContainerStyle={{ paddingBottom: modalKeyboardPad }}
                >
                  <View style={styles.modalHeader}>
                    <Text style={[styles.modalTitle, { color: colors.text }]}>
                      {editingCategory ? "Edit" : "Add"} Category
                    </Text>
                    <TouchableOpacity onPress={() => setModalVisible(false)}>
                      <MaterialIcons
                        name="close"
                        size={24}
                        color={colors.sub}
                      />
                    </TouchableOpacity>
                  </View>

                  <Text style={[styles.label, { color: colors.text }]}>
                    Category Name
                  </Text>
                  <TextInput
                    placeholder="e.g. Groceries"
                    placeholderTextColor={colors.sub}
                    value={newName}
                    onChangeText={setNewName}
                    style={[
                      styles.input,
                      { color: colors.text, borderColor: colors.border },
                    ]}
                  />

                  <Text style={[styles.label, { color: colors.text }]}>
                    Selected Icon
                  </Text>
                  <TouchableOpacity
                    onPress={() => {
                      setIconSearch("");
                      setModalMode("icon");
                    }}
                    style={[
                      styles.iconPickerBtn,
                      { borderColor: colors.border },
                    ]}
                  >
                    <View
                      style={[
                        styles.iconCircle,
                        { backgroundColor: colors.primary + "15" },
                      ]}
                    >
                      <FontAwesome5
                        name={selectedIcon}
                        size={20}
                        color={colors.primary}
                      />
                    </View>
                    <Text
                      style={{
                        marginLeft: 12,
                        color: colors.text,
                        fontWeight: "600",
                        textTransform: "capitalize",
                      }}
                    >
                      {selectedIcon.replace("-", " ")}
                    </Text>
                    <MaterialIcons
                      name="chevron-right"
                      size={24}
                      color={colors.sub}
                      style={{ marginLeft: "auto" }}
                    />
                  </TouchableOpacity>

                  <TouchableOpacity
                    style={[
                      styles.btn,
                      { backgroundColor: colors.primary, marginTop: 25 },
                    ]}
                    onPress={saveCategory}
                  >
                    <Text style={styles.btnText}>Save Category</Text>
                  </TouchableOpacity>
                </ScrollView>
              ) : (
                <View style={{ maxHeight: 450 }}>
                  <View style={styles.modalHeader}>
                    <TouchableOpacity
                      onPress={() => setModalMode("form")}
                      style={{ flexDirection: "row", alignItems: "center" }}
                    >
                      <MaterialIcons
                        name="arrow-back"
                        size={20}
                        color={colors.primary}
                      />
                      <Text
                        style={{
                          color: colors.primary,
                          fontWeight: "700",
                          marginLeft: 5,
                        }}
                      >
                        Back
                      </Text>
                    </TouchableOpacity>
                    <Text
                      style={[
                        styles.modalTitle,
                        { color: colors.text, fontSize: 16 },
                      ]}
                    >
                      Select Icon
                    </Text>
                    <View style={{ width: 40 }} />
                  </View>

                  <TextInput
                    placeholder="Search icons..."
                    placeholderTextColor={colors.sub}
                    value={iconSearch}
                    onChangeText={setIconSearch}
                    style={[
                      styles.input,
                      {
                        color: colors.text,
                        borderColor: colors.border,
                        marginBottom: 15,
                        height: 45,
                        paddingVertical: 5,
                      },
                    ]}
                  />

                  <FlatList
                    data={iconList.filter((i) =>
                      i.toLowerCase().includes(iconSearch.toLowerCase()),
                    )}
                    numColumns={3}
                    keyExtractor={(i) => i}
                    showsVerticalScrollIndicator={false}
                    renderItem={({ item }) => (
                      <TouchableOpacity
                        onPress={() => {
                          setSelectedIcon(item);
                          setModalMode("form");
                        }}
                        style={[
                          styles.iconGridItem,
                          selectedIcon === item && {
                            backgroundColor: colors.primary + "10",
                            borderColor: colors.primary,
                            borderWidth: 1,
                          },
                        ]}
                      >
                        <FontAwesome5
                          name={item}
                          size={22}
                          color={
                            selectedIcon === item ? colors.primary : colors.text
                          }
                        />
                        <Text
                          style={[
                            styles.iconLabel,
                            {
                              color:
                                selectedIcon === item
                                  ? colors.primary
                                  : colors.sub,
                            },
                          ]}
                          numberOfLines={1}
                        >
                          {item}
                        </Text>
                      </TouchableOpacity>
                    )}
                    contentContainerStyle={{ paddingBottom: modalKeyboardPad }}
                  />
                </View>
              )}
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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
  headerTitleContainer: { flex: 1, marginLeft: 15 },
  screenTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 12, fontWeight: "600", marginTop: -2 },
  headerActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },
  card: {
    padding: 12,
    borderRadius: 16,
    marginBottom: 12,
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
  },
  iconCircle: {
    width: 40,
    height: 40,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
  },
  categoryName: { flex: 1, marginLeft: 12, fontSize: 16, fontWeight: "700" },
  actionButtons: { flexDirection: "row", alignItems: "center" },
  editBtn: { marginRight: 15 },
  fab: {
    position: "absolute",
    bottom: 60,
    right: 20,
    width: 56,
    height: 56,
    borderRadius: 28,
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOpacity: 0.2,
    shadowRadius: 5,
  },
  overlay: {
    flex: 1,
    justifyContent: "flex-end",
    backgroundColor: "rgba(0,0,0,0.4)",
  },
  modal: { borderTopLeftRadius: 28, borderTopRightRadius: 28, padding: 25 },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 20, fontWeight: "800" },
  label: { fontSize: 14, fontWeight: "700", marginBottom: 8, marginTop: 10 },
  input: { borderWidth: 1, borderRadius: 14, padding: 14, fontSize: 16 },
  iconPickerBtn: {
    flexDirection: "row",
    alignItems: "center",
    borderWidth: 1,
    borderRadius: 14,
    padding: 10,
    marginTop: 5,
  },
  btn: { padding: 16, borderRadius: 16, alignItems: "center" },
  btnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
  iconGridItem: {
    width: "31%",
    margin: "1%",
    alignItems: "center",
    paddingVertical: 15,
    borderRadius: 16,
  },
  iconLabel: {
    fontSize: 10,
    marginTop: 6,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});
