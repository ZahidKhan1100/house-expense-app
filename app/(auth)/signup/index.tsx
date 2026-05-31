import {
    FontAwesome5,
    Ionicons
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as AppleAuthentication from "expo-apple-authentication";
import * as Google from "expo-auth-session/providers/google";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef, useState } from "react";
import {
    Alert,
    Animated,
    Dimensions,
    Easing,
    Image,
    KeyboardAvoidingView,
    Platform,
    ScrollView,
    StatusBar,
    StyleSheet,
    TouchableOpacity,
    View,
} from "react-native";
import NetInfo from "@react-native-community/netinfo";
import { ActivityIndicator, Text, TextInput } from "react-native-paper";
import {
    SafeAreaView,
    useSafeAreaInsets,
} from "react-native-safe-area-context";
import { useKeyboardBottomPadding } from "../../../src/hooks/useKeyboardBottomPadding";
import { useGoogleOauthDebug } from "../../../src/hooks/useGoogleOauthDebug";

import { notifySessionTokenCommitted } from "../../../src/auth/sessionTokenBridge";
import { notifyStoredUserUpdated } from "../../../src/auth/userSessionBridge";
import {
    getGoogleIdTokenAuthRequestOptions,
    shouldUseGoogleAuthProxy,
} from "../../../src/config/googleAuth";
import { setGoogleOauthReturnHref } from "../../../src/utils/googleOauthReturnPath";
import { signup, socialLogin } from "../../../src/services/authService";
import { getGoogleIdTokenFromAuthResponse } from "../../../src/utils/googleAuthSession";
import { getApiErrorMessage } from "../../../src/utils/apiClient";
import {
  APPLE_SIGN_IN_STALL_HELP_MS,
  isAppleSignInUserCancellation,
} from "../../../src/utils/appleSignInError";
import {
  clearPendingHouseCode,
  peekPendingHouseCode,
} from "../../../src/utils/houseInviteLink";

const { width, height } = Dimensions.get("window");

export default function Signup() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const keyboardScrollPad = useKeyboardBottomPadding(48);

  const [form, setForm] = useState({
    name: "",
    email: "",
    password: "",
    house_code: "",
  });

  const [mode, setMode] = useState<"house" | "trip">("house");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [secureText, setSecureText] = useState(true);
  const [qrLoaded, setQrLoaded] = useState(false);
  const [appleAvailable, setAppleAvailable] = useState(false);
  const [appleSignInInProgress, setAppleSignInInProgress] = useState(false);
  const appleStallTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const appleDialogActiveRef = useRef(false);

  // --- BRAND COLORS ---
  const colors = {
    primary: "#FF6A6A",
    primaryLight: "#FF8E8E",
    accent: "#E15555",
    text: "#1E293B",
    bgDark: "#0F172A",
  };

  // ---------------- SAVE TOKEN ----------------
  const saveAuthData = async (token: string, user?: any) => {
    try {
      await AsyncStorage.setItem("token", token);
      if (user) {
        await AsyncStorage.setItem("user", JSON.stringify(user));
        notifyStoredUserUpdated();
      }
      notifySessionTokenCommitted(token);
    } catch (e) {
      console.log("Error saving auth:", e);
    }
  };

  // ---------------- CLEAR OLD TOKEN (ANDROID FIX) ----------------
  useEffect(() => {
    const clearOldAuth = async () => {
      await AsyncStorage.removeItem("token");
    };
    clearOldAuth();
  }, []);

  useEffect(() => {
    (async () => {
      if (Platform.OS !== "ios") return;
      try {
        const ok = await AppleAuthentication.isAvailableAsync();
        setAppleAvailable(!!ok);
      } catch {
        setAppleAvailable(false);
      }
    })();
  }, []);

  useEffect(() => {
    return () => {
      if (appleStallTimerRef.current) {
        clearTimeout(appleStallTimerRef.current);
        appleStallTimerRef.current = null;
      }
      appleDialogActiveRef.current = false;
    };
  }, []);

  // ---------------- ANIMATION ----------------
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

  // ---------------- LOAD QR / DEEP LINK HOUSE CODE ----------------
  useEffect(() => {
    const loadHouseCode = async () => {
      const code = await peekPendingHouseCode();
      if (code) {
        setForm((prev) => ({ ...prev, house_code: prev.house_code.trim() || code }));
        setQrLoaded(true);
      }
    };
    loadHouseCode();
  }, []);

  // ---------------- GOOGLE AUTH ----------------
  const [request, response, promptAsync] = Google.useIdTokenAuthRequest(
    getGoogleIdTokenAuthRequestOptions(),
  );
  const googleInFlightRef = useRef(false);
  /** Same success `response` can run this effect twice (Strict Mode / hook updates); avoid duplicate API + navigation. */
  const handledGoogleIdTokenRef = useRef<string | null>(null);
  useGoogleOauthDebug("signup", response);

  useEffect(() => {
    if (response?.type === "success") {
      const idToken = getGoogleIdTokenFromAuthResponse(response);
      if (idToken) {
        if (handledGoogleIdTokenRef.current === idToken) return;
        handledGoogleIdTokenRef.current = idToken;
        void handleSocialLogin("google", idToken);
      } else {
        setError(
          "Google did not return an ID token. On Android release builds, add your upload keystore SHA‑1 to the Android OAuth client in Google Cloud and ensure “Custom URI scheme” is enabled for that client.",
        );
      }
    } else if (response?.type === "error") {
      const p = response.params;
      setError(
        p?.error_description ||
          p?.error ||
          "Google sign-in was cancelled or failed.",
      );
    }
  }, [response]);

  // ---------------- SOCIAL LOGIN ----------------
  const handleSocialLogin = async (
    provider: "google" | "apple",
    token: string,
  ) => {
    setLoading(true);
    setError("");
    try {
      const pending = await peekPendingHouseCode();
      const houseCode =
        form.house_code.trim() || pending || undefined;
      const data = await socialLogin(provider, token, {
        house_code: houseCode,
        mode,
      });
      if (data?.token) {
        await saveAuthData(data.token, data.user);
        if (data.user?.house_id) await clearPendingHouseCode();
        router.replace(
          data.user?.house_id ? "/(tabs)/dashboard" : "/choose-house",
        );
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Social login failed"));
    } finally {
      setLoading(false);
    }
  };

  const clearAppleStallTimer = () => {
    if (appleStallTimerRef.current) {
      clearTimeout(appleStallTimerRef.current);
      appleStallTimerRef.current = null;
    }
  };

  // ---------------- APPLE LOGIN ----------------
  const handleAppleLogin = async () => {
    if (appleSignInInProgress) return;
    if (!appleAvailable) {
      setError(
        "Apple Sign‑In isn’t available on this device/simulator. Try a real device or sign into iCloud on the simulator.",
      );
      return;
    }
    setError("");
    const net = await NetInfo.fetch();
    const likelyOnline =
      net.isConnected === true && net.isInternetReachable !== false;
    if (!likelyOnline) {
      setError("No internet connection. Please connect and try again.");
      return;
    }
    setAppleSignInInProgress(true);
    appleDialogActiveRef.current = true;
    clearAppleStallTimer();
    appleStallTimerRef.current = setTimeout(() => {
      if (!appleDialogActiveRef.current) return;
      Alert.alert(
        "Stuck on Apple’s sign-in?",
        "This password screen is from your iPhone, not HabiMate. Try: use mobile data or another Wi‑Fi, turn off VPN, restart the device, or go to Settings → your name and check Apple ID. You can also tap Back and use email sign-up instead.",
        [{ text: "OK" }],
      );
    }, APPLE_SIGN_IN_STALL_HELP_MS);
    try {
      const credential = await AppleAuthentication.signInAsync({
        requestedScopes: [
          AppleAuthentication.AppleAuthenticationScope.EMAIL,
          AppleAuthentication.AppleAuthenticationScope.FULL_NAME,
        ],
      });
      if (credential.identityToken) {
        await handleSocialLogin("apple", credential.identityToken);
      } else {
        setError("Apple did not return a token. Try again.");
      }
    } catch (err: any) {
      if (!isAppleSignInUserCancellation(err)) {
        setError(getApiErrorMessage(err, "Apple sign-in failed"));
      }
    } finally {
      appleDialogActiveRef.current = false;
      clearAppleStallTimer();
      setAppleSignInInProgress(false);
    }
  };

  // ---------------- NORMAL SIGNUP ----------------
  const handleSignup = async () => {
    if (!form.name || !form.email || !form.password) {
      setError("Fill in all the essentials!");
      return;
    }
    setLoading(true);
    setError("");
    try {
      const data = await signup({ ...form, mode });
      if (data?.token) {
        await clearPendingHouseCode();
        if (!data.email_verified_at) {
          await AsyncStorage.setItem("pending_email", form.email);
          router.replace("/verify-email");
          return;
        }
        await saveAuthData(data.token, data.user);
        router.replace("/(tabs)/dashboard");
      }
    } catch (err: any) {
      setError(getApiErrorMessage(err, "Signup failed"));
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

      {/* FLOATING ORBS */}
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
                {/* HEADER */}
                <View style={styles.headerArea}>
                  <View style={styles.logoCircle}>
                    <Image
                      source={require("../../../assets/images/icon.png")}
                      style={styles.logoImage}
                      resizeMode="contain"
                    />
                  </View>
                  <Text style={styles.titleText}>Join Us</Text>
                  <Text style={styles.subtitleText}>
                    Shared Living. House or Away.
                  </Text>
                </View>

                {/* FORM */}
                <View style={styles.form}>
                  <TextInput
                    label="Full Name"
                    mode="flat"
                    textColor={colors.text}
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor={colors.primary}
                    value={form.name}
                    onChangeText={(t) => setForm({ ...form, name: t })}
                    left={
                      <TextInput.Icon
                        icon="account-outline"
                        color={colors.primary}
                      />
                    }
                  />
                  <TextInput
                    label="Email Address"
                    mode="flat"
                    textColor={colors.text}
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor={colors.primary}
                    autoCapitalize="none"
                    value={form.email}
                    onChangeText={(t) => setForm({ ...form, email: t })}
                    left={
                      <TextInput.Icon
                        icon="email-outline"
                        color={colors.primary}
                      />
                    }
                  />
                  <TextInput
                    label="Create Password"
                    mode="flat"
                    secureTextEntry={secureText}
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor={colors.primary}
                    value={form.password}
                    onChangeText={(t) => setForm({ ...form, password: t })}
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

                  <TextInput
                    label="House Code (Optional)"
                    mode="flat"
                    style={styles.input}
                    underlineColor="transparent"
                    activeUnderlineColor={colors.primary}
                    value={form.house_code}
                    onChangeText={(t) => setForm({ ...form, house_code: t })}
                    left={
                      <TextInput.Icon
                        icon="key-outline"
                        color={colors.primary}
                      />
                    }
                  />

                  {qrLoaded && (
                    <View style={styles.qrBadge}>
                      <Ionicons
                        name="checkmark-circle"
                        size={14}
                        color="#059669"
                      />
                      <Text style={styles.qrText}>Linked via QR Code</Text>
                    </View>
                  )}

                  {error ? <Text style={styles.errorText}>{error}</Text> : null}

                  <TouchableOpacity
                    onPress={handleSignup}
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
                        <Text style={styles.btnLabel}>Create Account</Text>
                      )}
                    </LinearGradient>
                  </TouchableOpacity>
                </View>

                {/* SOCIAL SIGNUP */}
                <View style={styles.dividerBox}>
                  <View style={styles.line} />
                  <Text style={styles.dividerLabel}>SOCIAL SIGNUP</Text>
                  <View style={styles.line} />
                </View>

                <View style={styles.socialGrid}>
                  <TouchableOpacity
                    style={styles.socialBtn}
                    onPress={() =>
                      request &&
                      !googleInFlightRef.current &&
                      (() => {
                        googleInFlightRef.current = true;
                        handledGoogleIdTokenRef.current = null;
                        Promise.resolve(
                          (async () => {
                            await setGoogleOauthReturnHref("/(auth)/signup");
                            return promptAsync({
                              useProxy: shouldUseGoogleAuthProxy(),
                            } as any);
                          })(),
                        )
                          .catch(() => {})
                          .finally(() => {
                            googleInFlightRef.current = false;
                          });
                      })()
                    }
                    disabled={loading || !request}
                  >
                    <FontAwesome5 name="google" size={20} color="#DB4437" />
                  </TouchableOpacity>
                  {Platform.OS === "ios" && (
                    <TouchableOpacity
                      style={styles.socialBtn}
                      onPress={handleAppleLogin}
                      disabled={loading || !appleAvailable || appleSignInInProgress}
                    >
                      {appleSignInInProgress ? (
                        <ActivityIndicator size="small" color="#000" />
                      ) : (
                        <FontAwesome5 name="apple" size={22} color="#000" />
                      )}
                    </TouchableOpacity>
                  )}
                  <TouchableOpacity
                    style={[
                      styles.socialBtn,
                      { backgroundColor: colors.primary },
                    ]}
                    onPress={() => router.push("/scan-qr")}
                  >
                    <Ionicons name="qr-code" size={22} color="#fff" />
                  </TouchableOpacity>
                </View>

                {/* FOOTER */}
                <View style={styles.footerLinks}>
                  <Text style={styles.footerLabel}>Already a mate?</Text>
                  <TouchableOpacity
                    onPress={() => router.replace("/(auth)/login")}
                  >
                    <Text style={styles.loginLink}> Log In</Text>
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
    paddingHorizontal: 22,
    paddingTop: 60,
    paddingBottom: 40,
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
  headerArea: { marginBottom: 20, alignItems: "center" },
  logoCircle: {
    width: 85,
    height: 85,
    borderRadius: 25,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginBottom: 12,
    overflow: "hidden",
    elevation: 10,
  },
  logoImage: { width: "100%", height: "100%" },
  titleText: {
    fontSize: 34,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: -1.5,
  },
  subtitleText: {
    color: "#475569",
    fontSize: 13,
    fontWeight: "600",
    opacity: 0.8,
  },
  form: { gap: 10 },
  input: {
    backgroundColor: "rgba(255,255,255,0.7)",
    height: 58,
    borderRadius: 15,
    overflow: "hidden",
  },
  qrBadge: {
    flexDirection: "row",
    alignItems: "center",
    alignSelf: "center",
    gap: 5,
    marginTop: -2,
  },
  qrText: { fontSize: 12, color: "#059669", fontWeight: "700" },
  errorText: {
    color: "#B91C1C",
    fontSize: 12,
    fontWeight: "800",
    textAlign: "center",
  },
  mainBtnWrapper: { borderRadius: 20, overflow: "hidden", marginTop: 8 },
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
  footerLabel: { color: "#475569", fontSize: 15, fontWeight: "500" },
  loginLink: { color: "#FF6A6A", fontWeight: "900", fontSize: 15 },
});
