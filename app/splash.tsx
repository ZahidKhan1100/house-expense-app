import AsyncStorage from "@react-native-async-storage/async-storage";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Easing,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

export default function HabiMateSplash() {
  const router = useRouter();

  // --- BRAND COLORS (Matching Login/Signup) ---
  const colors = {
    primary: "#FF6A6A",
    primaryLight: "#FF8E8E",
    bgDark: "#0F172A",
  };

  // --- ANIMATION VALUES ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const floatAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    // 1. Start Animations
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 1200,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(floatAnim, {
          toValue: 1,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
        Animated.timing(floatAnim, {
          toValue: 0,
          duration: 3000,
          easing: Easing.inOut(Easing.sin),
          useNativeDriver: true,
        }),
      ]),
    ).start();

    // 2. Logic to check auth and move forward
    const checkAuth = async () => {
      // Small delay so user sees the beautiful splash
      await new Promise((resolve) => setTimeout(resolve, 2500));

      const token = await AsyncStorage.getItem("token");
      const userStr = await AsyncStorage.getItem("user");

      if (token && userStr) {
        const user = JSON.parse(userStr);
        if (user.house_id) {
          router.replace("/(tabs)/dashboard");
        } else {
          router.replace("/choose-house");
        }
      } else {
        router.replace("/(auth)/login");
      }
    };

    checkAuth();
  }, []);

  const floatingY = floatAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, -20],
  });

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={[colors.primaryLight, colors.primary, colors.bgDark]}
        style={styles.gradient}
      >
        {/* Floating Orbs */}
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

        {/* Logo and Branding */}
        <Animated.View
          style={[
            styles.content,
            { opacity: fadeAnim, transform: [{ scale: scaleAnim }] },
          ]}
        >
          <View style={styles.logoPill}>
            <Image
              source={require("../assets/images/icon.png")}
              style={styles.logoImage}
              resizeMode="contain"
            />
          </View>

          <View style={styles.brandContainer}>
            <Text style={styles.brandHabi}>Habi</Text>
            <Text style={styles.brandMate}>Mate</Text>
          </View>

          <Text style={styles.tagline}>Shared Living. House or Away.</Text>
        </Animated.View>

        <View style={styles.footer}>
          <ActivityIndicator color="#FFFFFF" size="large" />
        </View>
      </LinearGradient>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  gradient: { flex: 1, justifyContent: "center", alignItems: "center" },

  orb: {
    position: "absolute",
    borderRadius: 1000,
    backgroundColor: "rgba(255,255,255,0.12)",
  },
  orb1: { width: width * 0.7, height: width * 0.7, top: -50, right: -50 },
  orb2: { width: width * 0.9, height: width * 0.9, bottom: -100, left: -100 },

  content: { alignItems: "center" },
  logoPill: {
    width: 140,
    height: 140,
    padding: 20,
    borderRadius: 40,
    backgroundColor: "#FFFFFF", // Logo looks best on clean white
    marginBottom: 25,
    justifyContent: "center",
    alignItems: "center",
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOpacity: 0.15, shadowRadius: 20 },
      android: { elevation: 15 },
    }),
  },
  logoImage: {
    width: "90%",
    height: "90%",
  },
  brandContainer: { flexDirection: "row", alignItems: "center" },
  brandHabi: {
    fontSize: 54,
    fontWeight: "300",
    color: "#FFFFFF",
    letterSpacing: -2,
  },
  brandMate: {
    fontSize: 54,
    fontWeight: "900",
    color: "#FFFFFF",
    letterSpacing: -2,
  },
  tagline: {
    color: "rgba(255,255,255,0.85)",
    fontSize: 16,
    fontWeight: "600",
    marginTop: 5,
    letterSpacing: 0.5,
  },

  footer: { position: "absolute", bottom: 80 },
});
