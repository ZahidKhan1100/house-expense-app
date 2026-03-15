import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
} from "react-native";
import { auth, db } from "../../firebase";
import { doc, setDoc, serverTimestamp, getDoc, updateDoc } from "firebase/firestore";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";

export default function AddHouse() {
  const [houseName, setHouseName] = useState("");
  const router = useRouter();

  useEffect(() => {
    // Check if user already has a house
    const checkHouse = async () => {
      const user = auth.currentUser;
      if (!user) return;

      const userSnap = await getDoc(doc(db, "users", user.uid));
      if (userSnap.exists()) {
        const data = userSnap.data();
        if (data.houseId) {
          router.replace("/dashboard"); // Already has a house
        }
      }
    };

    checkHouse();
  }, []);

  const createHouse = async () => {
    const user = auth.currentUser;
    if (!user) return;

    if (!houseName.trim()) {
      Alert.alert("Error", "Please enter a house name");
      return;
    }

    try {
      const uid = user.uid;

      // Create house document with UID as ID
      const houseRef = doc(db, "houses", uid);
      await setDoc(houseRef, {
        adminId: uid,
        name: houseName,
        createdAt: serverTimestamp(),
        mates: [],
        expenses: [],
      });

      // Update user with houseId and role
      await updateDoc(doc(db, "users", uid), {
        houseId: uid,
        role: "admin",
        email: user.email,
      });

      router.replace("/dashboard");
    } catch (error) {
      console.log("Create house error:", error);
      Alert.alert("Failed to create house", "Try again!");
    }
  };

  return (
    <LinearGradient colors={["#FF6A6A", "#FFB88C"]} style={styles.container}>
      <Text style={styles.title}>Create Your House</Text>
      <TextInput
        placeholder="House Name"
        value={houseName}
        onChangeText={setHouseName}
        style={styles.input}
        placeholderTextColor="#FFF3EE"
      />
      <TouchableOpacity style={styles.button} onPress={createHouse}>
        <Text style={styles.buttonText}>Create House</Text>
      </TouchableOpacity>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, justifyContent: "center", alignItems: "center", padding: 20 },
  title: { fontSize: 28, fontWeight: "bold", color: "white", marginBottom: 40 },
  input: {
    width: "100%",
    borderWidth: 1,
    borderColor: "white",
    padding: 15,
    borderRadius: 12,
    marginBottom: 20,
    color: "white",
    fontSize: 16,
  },
  button: {
    width: "100%",
    padding: 15,
    borderRadius: 12,
    backgroundColor: "#FF1493",
    alignItems: "center",
  },
  buttonText: { color: "white", fontWeight: "bold", fontSize: 18 },
});