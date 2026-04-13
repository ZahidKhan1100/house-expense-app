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
  Image,
} from "react-native";
import { TextInput, Text, ActivityIndicator } from "react-native-paper";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import * as Google from "expo-auth-session/providers/google";
import * as AppleAuthentication from "expo-apple-authentication";
import * as WebBrowser from "expo-web-browser";
import AsyncStorage from "@react-native-async-storage/async-storage";
import {
  SafeAreaView,
  useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useKeyboardBottomPadding } from "../../../src/hooks/useKeyboardBottomPadding";
import {
  FontAwesome5,
  MaterialCommunityIcons,
  Ionicons,
} from "@expo/vector-icons";

import { login, socialLogin } from "../../../src/services/authService";
import { getGoogleIdTokenFromAuthResponse } from "../../../src/utils/googleAuthSession";

WebBrowser.maybeCompleteAuthSession();
const { width, height } = Dimensions.get("window");

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardScrollPad = useKeyboardBottomPadding(40);

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);

  // --- BRAND COLORS ---
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
        duration: 1000,
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

  // --- SOCIAL LOGIN (Google) ---
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest({
    expoClientId:
      "17026603435-ealfs4spvrgufc7sv7q9baq3hulu2hig.apps.googleusercontent.com",
    iosClientId:
      "17026603435-cmpmanevtpudrna3f43pf84umghf3pen.apps.googleusercontent.com",
    androidClientId:
      "17026603435-50nrfga3r3rs8dp36ai4m0vu861p6mqe.apps.googleusercontent.com",
    webClientId:
      "17026603435-i0ra3c5tq33449tuarsintt88gib9u85.apps.googleusercontent.com",
    selectAccount: true,
    useProxy: false,
  });

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = getGoogleIdTokenFromAuthResponse(response);
      if (idToken) handleOAuthLogin("google", idToken);
    } else if (response?.type === "error") {
      const p = response.params;
      const msg =
        p?.error_description ||
        p?.error ||
        "Google sign-in was cancelled or failed.";
      setError(msg);
    }
  }, [response]);

  // --- RESTORED ORIGINAL OAUTH LOGIC ---
  const handleOAuthLogin = async (
    provider: "google" | "apple",
    token: string,
  ) => {
    setLoading(true);
    setError("");
    try {
      const data = await socialLogin(provider, token);
      if (data?.token) {
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
        await AsyncStorage.setItem("active_mode", "house");

        if (!data.user?.house_id) {
          router.replace("/choose-house");
          return;
        }
        router.replace("/(tabs)/dashboard");
      }
    } catch (err: any) {
       setError(err.data.error || "Social login failed");
    } finally {
      setLoading(false);
    }
  };

  // --- RESTORED ORIGINAL LOGIN LOGIC ---
  const handleLogin = async () => {
    setError("");
    if (!email || !password) {
      setError("Enter your credentials to continue");
      return;
    }
    setLoading(true);
    try {
      const data = await login({ email, password });
      if (data?.token) {
        await AsyncStorage.setItem("token", data.token);
        await AsyncStorage.setItem("user", JSON.stringify(data.user));
        await AsyncStorage.setItem("active_mode", "house");

        if (!data.user.house_id) {
          router.replace("/choose-house");
          return;
        }
        router.replace("/(tabs)/dashboard");
      }
    } catch (err: any) {
      setError(err.message || "Login failed");
    } finally {
      setLoading(false);
    }
  };

  const handleAppleLogin = async () => {
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      if (credential.identityToken) {
        handleOAuthLogin("apple", credential.identityToken);
      } else {
        setError("Apple did not return a token. Try again.");
      }
    } catch (err: any) {
      if (err.code !== "ERR_CANCELED") {
        setError(err.message || "Apple sign-in failed");
      }
    }
  };

  return (
    <View style={styles.container}>
      <StatusBar
        barStyle="light-content"
        translucent
        backgroundColor="transparent"
      />

      {/* 1. FULL SCREEN GRADIENT */}
      <LinearGradient
        colors={[colors.primaryLight, colors.primary, colors.bgDark]}
        style={StyleSheet.absoluteFill}
      />

      {/* 2. BACKGROUND ORBS */}
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
          keyboardVerticalOffset={
            Platform.OS === "ios" ? Math.max(insets.top, 8) : 0
          }
        >
          <ScrollView
            contentContainerStyle={[
              styles.scrollContent,
              { paddingBottom: keyboardScrollPad },
            ]}
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
                  <View style={styles.logoCircle}>
                    <Image
                      source={require("../../../assets/images/icon.png")}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.titleText}>Welcome</Text>
                  <Text style={styles.subtitleText}>
                    Sign in to manage your space.
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
                    value={email}
                    onChangeText={setEmail}
                    left={
                      <TextInput.Icon
                        icon="email-outline"
                        color={colors.primary}
                      />
                    }
                  />

                  <TextInput
                    label="Password"
                    mode="flat"
                    secureTextEntry={secureText}
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor={colors.primary}
                    value={password}
                    onChangeText={setPassword}
                    left={
                      <TextInput.Icon
                        icon="lock-outline"
                        color={colors.primary}
                      />
                    }
                    right={
                      <TextInput.Icon
                        icon={secureText ? "eye-off" : "eye"}
                        onPress={() => setSecureText(!secureText)}
                        color="#94A3B8"
                      />
                    }
                  />

                  <TouchableOpacity
                    onPress={() => router.push("/(auth)/forgot-password")}
                    style={styles.forgotAction}
                  >
                    <Text style={styles.forgotText}>Forgot Password?</Text>
                  </TouchableOpacity>

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity
                    onPress={handleLogin}
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
                        <Text style={styles.btnLabel}>Sign In</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                <View style={styles.dividerBox}>
                  <View style={styles.line} />
                  <Text style={styles.dividerLabel}>OR SIGN IN WITH</Text>
                  <View style={styles.line} />
                </View>

                <View style={styles.socialGrid}>
                  <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={() => request && promptAsync()}
                  >
                    <FontAwesome5 name="google" size={20} color="#DB4437" />
                  </TouchableOpacity>
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      style={styles.socialBtn}
                      onPress={handleAppleLogin}
                    >
                      <FontAwesome5 name="apple" size={22} color="#000" />
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.socialBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={() => router.replace("/scan-qr")}
                  >
                    <Ionicons name="qr-code" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                <View style={styles.footerLinks}>
                  <Text style={styles.footerLabel}>New here?</Text>
                  <TouchableOpacity
                    onPress={() => router.replace("/(auth)/signup")}
                  >
                    <Text style={styles.signUpLink}> Create Account</Text>
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
  scrollContent: {
    flexGrow: 1,
    justifyContent: "center",
    padding: 22,
    paddingTop: 60,
  },
  orb: {
    position: "absolute",
    borderRadius: 1000,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  orb1: { width: width * 0.8, height: width * 0.8, top: -100, right: -80 },
  orb2: { width: width * 1.0, height: width * 1.0, bottom: -150, left: -120 },
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
  blurWrap: { padding: 25, paddingTop: 35 },
  headerArea: { marginBottom: 25, alignItems: "center" },
  logoCircle: {
    width: 90,
    height: 90,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 15,
    overflow: "hidden",
    elevation: 10,
  },
  logoImage: { width: "100%", height: "100%" },
  titleText: {
    fontSize: 36,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: -1.5,
  },
  subtitleText: {
    color: "#475569",
    fontSize: 14,
    fontWeight: "600",
    opacity: 0.8,
  },
  form: { gap: 12 },
  input: {
    backgroundColor: "rgba(255,255,255,0.7)",
    height: 60,
    borderRadius: 15,
    overflow: "hidden",
  },
  forgotAction: { alignSelf: "flex-end", paddingVertical: 5 },
  forgotText: { color: "#f70404", fontSize: 13, fontWeight: "700" },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  mainBtnWrapper: { borderRadius: 20, overflow: "hidden", marginTop: 10 },
  mainBtn: { height: 60, justifyContent: "center", alignItems: "center" },
  btnLabel: { fontSize: 18, fontWeight: "900", color: "#fff" },
  dividerBox: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 20,
  },
  line: { flex: 1, height: 1, backgroundColor: "rgba(0,0,0,0.06)" },
  dividerLabel: {
    marginHorizontal: 15,
    fontSize: 10,
    fontWeight: "800",
    color: "#64748B",
  },
  socialGrid: { flexDirection: "row", justifyContent: "center", gap: 15 },
  socialBtn: {
    width: 55,
    height: 55,
    borderRadius: 18,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
  },
  footerLinks: {
    marginTop: 25,
    flexDirection: "row",
    justifyContent: "center",
  },
  footerLabel: { color: "#475569", fontSize: 15 },
  signUpLink: { color: "#FF6A6A", fontWeight: "900", fontSize: 15 },
});
