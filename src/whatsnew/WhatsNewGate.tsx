import AsyncStorage from "@react-native-async-storage/async-storage";
import * as Application from "expo-application";
import { useRouter } from "expo-router";
import React, { useEffect, useMemo, useState } from "react";
import {
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  Text,
  View,
} from "react-native";
import { LinearGradient } from "expo-linear-gradient";
import { WHATS_NEW } from "./whatsNewContent";

const STORAGE_KEY = "whats_new_seen_v2";

function getAppVersionKey(): string {
  const v = Application.nativeApplicationVersion ?? "0.0.0";
  const b = Application.nativeBuildVersion ?? "0";
  // Include content id so we can re-show without bumping app version.
  return `${v}(${b})::${WHATS_NEW.id}`;
}

export function WhatsNewGate() {
  const router = useRouter();
  const [visible, setVisible] = useState(false);

  const versionKey = useMemo(() => getAppVersionKey(), []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem(STORAGE_KEY);
        if (!cancelled && seen !== versionKey) setVisible(true);
      } catch {
        // If storage fails, do not block the user; still show once.
        if (!cancelled) setVisible(true);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [versionKey]);

  const dismiss = async () => {
    setVisible(false);
    try {
      await AsyncStorage.setItem(STORAGE_KEY, versionKey);
    } catch {
      // ignore
    }
  };

  if (!visible) return null;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="fade"
      onRequestClose={() => void dismiss()}
    >
      <View style={styles.overlay}>
        <View style={styles.card}>
          <LinearGradient
            colors={["#FF8E8E", "#FF6A6A"]}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 1 }}
            style={styles.hero}
          >
            <Text style={styles.heroTitle}>What’s new</Text>
            <Text style={styles.heroSub}>{WHATS_NEW.headline}</Text>
          </LinearGradient>

          <ScrollView
            style={styles.body}
            contentContainerStyle={{ paddingBottom: 14 }}
            showsVerticalScrollIndicator={false}
          >
            {WHATS_NEW.items.map((it) => (
              <View key={it.title} style={styles.row}>
                <Text style={styles.rowTitle}>{it.title}</Text>
                <Text style={styles.rowBody}>{it.body}</Text>
              </View>
            ))}
          </ScrollView>

          <View style={styles.footer}>
            <Pressable
              onPress={() => {
                void dismiss();
                // Let animation settle a bit before navigating.
                setTimeout(() => router.push("/whats-new" as any), 120);
              }}
              style={({ pressed }) => [
                styles.linkBtn,
                pressed && { opacity: 0.85 },
              ]}
              hitSlop={10}
            >
              <Text style={styles.linkText}>View details</Text>
            </Pressable>

            <Pressable
              onPress={() => void dismiss()}
              style={({ pressed }) => [
                styles.primaryBtn,
                pressed && { opacity: 0.9 },
              ]}
              hitSlop={10}
            >
              <Text style={styles.primaryText}>Got it</Text>
            </Pressable>
          </View>

          {Platform.OS === "android" ? (
            <Text style={styles.androidHint}>
              Tip: You can reopen this anytime from Profile.
            </Text>
          ) : null}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.55)",
    justifyContent: "center",
    padding: 18,
  },
  card: {
    borderRadius: 24,
    overflow: "hidden",
    backgroundColor: "#fff",
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: "rgba(0,0,0,0.08)",
  },
  hero: { paddingHorizontal: 18, paddingVertical: 16 },
  heroTitle: { color: "#fff", fontSize: 20, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.92)", marginTop: 4, fontWeight: "700" },
  body: { paddingHorizontal: 18, paddingTop: 14, maxHeight: 340 },
  row: { marginBottom: 12 },
  rowTitle: { fontSize: 15, fontWeight: "900", color: "#0F172A" },
  rowBody: { marginTop: 4, color: "#475569", fontWeight: "600", lineHeight: 18 },
  footer: {
    paddingHorizontal: 14,
    paddingBottom: 14,
    paddingTop: 10,
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 10,
  },
  linkBtn: { paddingHorizontal: 10, paddingVertical: 10 },
  linkText: { color: "#FF6A6A", fontWeight: "900" },
  primaryBtn: {
    backgroundColor: "#FF6A6A",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 14,
  },
  primaryText: { color: "#fff", fontWeight: "900" },
  androidHint: {
    paddingHorizontal: 18,
    paddingBottom: 14,
    color: "#64748B",
    fontWeight: "600",
    fontSize: 12,
  },
});

