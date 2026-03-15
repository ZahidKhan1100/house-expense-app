import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  StyleSheet,
  ScrollView,
  Modal,
  ActivityIndicator,
} from "react-native";
import { auth, db } from "../../firebase";
import {
  doc,
  getDoc,
  collection,
  getDocs,
  addDoc,
  updateDoc,
  deleteDoc,
} from "firebase/firestore";
import { useRouter } from "expo-router";
import { FontAwesome5 } from "@expo/vector-icons";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddExpense() {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [categories, setCategories] = useState<any[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<any>(null);
  const [mates, setMates] = useState<any[]>([]);
  const [selectedMates, setSelectedMates] = useState<string[]>([]);
  const [paidBy, setPaidBy] = useState<string | null>(null);
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [currentUser, setCurrentUser] = useState<any>(null);
  const [currency, setCurrency] = useState("$"); // default

  const [showConfirmModal, setShowConfirmModal] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState<{
    visible: boolean;
    expense?: any;
  }>({ visible: false });
  const [editExpense, setEditExpense] = useState<any>(null);

  const router = useRouter();

  useEffect(() => {
    const fetchData = async () => {
      try {
        const user = auth.currentUser;
        if (!user) return;

        const userSnap = await getDoc(doc(db, "users", user.uid));
        const houseId = userSnap.data()?.houseId;
        const role = userSnap.data()?.role;
        setCurrentUser({ uid: user.uid, role });

        if (!houseId) return;

        // Fetch house currency
        const houseSnap = await getDoc(doc(db, "houses", houseId));
        if (houseSnap.exists()) {
          const houseData = houseSnap.data();
          setCurrency(houseData.currency || "$");
        }

        // Categories
        const catSnap = await getDocs(
          collection(db, "houses", houseId, "categories"),
        );
        setCategories(catSnap.docs.map((d) => ({ id: d.id, ...d.data() })));

        // Mates
        const mateIds: string[] = houseSnap.data()?.mates || [];
        const mateList: any[] = [];
        for (const mateId of mateIds) {
          const mateSnap = await getDoc(doc(db, "users", mateId));
          if (mateSnap.exists())
            mateList.push({
              id: mateId,
              name: mateSnap.data().name,
              role: mateSnap.data().role,
            });
        }
        setMates(mateList);
        setSelectedMates(mateList.map((m) => m.id));
        setPaidBy(user.uid);

        // Expenses
        const expenseSnap = await getDocs(
          collection(db, "houses", houseId, "expenses"),
        );
        setExpenses(expenseSnap.docs.map((d) => ({ id: d.id, ...d.data() })));
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  const resetForm = () => {
    setTitle("");
    setAmount("");
    setSelectedCategory(null);
    setSelectedMates(mates.map((m) => m.id));
    setPaidBy(auth.currentUser?.uid || null);
    setEditExpense(null);
    setShowConfirmModal(false);
  };

  const toggleMate = (mateId: string) => {
    setSelectedMates((prev) =>
      prev.includes(mateId)
        ? prev.filter((id) => id !== mateId)
        : [...prev, mateId],
    );
  };

  const handleAmountChange = (text: string) => {
    // Allow only numbers and up to 2 decimals
    const formatted = text.replace(/[^0-9.]/g, ""); // remove non-numeric/non-dot
    // Ensure only one dot
    const parts = formatted.split(".");
    if (parts.length > 2) {
      setAmount(parts[0] + "." + parts[1]);
    } else {
      // Limit decimal places to 2
      if (parts[1]?.length > 2) {
        setAmount(parts[0] + "." + parts[1].slice(0, 2));
      } else {
        setAmount(formatted);
      }
    }
  };

  const saveExpense = async () => {
    if (!title.trim() || !amount.trim() || !selectedCategory || !paidBy) {
      return alert("Please fill all fields");
    }

    try {
      const user = auth.currentUser!;
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const houseId = userSnap.data()?.houseId;
      const amt = parseFloat(parseFloat(amount).toFixed(2)); // force 2 decimals

      if (editExpense) {
        await updateDoc(
          doc(db, "houses", houseId, "expenses", editExpense.id),
          {
            description: title,
            amount: amt,
            categoryId: selectedCategory.id,
            includedMates: selectedMates,
            paidBy,
          },
        );
        setExpenses((prev) =>
          prev.map((e) =>
            e.id === editExpense.id
              ? {
                  ...e,
                  description: title,
                  amount: amt,
                  categoryId: selectedCategory.id,
                  includedMates: selectedMates,
                  paidBy,
                }
              : e,
          ),
        );
      } else {
        const docRef = await addDoc(
          collection(db, "houses", houseId, "expenses"),
          {
            addedBy: user.uid,
            amount: amt,
            description: title,
            categoryId: selectedCategory.id,
            includedMates: selectedMates,
            paidBy,
            timestamp: new Date(),
          },
        );
        setExpenses((prev) => [
          ...prev,
          {
            id: docRef.id,
            addedBy: user.uid,
            amount: amt,
            description: title,
            categoryId: selectedCategory.id,
            includedMates: selectedMates,
            paidBy,
            timestamp: new Date(),
          },
        ]);
      }

      setShowConfirmModal(true);
    } catch (err) {
      console.error(err);
      alert("Error saving expense");
    }
  };

  const startEdit = (expense: any) => {
    setEditExpense(expense);
    setTitle(expense.description);
    setAmount(expense.amount.toFixed(2)); // show 2 decimals
    setSelectedCategory(categories.find((c) => c.id === expense.categoryId));
    setSelectedMates(expense.includedMates);
    setPaidBy(expense.paidBy);
  };

  const confirmDelete = (expense: any) =>
    setDeleteConfirm({ visible: true, expense });

  const handleDelete = async () => {
    const expense = deleteConfirm.expense;
    if (!expense) return;

    try {
      const user = currentUser!;
      const userSnap = await getDoc(doc(db, "users", user.uid));
      const houseId = userSnap.data()?.houseId;

      if (expense.addedBy !== user.uid && user.role !== "admin") {
        alert("You can't delete this expense");
        setDeleteConfirm({ visible: false });
        return;
      }

      await deleteDoc(doc(db, "houses", houseId, "expenses", expense.id));
      setExpenses((prev) => prev.filter((e) => e.id !== expense.id));
    } catch (err) {
      console.error(err);
    } finally {
      setDeleteConfirm({ visible: false });
    }
  };

  if (loading)
    return (
      <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6A6A" />
    );

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: "#F8FAFC" }}>
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
    >
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.push("/(tabs)/dashboard")}
      >
        <Text style={styles.backBtnText}>← Back to Dashboard</Text>
      </TouchableOpacity>
      <TextInput
        placeholder="Expense Title"
        value={title}
        onChangeText={setTitle}
        style={styles.input}
      />
      <TextInput
        placeholder="0.00"
        value={amount}
        onChangeText={handleAmountChange}
        style={styles.input}
        keyboardType="numeric"
      />

      <Text style={styles.label}>Category</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
      >
        {categories.map((item) => {
          const isSelected = selectedCategory?.id === item.id;
          return (
            <TouchableOpacity
              key={item.id}
              onPress={() => setSelectedCategory(item)}
              style={[styles.categoryChip, isSelected && styles.activeCategory]}
            >
              <FontAwesome5
                name={item.icon || "tag"}
                size={20}
                color={isSelected ? "#FF6A6A" : "#333"}
              />
              <Text
                style={[
                  styles.chipText,
                  { color: isSelected ? "#FF6A6A" : "#333" },
                ]}
              >
                {item.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <Text style={styles.label}>Split Between</Text>
      <View style={styles.mateList}>
        {mates.map((mate) => {
          const isSelected = selectedMates.includes(mate.id);
          return (
            <TouchableOpacity
              key={mate.id}
              onPress={() => toggleMate(mate.id)}
              style={[styles.mateChip, isSelected && styles.activeMate]}
            >
              <Text style={{ color: isSelected ? "#fff" : "#333" }}>
                {mate.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <Text style={styles.label}>Paid By</Text>
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.row}
      >
        {mates.map((mate) => {
          const isSelected = paidBy === mate.id;
          return (
            <TouchableOpacity
              key={mate.id}
              onPress={() => setPaidBy(mate.id)}
              style={[styles.paidByChip, isSelected && styles.activePaidBy]}
            >
              <Text style={{ color: isSelected ? "#FF6A6A" : "#333" }}>
                {mate.name}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <TouchableOpacity style={styles.addBtn} onPress={saveExpense}>
        <Text style={styles.addBtnText}>
          {editExpense ? "Update Expense" : "Save Expense"}
        </Text>
      </TouchableOpacity>

      {/* --- EXPENSE LIST --- */}
      {expenses.map((expense) => {
        const addedByMe = expense.addedBy === currentUser?.uid;
        const canEditOrDelete = addedByMe || currentUser?.role === "admin";
        const paidByName =
          mates.find((m) => m.id === expense.paidBy)?.name || "Unknown";

        return (
          <View key={expense.id} style={styles.expenseCard}>
            <View>
              <Text style={styles.expenseText}>
                {expense.description} - {currency}
                {expense.amount.toFixed(2)}
              </Text>
              <Text style={{ fontSize: 12, color: "#555" }}>
                Paid by: {paidByName}
              </Text>
            </View>
            <View style={{ flexDirection: "row" }}>
              {canEditOrDelete && (
                <>
                  <TouchableOpacity
                    style={styles.editBtn}
                    onPress={() => startEdit(expense)}
                  >
                    <Text style={styles.actionText}>Edit</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={styles.deleteBtn}
                    onPress={() => confirmDelete(expense)}
                  >
                    <Text style={styles.actionText}>Delete</Text>
                  </TouchableOpacity>
                </>
              )}
            </View>
          </View>
        );
      })}

      {/* --- CONFIRM MODAL --- */}
      <Modal transparent visible={showConfirmModal} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Expense Saved!</Text>
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

      {/* --- DELETE MODAL --- */}
      <Modal transparent visible={deleteConfirm.visible} animationType="fade">
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <Text style={styles.modalTitle}>Delete Expense?</Text>
            <Text style={{ marginTop: 10 }}>
              Are you sure you want to delete this expense?
            </Text>
            <View
              style={{
                flexDirection: "row",
                justifyContent: "space-between",
                marginTop: 20,
              }}
            >
              <TouchableOpacity
                style={styles.modalBtn}
                onPress={() => setDeleteConfirm({ visible: false })}
              >
                <Text style={styles.modalBtnText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={styles.modalBtn} onPress={handleDelete}>
                <Text style={styles.modalBtnText}>Delete</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
    </SafeAreaView>
  );
}

// --- Styles remain the same as before ---
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  scrollContent: { padding: 20, paddingBottom: 100 },
  input: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    fontSize: 16,
    marginBottom: 15,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  label: {
    fontSize: 16,
    fontWeight: "bold",
    color: "#1E293B",
    marginBottom: 10,
    marginTop: 10,
  },
  row: { flexDirection: "row", marginBottom: 10 },
  categoryChip: {
    width: 85,
    height: 85,
    backgroundColor: "#fff",
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
    borderWidth: 2,
    borderColor: "#E2E8F0",
  },
  activeCategory: { borderColor: "#FF6A6A", backgroundColor: "#FFF5F5" },
  chipText: { fontSize: 11, marginTop: 6, fontWeight: "500" },
  mateList: { flexDirection: "row", flexWrap: "wrap" },
  mateChip: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: "#E2E8F0",
    marginRight: 8,
    marginBottom: 8,
  },
  activeMate: { backgroundColor: "#4F46E5" },
  paidByChip: {
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 25,
    borderWidth: 2,
    borderColor: "#E2E8F0",
    backgroundColor: "#fff",
    marginRight: 10,
  },
  activePaidBy: { borderColor: "#FF6A6A" },
  addBtn: {
    backgroundColor: "#FF6A6A",
    padding: 18,
    borderRadius: 15,
    marginTop: 30,
    alignItems: "center",
  },
  addBtnText: { color: "#fff", fontSize: 18, fontWeight: "bold" },

  // Expense cards
  expenseCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginVertical: 8,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  expenseText: { fontSize: 16 },
  editBtn: {
    backgroundColor: "#6A8DFF",
    padding: 8,
    borderRadius: 8,
    marginRight: 5,
  },
  deleteBtn: { backgroundColor: "#FF6A6A", padding: 8, borderRadius: 8 },
  actionText: { color: "#fff", fontWeight: "600" },

  // Modals
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: {
    backgroundColor: "#fff",
    padding: 25,
    borderRadius: 15,
    width: "85%",
  },
  modalTitle: { fontSize: 20, fontWeight: "bold", textAlign: "center" },
  modalBtn: {
    flex: 1,
    marginHorizontal: 5,
    backgroundColor: "#FF6A6A",
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
  backBtnText: {
    color: "#fff",
    fontWeight: "bold",
    fontSize: 16,
  },
});
