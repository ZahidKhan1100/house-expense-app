import { useState } from "react";
import { View, StyleSheet, Dimensions, ScrollView } from "react-native";
import { TextInput, Button, Text, Title } from "react-native-paper";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { login } from "../../../src/services/authService";
import AsyncStorage from "@react-native-async-storage/async-storage";

const { width, height } = Dimensions.get("window");

export default function Login() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleLogin = async () => {
    setError("");
    setLoading(true);

    try {
      const data = await login({ email, password });

      // Save token or user info if needed
      // e.g., AsyncStorage.setItem("token", data.token);

      await AsyncStorage.setItem("token", data.token);
      await AsyncStorage.setItem("user", JSON.stringify(data.user));

      // Check user status
      if (data.user.status === "pending") {
        router.replace("/pending");
      } else {
        router.replace("/(tabs)/dashboard");
      }
    } catch (err: any) {
      console.error(err);
      setError(err.message || "Failed to login. Check your credentials!");
    } finally {
      setLoading(false);
    }
  };

  return (
    <LinearGradient
      colors={["#FF6A6A", "#FFB88C"]}
      style={styles.gradient}
      start={{ x: 0, y: 0 }}
      end={{ x: 1, y: 1 }}
    >
      <ScrollView contentContainerStyle={styles.container}>
        <Text style={styles.title}>Welcome Back!</Text>
        <Text style={styles.subtitle}>
          Log in to continue managing your house
        </Text>

        {/* Inputs */}
        <TextInput
          label="Email"
          value={email}
          onChangeText={setEmail}
          style={styles.input}
          mode="outlined"
          outlineColor="rgba(255,255,255,0.6)"
          activeOutlineColor="#fff"
          placeholderTextColor="#fff"
        />

        <TextInput
          label="Password"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          style={styles.input}
          mode="outlined"
          outlineColor="rgba(255,255,255,0.6)"
          activeOutlineColor="#fff"
          placeholderTextColor="#fff"
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {/* Login Button */}
        <Button
          mode="contained"
          onPress={handleLogin}
          loading={loading}
          disabled={loading}
          style={styles.button}
          contentStyle={styles.buttonContent}
          labelStyle={{ color: "#FF6A6A", fontWeight: "bold", fontSize: 16 }}
        >
          Login
        </Button>

        {/* Signup Button */}
        <Button
          onPress={() => router.push("/signup")}
          textColor="#000"
          style={{ marginTop: 10 }}
        >
          Create Account
        </Button>
      </ScrollView>

      <View style={styles.circleTop} />
      <View style={styles.circleBottom} />
    </LinearGradient>
  );
}

const styles = StyleSheet.create({
  gradient: { flex: 1, width, height },
  container: { flexGrow: 1, justifyContent: "center", padding: 25 },
  title: { fontSize: 36, fontWeight: "bold", color: "#fff", marginBottom: 8 },
  subtitle: { color: "rgba(255,255,255,0.9)", marginBottom: 25 },
  input: { marginBottom: 15, backgroundColor: "transparent", color: "#fff" },
  button: { borderRadius: 12, marginTop: 10 },
  buttonContent: { backgroundColor: "#fff", paddingVertical: 8 },
  error: { color: "#FFD2D2", marginBottom: 10, textAlign: "center" },
  circleTop: {
    position: "absolute",
    width: 200,
    height: 200,
    backgroundColor: "rgba(255,255,255,0.15)",
    borderRadius: 100,
    top: -50,
    left: -50,
  },
  circleBottom: {
    position: "absolute",
    width: 300,
    height: 300,
    backgroundColor: "rgba(255,255,255,0.1)",
    borderRadius: 150,
    bottom: -100,
    right: -100,
  },
});
