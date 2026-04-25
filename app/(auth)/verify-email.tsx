import { useState, useEffect, useRef } from "react";
import {
  View,
  StyleSheet,
  Linking,
  Dimensions,
  Animated,
  Easing,
  Platform,
  TouchableOpacity,
} from "react-native";
import { Text, Button } from "react-native-paper";
import { LinearGradient } from "expo-linear-gradient";
import { BlurView } from "expo-blur";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useRouter } from "expo-router";
import { notifySessionTokenCommitted } from "../../src/auth/sessionTokenBridge";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { resendVerification } from "../../src/services/authService";
import { apiClient } from "../../src/utils/apiClient";

const { width } = Dimensions.get("window");

export default function VerifyEmail() {
  const router = useRouter();

  const [loading, setLoading] = useState(false);
  const [checking, setChecking] = useState(false);
  const [message, setMessage] = useState("");
  const [email, setEmail] = useState("");

  // --- ANIMATIONS ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const slideAnim = useRef(new Animated.Value(30)).current;
  const pulseAnim = useRef(new Animated.Value(1)).current;

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
        friction: 7,
        useNativeDriver: true,
      }),
    ]).start();

    // Pulse animation for the icon
    Animated.loop(
      Animated.sequence([
        Animated.timing(pulseAnim, {
          toValue: 1.1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(pulseAnim, {
          toValue: 1,
          duration: 1500,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    const loadEmail = async () => {
      const storedEmail = await AsyncStorage.getItem("pending_email");
      if (storedEmail) setEmail(storedEmail);
    };
    loadEmail();
  }, []);

  const checkVerification = async () => {
    if (!email) return;
    setChecking(true);
    try {
      const res = await apiClient("/check-email-verified", "POST", { email });

      if (res.email_verified) {
        await AsyncStorage.removeItem("pending_email");
        await AsyncStorage.setItem("token", res.token || "");
        await AsyncStorage.setItem("user", JSON.stringify(res.user || {}));
        notifySessionTokenCommitted(res.token || null);

        setMessage("✅ Verified! Redirecting...");

        setTimeout(() => {
          const userMode = res.user?.mode || ""; // check mode field
          if (userMode === "trip") {
            router.replace("/create-trip");
          } else if (res.user?.status === "pending") {
            router.replace("/pending");
          } else {
            router.replace("/(tabs)/dashboard");
          }
        }, 1500);
      } else {
        setMessage("❌ Still waiting for verification...");
      }
    } catch (err: any) {
      setMessage("Verification check failed");
    } finally {
      setChecking(false);
    }
  };

  const resend = async () => {
    setLoading(true);
    try {
      await resendVerification(email);
      setMessage("📩 New link sent to your inbox");
    } catch (e: any) {
      setMessage(e.message);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!email) return;
    const interval = setInterval(() => checkVerification(), 8000); // Check every 8s
    return () => clearInterval(interval);
  }, [email]);

  return (
    <View style={styles.mainContainer}>
      <LinearGradient
        colors={["#FF6B6B", "#FF8E8E", "#4E54C8"]}
        style={styles.gradient}
      >
        <View style={styles.content}>
          <Animated.View
            style={[
              styles.glassCard,
              { opacity: fadeAnim, transform: [{ translateY: slideAnim }] },
            ]}
          >
            <BlurView
              intensity={Platform.OS === "ios" ? 40 : 100}
              tint="light"
              style={styles.blurWrap}
            >
              <View style={styles.iconContainer}>
                <Animated.View style={{ transform: [{ scale: pulseAnim }] }}>
                  <LinearGradient
                    colors={["#FF6B6B", "#FF8E8E"]}
                    style={styles.iconCircle}
                  >
                    <MaterialCommunityIcons
                      name="email-check-outline"
                      size={40}
                      color="white"
                    />
                  </LinearGradient>
                </Animated.View>
              </View>

              <Text style={styles.titleText}>Check your Mail</Text>
              <Text style={styles.subtitleText}>
                We've sent a verification link to:{"\n"}
                <Text style={styles.emailHighlight}>
                  {email || "your email"}
                </Text>
              </Text>

              <View style={styles.buttonGap}>
                <Button
                  mode="contained"
                  onPress={() => Linking.openURL("mailto:")}
                  style={styles.primaryBtn}
                  contentStyle={styles.btnContent}
                  labelStyle={styles.btnLabel}
                >
                  Open Email App
                </Button>

                <Button
                  mode="outlined"
                  loading={checking}
                  onPress={checkVerification}
                  style={styles.secondaryBtn}
                  contentStyle={styles.btnContent}
                  labelStyle={[styles.btnLabel, { color: "#1E293B" }]}
                >
                  I've Verified
                </Button>

                <TouchableOpacity
                  onPress={resend}
                  disabled={loading}
                  style={styles.resendLink}
                >
                  <Text style={styles.resendText}>
                    {loading ? "Sending..." : "Didn't get the email? Resend"}
                  </Text>
                </TouchableOpacity>
              </View>

              {message ? (
                <View style={styles.messageBox}>
                  <Text style={styles.messageText}>{message}</Text>
                </View>
              ) : null}

              <TouchableOpacity
                style={styles.backBtn}
                onPress={() => router.replace("/(auth)/login")}
              >
                <MaterialCommunityIcons
                  name="arrow-left"
                  size={20}
                  color="#64748B"
                />
                <Text style={styles.backText}> Back to Login</Text>
              </TouchableOpacity>
            </BlurView>
          </Animated.View>
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  mainContainer: { flex: 1 },
  gradient: { flex: 1 },
  content: { flex: 1, justifyContent: "center", padding: 24 },

  glassCard: {
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: "rgba(255,255,255,0.12)",
    borderWidth: 1.5,
    borderColor: "rgba(255,255,255,0.4)",
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 20 },
        shadowOpacity: 0.1,
        shadowRadius: 30,
      },
      android: { elevation: 8 },
    }),
  },
  blurWrap: { padding: 32, alignItems: "center" },

  iconContainer: { marginBottom: 24 },
  iconCircle: {
    width: 80,
    height: 80,
    borderRadius: 30,
    justifyContent: "center",
    alignItems: "center",
    elevation: 10,
    shadowColor: "#FF6B6B",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.3,
    shadowRadius: 15,
  },

  titleText: {
    fontSize: 32,
    fontWeight: "900",
    color: "#1E293B",
    letterSpacing: -1,
    marginBottom: 8,
  },
  subtitleText: {
    color: "#475569",
    fontSize: 16,
    textAlign: "center",
    lineHeight: 22,
    fontWeight: "500",
  },
  emailHighlight: { color: "#FF6B6B", fontWeight: "800" },

  buttonGap: { width: "100%", marginTop: 32, gap: 12 },
  primaryBtn: { borderRadius: 18, backgroundColor: "#FF6B6B" },
  secondaryBtn: {
    borderRadius: 18,
    borderColor: "rgba(0,0,0,0.1)",
    borderWidth: 1.5,
  },
  btnContent: { height: 56 },
  btnLabel: { fontSize: 16, fontWeight: "800" },

  resendLink: { marginTop: 10, alignItems: "center" },
  resendText: { color: "#64748B", fontWeight: "700", fontSize: 14 },

  messageBox: {
    marginTop: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    borderRadius: 12,
    backgroundColor: "rgba(255,255,255,0.5)",
  },
  messageText: {
    color: "#1E293B",
    fontWeight: "700",
    fontSize: 13,
    textAlign: "center",
  },

  backBtn: {
    marginTop: 30,
    flexDirection: "row",
    alignItems: "center",
    opacity: 0.7,
  },
  backText: { color: "#64748B", fontWeight: "700", fontSize: 14 },
});
