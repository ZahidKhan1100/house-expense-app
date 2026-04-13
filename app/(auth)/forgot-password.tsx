import React, { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Dimensions,
  ScrollView,
  Platform,
  Animated,
  Easing,
  TouchableOpacity,
  KeyboardAvoidingView,
  StatusBar,
  TextInput as RNTextInput,
} from "react-native";
import { TextInput, Text, ActivityIndicator } from "react-native-paper";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { FontAwesome5 } from "@expo/vector-icons";
import { apiClient } from "../../src/utils/apiClient";

const { width } = Dimensions.get("window");

export default function ForgotPassword() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const colors = {
    primary: "#FF6A6A",
    primaryLight: "#FF8E8E",
    accent: "#E15555",
    text: "#1E293B",
    bgDark: "#0F172A",
  };

  // --- ANIMATIONS ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(40)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 800,
        useNativeDriver: true,
      }),
      Animated.spring(slideAnim, {
        toValue: 0,
        tension: 20,
        friction: 8,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 4000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const floatingY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -30],
  });

  const handleSend = async () => {
    if (!email) {
      setError("Please enter your email address");
      return;
    }
    setError("");
    setLoading(true);
    try {
      await apiClient("/forgot-password", "POST", { email });
      // Redirect or show success (You could also use a custom modal here)
      router.back();
    } catch (err: any) {
      setError(err.message || "Failed to send reset link");
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* FULL SCREEN GRADIENT */}
      <LinearGradient
        colors={[colors.primaryLight, colors.primary, colors.bgDark]}
        style={StyleSheet.absoluteFill}
      />

      {/* BACKGROUND ORBS */}
      <Animated.View
        style={[
          styles.orb,
          styles.orb1,
          { transform: [{ translateY: floatingY }] },
        ]}
      />
      <Animated.View
        style={[
          styles.orb,
          styles.orb2,
          { transform: [{ translateY: Animated.multiply(floatingY, -1.2) }] },
        ]}
      />

      <SafeAreaView style={{ flex: 1 }} edges={["left", "right"]}>
        <KeyboardAvoidingView
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          style={{ flex: 1 }}
        >
          {/* Back Button */}
          <TouchableOpacity
            onPress={() => router.back()}
            style={[styles.backBtn, { marginTop: insets.top + 10 }]}
          >
            <FontAwesome5 name="arrow-left" size={18} color="#fff" />
          </TouchableOpacity>

          <ScrollView
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            <Animated.View
              style={[
                styles.glassCard,
                { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
              ]}
            >
              <BlurView
                intensity={Platform.OS === "ios" ? 60 : 90}
                tint="light"
                style={styles.blurWrap}
              >
                <View style={styles.headerArea}>
                  <View style={styles.iconCircle}>
                    <FontAwesome5 name="key" size={30} color={colors.primary} />
                  </View>
                  <Text style={styles.titleText}>Reset Password</Text>
                  <Text style={styles.subtitleText}>
                    Enter your email and we'll send you instructions to reset
                    your password.
                  </Text>
                </View>

                <View style={styles.form}>
                  <TextInput
                    label="Email Address"
                    mode="flat"
                    textColor={colors.text}
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor={colors.primary}
                    autoCapitalize="none"
                    keyboardType="email-address"
                    value={email}
                    onChangeText={setEmail}
                    left={
                      <TextInput.Icon
                        icon="email-outline"
                        color={colors.primary}
                      />
                    }
                  />

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity
                    onPress={handleSend}
                    disabled={loading}
                    style={styles.mainBtnWrapper}
                  >
                    <LinearGradient
                      colors={[colors.primary, colors.accent]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={styles.mainBtn}
                    >
                      {loading ? (
                        <ActivityIndicator color="#fff" />
                      ) : (
                        <Text style={styles.btnLabel}>Send Reset Link</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>

                  <TouchableOpacity
                    onPress={() => router.back()}
                    style={styles.cancelBtn}
                  >
                    <Text style={styles.cancelText}>Back to Sign In</Text>
                  </TouchableOpacity>
                </View>
              </BlurView>
            </Animated.View>
          </ScrollView>
        </KeyboardAvoidingView>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#0F172A" },
  scrollContent: { flexGrow: 1, justifyContent: "center", padding: 22 },
  orb: {
    position: "absolute",
    borderRadius: 1000,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  orb1: { width: width * 0.8, height: width * 0.8, top: -100, right: -80 },
  orb2: { width: width * 1.0, height: width * 1.0, bottom: -150, left: -120 },
  backBtn: {
    position: "absolute",
    left: 22,
    zIndex: 10,
    width: 45,
    height: 45,
    borderRadius: 15,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.3)",
  },
  glassCard: {
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.2)",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.4)",
    elevation: 20,
    shadowColor: "#000",
    shadowOpacity: 0.15,
    shadowRadius: 30,
  },
  blurWrap: { padding: 25, paddingTop: 40 },
  headerArea: { marginBottom: 30, alignItems: "center" },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    elevation: 10,
  },
  titleText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: -1,
    textAlign: "center",
  },
  subtitleText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
    textAlign: "center",
    opacity: 0.8,
    marginTop: 8,
    lineHeight: 20,
  },
  form: { gap: 15 },
  input: {
    backgroundColor: "rgba(255,255,255,0.7)",
    height: 60,
    borderRadius: 15,
    overflow: "hidden",
  },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  mainBtnWrapper: { borderRadius: 20, overflow: "hidden", marginTop: 10 },
  mainBtn: { height: 60, justifyContent: "center", alignItems: "center" },
  btnLabel: { fontSize: 18, fontWeight: "900", color: "#fff" },
  cancelBtn: { marginTop: 10, alignItems: "center" },
  cancelText: { color: "#475569", fontSize: 15, fontWeight: "700" },
});
