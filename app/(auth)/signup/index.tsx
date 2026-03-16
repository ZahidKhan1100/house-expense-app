import { useState } from "react";
import { ScrollView, StyleSheet, Dimensions } from "react-native";
import { TextInput, Button, Text, Title } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import * as SecureStore from "expo-secure-store";

import { signup } from "../../../src/services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width } = Dimensions.get("window");

export default function Signup() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [houseCode, setHouseCode] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSignup = async () => {
    setError("");
    if (!name || !email || !password) {
      setError("Please fill all fields!");
      return;
    }

    setLoading(true);

    try {
      const payload: any = { name, email, password };
      if (houseCode.trim()) payload.house_code = houseCode.trim();

      // Call signup API
      const data = await signup(payload);

      // --- Case 1: Join request pending ---
      if (houseCode.trim() && !data.token) {
        await AsyncStorage.setItem(
          "user",
          JSON.stringify(data.user || { name, email }),
        );
        router.replace("/pending");
        return;
      }

      // --- Case 2: House created, token returned ---
      if (data.token) {
        await AsyncStorage.setItem("token", data.token);

        // Store user + house info
        const userData = {
          id: data.house.admin_id,
          name: name,
          email,
        };
        await AsyncStorage.setItem("user", JSON.stringify(userData));

        router.replace("/(tabs)/dashboard");
        return;
      }

      setError("Signup failed. Please try again.");
    } catch (err: any) {
      console.error("🔥 SIGNUP ERROR:", err);
      setError(err.message || "Signup failed");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient colors={["#FF6A6A", "#FFB88C"]} style={styles.gradient}>
      <ScrollView
        contentContainerStyle={styles.container}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.title}>Create Account</Text>
        <Text style={styles.subtitle}>
          Start tracking expenses with your mates
        </Text>

        <TextInput
          label="Full Name"
          value={name}
          onChangeText={setName}
          style={styles.input}
          mode="outlined"
        />
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          mode="outlined"
          keyboardType="email-address"
          autoCapitalize="none"
        />
        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          style={styles.input}
          mode="outlined"
          secureTextEntry
        />
        <TextInput
          label="House Code (optional)"
          value={houseCode}
          onChangeText={setHouseCode}
          style={styles.input}
          mode="outlined"
          autoCapitalize="characters"
          placeholder="Leave empty to create new"
        />

        {error ? <Text style={styles.errorText}>{error}</Text> : null}

        <Button
          mode="contained"
          onPress={handleSignup}
          loading={loading}
          style={styles.button}
        >
          {houseCode ? "Request to Join House" : "Create House"}
        </Button>
      </ScrollView>
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1 },
  container: { flexGrow: 1, justifyContent: "center", padding: 25 },
  title: { fontSize: 32, fontWeight: "bold", color: "#fff" },
  subtitle: { color: "#fff", marginBottom: 25, opacity: 0.9 },
  input: { marginBottom: 12, backgroundColor: "rgba(255,255,255,0.1)" },
  button: { borderRadius: 8, paddingVertical: 5, marginTop: 10 },
  errorText: {
    color: "#800000",
    backgroundColor: "#FFC0C0",
    padding: 10,
    borderRadius: 5,
    marginBottom: 10,
    textAlign: "center",
  },
});
