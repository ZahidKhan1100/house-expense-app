import { useLocalSearchParams } from "expo-router";
import { useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
} from "react-native";
import { apiClient } from "../src/utils/apiClient";

export default function ResetPassword() {
  const { token, email } = useLocalSearchParams();

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");

  const handleReset = async () => {
    if (password !== confirm) {
      return Alert.alert("Error", "Passwords do not match");
    }

    try {
      await apiClient("/reset-password", "POST", {
        token,
        email,
        password,
        password_confirmation: confirm,
      });

      Alert.alert("Success", "Password updated");
    } catch (err: any) {
      Alert.alert("Error", err.message);
    }
  };

  return (
    <View style={{ flex: 1, justifyContent: "center", padding: 20 }}>
      <Text style={{ fontSize: 24, fontWeight: "800" }}>
        Reset Password
      </Text>

      <TextInput
        placeholder="New password"
        secureTextEntry
        value={password}
        onChangeText={setPassword}
        style={{ borderWidth: 1, marginTop: 20, padding: 12 }}
      />

      <TextInput
        placeholder="Confirm password"
        secureTextEntry
        value={confirm}
        onChangeText={setConfirm}
        style={{ borderWidth: 1, marginTop: 10, padding: 12 }}
      />

      <TouchableOpacity
        onPress={handleReset}
        style={{
          backgroundColor: "#FF6A6A",
          padding: 15,
          marginTop: 20,
          borderRadius: 10,
        }}
      >
        <Text style={{ color: "#fff", textAlign: "center" }}>
          Reset Password
        </Text>
      </TouchableOpacity>
    </View>
  );
}