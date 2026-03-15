import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { auth, db } from "../../../firebase";
import { doc, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { SafeAreaView } from "react-native-safe-area-context";

export default function Profile() {
  const router = useRouter();
  const [userData, setUserData] = useState<any>(null);
  const [houseName, setHouseName] = useState("");
  const [currency, setCurrency] = useState("$"); // default $
  const [editingHouse, setEditingHouse] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(false);

  const uid = auth.currentUser?.uid;

  // Fetch user and house data
  useEffect(() => {
    const fetchData = async () => {
      if (!uid) return;
      const userSnap = await getDoc(doc(db, "users", uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        setUserData(data);

        if (data.houseId) {
          const houseSnap = await getDoc(doc(db, "houses", data.houseId));
          if (houseSnap.exists()) {
            const houseData = houseSnap.data();
            setHouseName(houseData.name);
            setCurrency(houseData.currency || "$");
          }
        }
      }
    };
    fetchData();
  }, [uid]);

  // Update house name
  const saveHouseName = async () => {
    if (!houseName.trim())
      return Alert.alert("Error", "House name cannot be empty");
    try {
      await updateDoc(doc(db, "houses", userData.houseId), { name: houseName });
      setEditingHouse(false);
      Alert.alert("Success", "House name updated!");
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to update house name");
    }
  };

  // Update currency
  const saveCurrency = async () => {
    if (!currency.trim())
      return Alert.alert("Error", "Currency cannot be empty");
    try {
      await updateDoc(doc(db, "houses", userData.houseId), { currency });
      setEditingCurrency(false);
      Alert.alert("Success", "Currency updated!");
    } catch (error) {
      console.log(error);
      Alert.alert("Error", "Failed to update currency");
    }
  };

  // Logout
  const handleLogout = async () => {
    await auth.signOut();
    router.replace("/login");
  };

  if (!userData) return null;

  const isAdmin = userData.role === "admin";

  return (
         <SafeAreaView style={{ flex: 1, backgroundColor: "#fff" }}>
    
      <Text style={styles.header}>Profile</Text>

      <View style={styles.card}>
        <Text style={styles.label}>Name</Text>
        <Text style={styles.value}>{userData.name}</Text>

        <Text style={styles.label}>Email</Text>
        <Text style={styles.value}>{userData.email}</Text>

        <Text style={styles.value}>
          {userData?.role ? userData.role.toUpperCase() : "N/A"}
        </Text>

        {isAdmin && (
          <>
            {/* House Name */}
            <Text style={[styles.label, { marginTop: 20 }]}>House Name</Text>
            {editingHouse ? (
              <>
                <TextInput
                  style={styles.input}
                  value={houseName}
                  onChangeText={setHouseName}
                />
                <TouchableOpacity
                  style={styles.saveBtn}
                  onPress={saveHouseName}
                >
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.value}>{houseName}</Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditingHouse(true)}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
              </>
            )}

            {/* Currency */}
            <Text style={[styles.label, { marginTop: 20 }]}>Currency</Text>
            {editingCurrency ? (
              <>
                <TextInput
                  style={styles.input}
                  value={currency}
                  onChangeText={setCurrency}
                />
                <TouchableOpacity style={styles.saveBtn} onPress={saveCurrency}>
                  <Text style={styles.saveText}>Save</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text style={styles.value}>{currency}</Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditingCurrency(true)}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
              </>
            )}
          </>
        )}

        <TouchableOpacity style={styles.logoutBtn} onPress={handleLogout}>
          <Text style={styles.logoutText}>Logout</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },
  header: {
    fontSize: 32,
    fontWeight: "bold",
    color: "black",
    marginBottom: 20,
  },
  card: {
    backgroundColor: "white",
    borderRadius: 16,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.1,
    shadowRadius: 10,
    elevation: 5,
  },
  label: { fontSize: 14, color: "#777", marginTop: 10 },
  value: { fontSize: 18, fontWeight: "600", color: "#333" },
  input: {
    borderWidth: 1,
    borderColor: "#ccc",
    borderRadius: 8,
    padding: 10,
    marginTop: 5,
    fontSize: 16,
    color: "#333",
  },
  editBtn: {
    marginTop: 10,
    backgroundColor: "#FF6A6A",
    padding: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  editText: { color: "white", fontWeight: "bold" },
  saveBtn: {
    marginTop: 10,
    backgroundColor: "#FF6A6A",
    padding: 10,
    borderRadius: 8,
    alignSelf: "flex-start",
  },
  saveText: { color: "white", fontWeight: "bold" },
  logoutBtn: {
    marginTop: 30,
    backgroundColor: "#FF6A6A",
    padding: 15,
    borderRadius: 12,
    alignItems: "center",
  },
  logoutText: { color: "white", fontSize: 16, fontWeight: "bold" },
});
