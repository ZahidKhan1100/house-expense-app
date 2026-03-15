import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  TouchableOpacity,
  Alert,
  TextInput,
  Modal,
  Animated,
  Platform,
} from "react-native";
import { auth, db } from "../../../firebase";
import {
  doc,
  getDoc,
  getDocs,
  updateDoc,
  deleteDoc,
  collection,
} from "firebase/firestore";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import { useBottomTabBarHeight } from '@react-navigation/bottom-tabs';

export default function Mates() {
  const [mates, setMates] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [houseId, setHouseId] = useState("");
  const [modalVisible, setModalVisible] = useState(false);
  const [selectedMate, setSelectedMate] = useState<any>(null);
  const [newName, setNewName] = useState("");

  const [fadeAnim] = useState(new Animated.Value(1));
  const insets = useSafeAreaInsets();
  const tabBarHeight = useBottomTabBarHeight();

  useEffect(() => {
    const fetchMates = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (!userSnap.exists()) return;

      const data = userSnap.data();
      setIsAdmin(data.role === "admin");
      if (!data.houseId) return;
      setHouseId(data.houseId);

      const houseSnap = await getDoc(doc(db, "houses", data.houseId));
      if (!houseSnap.exists()) return;

      const mateIds: string[] = houseSnap.data()?.mates || [];
      const mateList: any[] = [];

      // Load approved mates
      for (const mateUid of mateIds) {
        const mateSnap = await getDoc(doc(db, "users", mateUid));
        if (mateSnap.exists()) {
          mateList.push({ id: mateUid, pending: false, ...mateSnap.data() });
        }
      }

      // Load pending join requests (filter out already approved users)
      const joinReqSnap = await getDocs(
        collection(db, "houses", data.houseId, "joinRequests")
      );
      joinReqSnap.forEach((docSnap) => {
        const d = docSnap.data();
        if (!mateList.some((m) => m.id === d.userId)) {
          mateList.push({
            id: d.userId,
            pending: true,
            name: d.name,
            email: d.email,
          });
        }
      });

      // Sort: pending first
      mateList.sort((a, b) => (a.pending === b.pending ? 0 : a.pending ? -1 : 1));

      setMates(mateList);
    };

    fetchMates();
  }, []);

  // Approve pending mate
  const approveMate = async (mate: any) => {
    try {
      const houseRef = doc(db, "houses", houseId);
      const houseSnap = await getDoc(houseRef);

      const updatedMates = [...(houseSnap.data()?.mates || []), mate.id];
      await updateDoc(houseRef, { mates: updatedMates });

      const userRef = doc(db, "users", mate.id);
      await updateDoc(userRef, {
        role: "mate",
        status: "approved",
        houseId,
      });

      // Delete join request
      await deleteDoc(doc(db, "houses", houseId, "joinRequests", mate.id));

      setMates((prev) =>
        prev.map((m) => (m.id === mate.id ? { ...m, pending: false } : m))
      );

      Alert.alert("Success", `${mate.name} has been approved!`);
    } catch (err) {
      console.log("Approve error:", err);
      Alert.alert("Error", "Failed to approve mate");
    }
  };

  // Reject pending mate
  const rejectMate = async (mate: any) => {
    try {
      await deleteDoc(doc(db, "houses", houseId, "joinRequests", mate.id));
      setMates((prev) => prev.filter((m) => m.id !== mate.id));
      Alert.alert("Success", `${mate.name} has been rejected`);
    } catch (err) {
      console.log("Reject error:", err);
      Alert.alert("Error", "Failed to reject mate");
    }
  };

  // Open modal to update mate name
  const openUpdateModal = (mate: any) => {
    setSelectedMate(mate);
    setNewName(mate.name);
    setModalVisible(true);
  };

  const updateMate = async () => {
    if (!newName.trim()) {
      Alert.alert("Error", "Name cannot be empty");
      return;
    }

    try {
      const mateRef = doc(db, "users", selectedMate.id);
      await updateDoc(mateRef, { name: newName });

      setMates((prev) =>
        prev.map((m) => (m.id === selectedMate.id ? { ...m, name: newName } : m))
      );

      setModalVisible(false);
      Alert.alert("Success", "Mate updated successfully");
    } catch (err) {
      console.log("Update error:", err);
      Alert.alert("Error", "Failed to update mate");
    }
  };

  // Delete mate (pending or approved)
  const deleteMate = async (mate: any) => {
    try {
      if (!mate.pending) {
        const houseRef = doc(db, "houses", houseId);
        const houseSnap = await getDoc(houseRef);
        const updatedMates = (houseSnap.data()?.mates || []).filter(
          (id: string) => id !== mate.id
        );
        await updateDoc(houseRef, { mates: updatedMates });
      }

      await deleteDoc(doc(db, "users", mate.id));

      // Animate removal
      Animated.timing(fadeAnim, {
        toValue: 0,
        duration: 300,
        useNativeDriver: true,
      }).start(() => {
        setMates((prev) => prev.filter((m) => m.id !== mate.id));
      });

      Alert.alert("Success", `${mate.name} removed successfully`);
    } catch (err) {
      console.log("Delete error:", err);
      Alert.alert("Error", "Failed to delete mate");
    }
  };

  // Render single mate
  const renderMate = ({ item }: { item: any }) => (
    <Animated.View
      style={[
        styles.mateCard,
        item.pending && styles.pendingCard,
        { opacity: fadeAnim },
      ]}
    >
      <View>
        <Text style={styles.mateName}>{item.name}</Text>
        <Text style={styles.mateEmail}>{item.email}</Text>
        {item.pending && <Text style={styles.pendingBadge}>Pending Approval</Text>}
      </View>

      {isAdmin && (
        <View style={styles.adminActions}>
          {item.pending ? (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#4CAF50" }]}
                onPress={() => approveMate(item)}
              >
                <Text style={styles.actionText}>Approve</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#FF3D00" }]}
                onPress={() => rejectMate(item)}
              >
                <Text style={styles.actionText}>Reject</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#6A8DFF" }]}
                onPress={() => openUpdateModal(item)}
              >
                <Text style={styles.actionText}>Update</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: "#FF3D00" }]}
                onPress={() => deleteMate(item)}
              >
                <Text style={styles.actionText}>Delete</Text>
              </TouchableOpacity>
            </>
          )}
        </View>
      )}
    </Animated.View>
  );


// ... inside your Mates function ...

return (
  <SafeAreaView style={styles.container}>
    {/* Inner View helps anchor flex layout on Android/Web */}
    <View style={styles.flexWrapper}>
      <Text style={styles.title}>House Mates</Text>
      
      {mates.length === 0 ? (
        <View style={styles.emptyContainer}>
          <Text style={styles.emptyText}>No mates added yet</Text>
        </View>
      ) : (
        <FlatList
          data={mates}
          keyExtractor={(item) => item.id}
          renderItem={renderMate}
          // Forces the list to fill the screen space properly
          style={styles.flatList}
          // Dynamic padding so cards aren't hidden by the floating Tab Bar
          contentContainerStyle={[
            styles.listContent,
            { paddingBottom: tabBarHeight + 40 }
          ]}
          // Improves performance and ensures scrollability
          showsVerticalScrollIndicator={false}
        />
      )}
    </View>

    {/* Update Modal */}
    <Modal visible={modalVisible} transparent animationType="fade">
      <View style={styles.modalOverlay}>
        <View style={styles.modalContent}>
          <Text style={styles.modalTitle}>Update Mate Name</Text>
          <TextInput
            style={styles.modalInput}
            value={newName}
            onChangeText={setNewName}
            autoFocus
          />
          <View style={styles.modalBtns}>
            <TouchableOpacity style={styles.modalBtn} onPress={updateMate}>
              <Text style={styles.actionText}>Save</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.modalBtn, { backgroundColor: "#CBD5E1" }]}
              onPress={() => setModalVisible(false)}
            >
              <Text style={styles.actionText}>Cancel</Text>
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  </SafeAreaView>
);
}

const styles = StyleSheet.create({
container: {
    flex: 1, 
    backgroundColor: "#F5F5F5",
  },
  flexWrapper: {
    flex: 1, // This is the secret to making FlatList scroll
  },
  flatList: {
    flex: 1, 
  },
  listContent: {
    paddingHorizontal: 20,
    paddingTop: 10,
  },
  title: {
    fontSize: 28,
    fontWeight: "bold",
    color: "#1E293B",
    textAlign: "center",
    marginVertical: 20,
  },
  emptyContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
  },
  emptyText: {
    fontSize: 16,
    color: "#64748B",
  },
  mateCard: {
    backgroundColor: "#fff",
    padding: 15,
    borderRadius: 12,
    marginBottom: 15,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowOffset: { width: 0, height: 3 },
    shadowRadius: 5,
    elevation: 2,
  },
  pendingCard: {
    borderWidth: 1,
    borderColor: "#FFB74D",
    backgroundColor: "#FFF8E1",
  },
  mateName: { fontSize: 18, fontWeight: "600" },
  mateEmail: { fontSize: 14, color: "#666", marginBottom: 5 },
  pendingBadge: { color: "#FF6A00", fontWeight: "bold" },
  adminActions: { flexDirection: "row", justifyContent: "flex-end", marginTop: 5 },
  actionBtn: { padding: 8, borderRadius: 8, marginLeft: 5 },
  actionText: { color: "#fff", fontWeight: "600" },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "center",
    alignItems: "center",
  },
  modalContent: { backgroundColor: "#fff", width: "80%", padding: 20, borderRadius: 12 },
  modalTitle: { fontSize: 20, fontWeight: "bold", marginBottom: 15 },
  modalInput: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 12,
    padding: 10,
    marginBottom: 20,
  },
  modalBtns: { flexDirection: "row", justifyContent: "space-between" },
  modalBtn: { backgroundColor: "#6A8DFF", padding: 10, borderRadius: 12, flex: 1, marginHorizontal: 5 },
});