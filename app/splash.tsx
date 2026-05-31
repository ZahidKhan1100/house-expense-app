import { LinearGradient } from "expo-linear-gradient";
import { StatusBar } from "expo-status-bar";
import { useEffect, useRef } from "react";
import {
  ActivityIndicator,
  Animated,
  Dimensions,
  Image,
  Platform,
  StyleSheet,
  Text,
  View,
} from "react-native";

const { width } = Dimensions.get("window");

/**
 * Presentational splash only. Routing lives in `app/index.tsx` (`boot()`).
 *
 * History: previously this screen duplicated auth checks and called
 * `router.replace` after a 2.5s delay without cancel-on-unmount, which fired a
 * second navigation to login. The infinite `Animated.loop` over a translucent
 * gradient also caused the status bar to flicker → crash on some Samsung One UI
 * devices (S24 reports). We now:
 *
 *   - Lock the status bar style via `expo-status-bar` (light, translucent) so
 *     the OS doesn't repeatedly recolor it during the splash → app handoff.
 *   - Run the fade/scale entrance only — no infinite loop. The orbs still
 *     translate once via the entrance animation; no re-rendering forever.
 */
export default function HabiMateSplash() {
  // --- BRAND COLORS (Matching Login/Signup) ---
  const colors = {
    primary: "#FF6A6A",
    primaryLight: "#FF8E8E",
    bgDark: "#0F172A",
  };

  // --- ANIMATION VALUES ---
  const fadeAnim = useRef(new Animated.Value(0)).current;
  const scaleAnim = useRef(new Animated.Value(0.85)).current;

  useEffect(() => {
    Animated.parallel([
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 700,
        useNativeDriver: true,
      }),
      Animated.spring(scaleAnim, {
        toValue: 1,
        friction: 6,
        tension: 40,
        useNativeDriver: true,
      }),
    ]).start();
  }, [fadeAnim, scaleAnim]);

  return (
    <View style={styles.container}>
      <StatusBar style="light" translucent backgroundColor="transparent" />
      <LinearGradient
        colors={[colors.primaryLight, colors.primary, colors.bgDark]}
        style={styles.gradient}
      >
        <View style={[styles.orb, styles.orb1]} />
        <View style={[styles.orb, styles.orb2]} />

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
    backgroundColor: "#FFFFFF",
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
