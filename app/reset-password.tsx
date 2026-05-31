import { useLocalSearchParams, useRouter } from "expo-router";
import { useMemo, useState } from "react";
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Alert,
  ActivityIndicator,
} from "react-native";
import { apiClient } from "../src/utils/apiClient";

function oneParam(raw: unknown): string {
  if (typeof raw === "string") return raw;
  if (Array.isArray(raw) && typeof raw[0] === "string") return raw[0];
  return "";
}

export default function ResetPassword() {
  const router = useRouter();
  const params = useLocalSearchParams<{ token?: string | string[]; email?: string | string[] }>();
  const token = useMemo(() => oneParam(params.token), [params.token]);
  const email = useMemo(() => oneParam(params.email), [params.email]);

  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [submitting, setSubmitting] = useState(false);

  const handleReset = async () => {
    if (!token || !email) {
      Alert.alert(
        "Invalid link",
        "Open reset from your email link again or use Forgot password.",
      );
      return;
    }
    if (password !== confirm) {
      return Alert.alert("Error", "Passwords do not match");
    }
    if (password.length < 6) {
      return Alert.alert("Error", "Use at least 6 characters.");
    }

    setSubmitting(true);
    try {
      await apiClient("/reset-password", "POST", {
        token,
        email,
        password,
        password_confirmation: confirm,
      });

      Alert.alert("Success", "Password updated — sign in with your new password.", [
        {
          text: "OK",
          onPress: () => router.replace("/(auth)/login" as any),
        },
      ]);
    } catch (err: any) {
      Alert.alert("Error", err.message);
    } finally {
      setSubmitting(false);
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
        disabled={submitting}
        style={{
          backgroundColor: submitting ? "#ccc" : "#FF6A6A",
          padding: 15,
          marginTop: 20,
          borderRadius: 10,
          alignItems: "center",
          justifyContent: "center",
        }}
      >
        {submitting ? (
          <ActivityIndicator color="#fff" />
        ) : (
          <Text style={{ color: "#fff", textAlign: "center", fontWeight: "700" }}>
            Reset Password
          </Text>
        )}
      </TouchableOpacity>
    </View>
  );
}