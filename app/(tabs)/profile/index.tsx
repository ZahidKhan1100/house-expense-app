import React, { useState, useEffect } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Switch,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../theme/ThemeContext";
import { apiClient } from "../../../src/utils/apiClient"; // your API helper

export default function Profile() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [houseName, setHouseName] = useState("");
  const [currency, setCurrency] = useState("$");
  const [editingHouse, setEditingHouse] = useState(false);
  const [editingCurrency, setEditingCurrency] = useState(false);

  // --- AsyncStorage helper ---
  const getAuthData = async () => {
    const userJson = await AsyncStorage.getItem("user");
    const token = await AsyncStorage.getItem("token");
    const user = userJson ? JSON.parse(userJson) : null;
    return { user, token };
  };

  // --- Fetch profile + house info ---
  const fetchProfile = async () => {
    setLoading(true);
    try {
      const { token } = await getAuthData();
      if (!token) {
        router.replace("/login");
        return;
      }

      const profile = await apiClient("/profile", "GET", undefined, token);
      setUserData(profile);

      if (profile.house) {
        setHouseName(profile.house.name);
        setCurrency(profile.house.currency || "$");
      }
    } catch (err: any) {
      console.error("Profile fetch error:", err);
      alert(err.message || "Failed to load profile");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // --- Save updates ---
  const saveHouseName = async () => {
    if (!houseName.trim()) return alert("House name cannot be empty");

    try {
      const { token } = await getAuthData();
      await apiClient(
        `/houses/${userData.house.id}`,
        "PUT",
        { name: houseName },
        token,
      );
      setEditingHouse(false);
      alert("House name updated!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to update house name");
    }
  };

  const saveCurrency = async () => {
    if (!currency.trim()) return alert("Currency cannot be empty");

    try {
      const { token } = await getAuthData();
      await apiClient(
        `/houses/${userData.house.id}`,
        "PUT",
        { currency },
        token,
      );
      setEditingCurrency(false);
      alert("Currency updated!");
    } catch (err: any) {
      console.error(err);
      alert("Failed to update currency");
    }
  };

  const handleLogout = async () => {
    await AsyncStorage.multiRemove(["user", "token"]);
    router.replace("/login");
  };

  if (loading || !userData)
    return (
      <ActivityIndicator style={{ flex: 1 }} size="large" color="#FF6A6A" />
    );

  const isAdmin = userData.role === "admin";
  const styles = createStyles(isDark);

  return (
    <SafeAreaView style={styles.container}>
      {/* HEADER */}
      <LinearGradient colors={["#FF6A6A", "#FF8E8E"]} style={styles.header}>
        <View style={styles.avatar}>
          <Text style={styles.avatarText}>
            {userData.name.charAt(0).toUpperCase()}
          </Text>
        </View>
        <Text style={styles.name}>{userData.name}</Text>
        <Text style={styles.email}>{userData.email}</Text>
      </LinearGradient>

      {/* ACCOUNT CARD */}
      <View style={styles.card}>
        <Text style={styles.sectionTitle}>Account</Text>

        <View style={styles.row}>
          <Text style={styles.label}>Role</Text>
          <Text style={styles.value}>{userData.role.toUpperCase()}</Text>
        </View>

        <View style={styles.row}>
          <Text style={styles.label}>Dark Mode</Text>
          <Switch value={isDark} onValueChange={toggleTheme} />
        </View>

        {isAdmin && (
          <>
            <Text style={styles.sectionTitle}>House</Text>

            <Text style={styles.label}>House Name</Text>
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
              <View style={styles.row}>
                <Text style={styles.value}>{houseName}</Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditingHouse(true)}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
              </View>
            )}

            <Text style={styles.label}>Currency</Text>
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
              <View style={styles.row}>
                <Text style={styles.value}>{currency}</Text>
                <TouchableOpacity
                  style={styles.editBtn}
                  onPress={() => setEditingCurrency(true)}
                >
                  <Text style={styles.editText}>Edit</Text>
                </TouchableOpacity>
              </View>
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

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: { flex: 1, backgroundColor: isDark ? "#121212" : "#F5F7FB" },
    header: {
      alignItems: "center",
      paddingVertical: 40,
      borderBottomLeftRadius: 30,
      borderBottomRightRadius: 30,
    },
    avatar: {
      width: 90,
      height: 90,
      borderRadius: 45,
      backgroundColor: "white",
      justifyContent: "center",
      alignItems: "center",
      marginBottom: 10,
    },
    avatarText: { fontSize: 36, fontWeight: "bold", color: "#FF6A6A" },
    name: { fontSize: 22, fontWeight: "bold", color: "white" },
    email: { color: "white", opacity: 0.9, marginTop: 4 },
    card: {
      margin: 20,
      backgroundColor: isDark ? "#1E1E1E" : "white",
      borderRadius: 20,
      padding: 20,
      shadowColor: "#000",
      shadowOpacity: 0.1,
      shadowRadius: 10,
      elevation: 5,
    },
    sectionTitle: {
      fontSize: 16,
      fontWeight: "700",
      marginTop: 10,
      marginBottom: 10,
      color: isDark ? "#fff" : "#333",
    },
    row: {
      flexDirection: "row",
      justifyContent: "space-between",
      alignItems: "center",
      marginBottom: 12,
    },
    label: { fontSize: 14, color: isDark ? "#aaa" : "#777" },
    value: { fontSize: 16, fontWeight: "600", color: isDark ? "#fff" : "#333" },
    input: {
      borderWidth: 1,
      borderColor: "#ccc",
      borderRadius: 10,
      padding: 12,
      marginTop: 6,
      color: isDark ? "#fff" : "#333",
    },
    editBtn: {
      backgroundColor: "#FF6A6A",
      paddingVertical: 6,
      paddingHorizontal: 14,
      borderRadius: 8,
    },
    editText: { color: "white", fontWeight: "bold" },
    saveBtn: {
      backgroundColor: "#FF6A6A",
      padding: 12,
      borderRadius: 10,
      marginTop: 10,
      alignItems: "center",
    },
    saveText: { color: "white", fontWeight: "bold" },
    logoutBtn: {
      marginTop: 25,
      backgroundColor: "#FF6A6A",
      padding: 15,
      borderRadius: 12,
      alignItems: "center",
    },
    logoutText: { color: "white", fontSize: 16, fontWeight: "bold" },
  });
