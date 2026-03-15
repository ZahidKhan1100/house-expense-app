import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { db, auth } from "../../firebase";
import {
  doc,
  getDoc,
  updateDoc,
  getDocs,
  collection,
  query,
  where,
} from "firebase/firestore";
import { useRouter } from "expo-router";
import { SafeAreaView } from "react-native-safe-area-context";

export default function AddMate() {
  const [mates, setMates] = useState<any[]>([]);
  const [userData, setUserData] = useState<any>(null);
  const [houseCode, setHouseCode] = useState<string>("");

  const router = useRouter();

  useEffect(() => {
    fetchUserData();
  }, []);

  // Fetch admin data and their house mates
  const fetchUserData = async () => {
    const user = auth.currentUser;
    if (!user) return;

    const userRef = doc(db, "users", user.uid);
    const userSnap = await getDoc(userRef);

    if (!userSnap.exists()) return;

    const data = userSnap.data();
    setUserData(data);

    if (data.role !== "admin") {
      Alert.alert("Permission denied", "Only admin can manage mates");
      return;
    }

    // Fetch house info
    const houseRef = doc(db, "houses", data.houseId);
    const houseSnap = await getDoc(houseRef);
    if (houseSnap.exists()) {
      const houseData = houseSnap.data();
      setHouseCode(houseData.code || "");
      const mateIds: string[] = houseData.mates || [];

      // Fetch mate names/emails
      const mateDataList: any[] = [];
      for (let uid of mateIds) {
        const mateRef = doc(db, "users", uid);
        const mateSnap = await getDoc(mateRef);
        if (mateSnap.exists()) {
          mateDataList.push({ uid, ...mateSnap.data() });
        }
      }

      setMates(mateDataList);
    }
  };

  // Remove mate from house
  const removeMate = async (mateUid: string) => {
    if (!userData) return;
    try {
      const houseRef = doc(db, "houses", userData.houseId);
      await updateDoc(houseRef, {
        mates: mates.filter((m) => m.uid !== mateUid).map((m) => m.uid),
      });
      setMates(mates.filter((m) => m.uid !== mateUid));
      Alert.alert("Success", "Mate removed from the house");
    } catch (err: any) {
      console.error(err);
      Alert.alert("Error", "Could not remove mate");
    }
  };

  const renderMate = ({ item }: { item: any }) => (
    <View style={styles.mateRow}>
      <Text style={styles.mateText}>{item.name || item.email}</Text>
      <TouchableOpacity
        style={styles.removeBtn}
        onPress={() => removeMate(item.uid)}
      >
        <Text style={styles.removeText}>Remove</Text>
      </TouchableOpacity>
    </View>
  );

  return (
         <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
    
    <View style={styles.container}>
      <Text style={styles.title}>Manage Mates</Text>
      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.push("/(tabs)/dashboard")}
      >
        <Text style={styles.backBtnText}>← Back to Dashboard</Text>
      </TouchableOpacity>

      {mates.length === 0 ? (
        <Text>No mates in your house yet.</Text>
      ) : (
        <FlatList
          data={mates}
          keyExtractor={(item) => item.uid}
          renderItem={renderMate}
        />
      )}

      <Text style={styles.info}>
        Share this house code to add new mates:{" "}
        <Text style={{ fontWeight: "bold" }}>{houseCode}</Text>
      </Text>
      <Text style={styles.note}>
        They can use this code while signing up to join your house.
      </Text>
    </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  title: { fontSize: 24, fontWeight: "bold", marginBottom: 15 },
  mateRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 12,
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    marginBottom: 10,
  },
  mateText: { fontSize: 16 },
  removeBtn: { backgroundColor: "#FF6A6A", padding: 6, borderRadius: 6 },
  removeText: { color: "#fff", fontWeight: "bold" },
  info: { marginTop: 20, fontSize: 16 },
  note: { fontSize: 14, color: "#666", marginTop: 5 },
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
