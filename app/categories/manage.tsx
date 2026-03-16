import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  TextInput,
  Modal,
  ScrollView,
  StyleSheet,
} from "react-native";
import { FontAwesome5 } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../../src/utils/apiClient";

const iconOptions = [
  "shopping-cart",
  "utensils",
  "bolt",
  "tint",
  "wifi",
  "home",
  "car",
];

export default function ManageCategories() {
  const [categories, setCategories] = useState<any[]>([]);
  const [modalVisible, setModalVisible] = useState(false);
  const [newName, setNewName] = useState("");
  const [selectedIcon, setSelectedIcon] = useState("shopping-cart");
  const [editingCategory, setEditingCategory] = useState<any>(null);
  const [confirmModal, setConfirmModal] = useState(false);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);

  const router = useRouter();

  // Get token & user info
  const getAuthData = async () => {
    const userJson = await AsyncStorage.getItem("user");
    const token = await AsyncStorage.getItem("token");
    const user = userJson ? JSON.parse(userJson) : null;
    return { user, token };
  };

  // Fetch categories
  const fetchCategories = async () => {
    try {
      const { token } = await getAuthData();
      if (!token) return;

      const cats = await apiClient("/categories", "GET", undefined, token);
      setCategories(cats);
    } catch (err: any) {
      console.error("Failed to fetch categories:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    const init = async () => {
      const { user } = await getAuthData();
      if (!user) {
        router.replace("/login");
        return;
      }
      setCurrentUser(user);
      fetchCategories();
    };
    init();
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
    setModalVisible(true);
  };

  const saveCategory = async () => {
    if (!newName.trim()) return;

    try {
      const { token } = await getAuthData();
      if (!token) return;

      if (editingCategory) {
        // Update
        await apiClient(
          `/categories/${editingCategory.id}`,
          "PUT",
          { name: newName, icon: selectedIcon },
          token,
        );
      } else {
        // Create
        await apiClient(
          "/categories",
          "POST",
          { name: newName, icon: selectedIcon },
          token,
        );
      }

      fetchCategories();
      setModalVisible(false);
      setConfirmModal(true);
    } catch (err: any) {
      console.error("Failed to save category:", err);
    }
  };

  const confirmDelete = async (category: any) => {
    try {
      const { token } = await getAuthData();
      if (!token) return;

      await apiClient(`/categories/${category.id}`, "DELETE", undefined, token);
      fetchCategories();
    } catch (err: any) {
      console.error("Failed to delete category:", err);
    }
  };

  const resetForm = () => {
    setNewName("");
    setSelectedIcon("shopping-cart");
    setEditingCategory(null);
    setConfirmModal(false);
  };

  const renderCategory = ({ item }: { item: any }) => (
    <View style={styles.categoryCard}>
      <FontAwesome5 name={item.icon} size={24} color="#FF1493" />
      <Text style={styles.categoryName}>{item.name}</Text>
      <View style={{ flexDirection: "row" }}>
        <TouchableOpacity
          style={styles.editBtn}
          onPress={() => openModal(item)}
        >
          <Text style={styles.actionText}>Edit</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={styles.deleteBtn}
          onPress={() => confirmDelete(item)}
        >
          <Text style={styles.actionText}>Delete</Text>
        </TouchableOpacity>
      </View>
    </View>
  );

  if (loading)
    return (
      <Text style={{ flex: 1, textAlign: "center", marginTop: 20 }}>
        Loading...
      </Text>
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
      <View style={styles.container}>
        <Text style={styles.title}>Manage Categories</Text>
        <TouchableOpacity
          style={styles.backBtn}
          onPress={() => router.push("/(tabs)/dashboard")}
        >
          <Text style={styles.backBtnText}>← Back to Dashboard</Text>
        </TouchableOpacity>

        <FlatList
          data={categories}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderCategory}
          ListEmptyComponent={<Text>No categories yet</Text>}
        />

        <TouchableOpacity style={styles.addBtn} onPress={() => openModal()}>
          <Text style={styles.addText}>+ Add Category</Text>
        </TouchableOpacity>

        {/* Add/Edit Modal */}
        <Modal visible={modalVisible} transparent animationType="slide">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>
                {editingCategory ? "Edit Category" : "Add Category"}
              </Text>
              <TextInput
                placeholder="Category Name"
                value={newName}
                onChangeText={setNewName}
                style={styles.modalInput}
              />

              <ScrollView horizontal style={{ marginBottom: 20 }}>
                {iconOptions.map((icon) => (
                  <TouchableOpacity
                    key={icon}
                    style={{
                      padding: 10,
                      marginRight: 10,
                      borderRadius: 12,
                      backgroundColor:
                        selectedIcon === icon ? "#FF1493" : "#eee",
                    }}
                    onPress={() => setSelectedIcon(icon)}
                  >
                    <FontAwesome5
                      name={icon}
                      size={24}
                      color={selectedIcon === icon ? "#fff" : "#333"}
                    />
                  </TouchableOpacity>
                ))}
              </ScrollView>

              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                }}
              >
                <TouchableOpacity style={styles.saveBtn} onPress={saveCategory}>
                  <Text style={styles.actionText}>Save</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[styles.saveBtn, { backgroundColor: "#ccc" }]}
                  onPress={() => setModalVisible(false)}
                >
                  <Text style={styles.actionText}>Cancel</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Confirmation Modal */}
        <Modal transparent visible={confirmModal} animationType="fade">
          <View style={styles.modalOverlay}>
            <View style={styles.modalContent}>
              <Text style={styles.modalTitle}>Category Saved!</Text>
              <Text style={{ marginTop: 10 }}>
                Do you want to add another category or go back?
              </Text>
              <View
                style={{
                  flexDirection: "row",
                  justifyContent: "space-between",
                  marginTop: 20,
                }}
              >
                <TouchableOpacity style={styles.modalBtn} onPress={resetForm}>
                  <Text style={styles.modalBtnText}>Add Another</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.modalBtn}
                  onPress={() => router.push("/(tabs)/dashboard")}
                >
                  <Text style={styles.modalBtnText}>Dashboard</Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20, backgroundColor: "#F5F5F5" },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 20 },
  categoryCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 12,
    marginBottom: 10,
  },
  categoryName: { fontSize: 18, marginLeft: 10, flex: 1 },
  editBtn: {
    backgroundColor: "#6A8DFF",
    padding: 8,
    borderRadius: 8,
    marginRight: 5,
  },
  deleteBtn: { backgroundColor: "#FF6A6A", padding: 8, borderRadius: 8 },
  actionText: { color: "#fff", fontWeight: "600" },
  addBtn: {
    backgroundColor: "#FF1493",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
    marginTop: 10,
  },
  addText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    width: "85%",
    backgroundColor: "#fff",
    padding: 20,
    borderRadius: 12,
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
  },
  saveBtn: {
    backgroundColor: "#6A8DFF",
    padding: 12,
    borderRadius: 12,
    flex: 1,
    marginHorizontal: 5,
    alignItems: "center",
  },
  modalBtn: {
    flex: 1,
    marginHorizontal: 5,
    backgroundColor: "#FF1493",
    padding: 12,
    borderRadius: 12,
    alignItems: "center",
  },
  modalBtnText: { color: "#fff", fontWeight: "bold" },
  backBtn: {
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#FF6A6A",
    borderRadius: 12,
    alignSelf: "flex-start",
  },
  backBtnText: { color: "#fff", fontWeight: "bold", fontSize: 16 },
});
