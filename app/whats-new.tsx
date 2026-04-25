import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import React from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { WHATS_NEW } from "../src/whatsnew/whatsNewContent";

export default function WhatsNewScreen() {
  const router = useRouter();

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color="#0F172A" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>What’s new</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#FF8E8E", "#FF6A6A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <Text style={styles.heroTitle}>{WHATS_NEW.headline}</Text>
          <Text style={styles.heroSub}>A quick summary of the latest improvements.</Text>
        </LinearGradient>

        {WHATS_NEW.items.map((it) => (
          <View key={it.title} style={styles.card}>
            <Text style={styles.title}>{it.title}</Text>
            <Text style={styles.body}>{it.body}</Text>
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#F8FAFC" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "900", color: "#0F172A" },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  hero: { borderRadius: 22, padding: 16, marginTop: 10, marginBottom: 12 },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.92)", marginTop: 6, fontWeight: "700" },
  card: {
    backgroundColor: "#fff",
    borderRadius: 18,
    padding: 14,
    marginBottom: 12,
    borderWidth: 1,
    borderColor: "#E2E8F0",
  },
  title: { color: "#0F172A", fontWeight: "900", fontSize: 15 },
  body: { marginTop: 6, color: "#475569", fontWeight: "600", lineHeight: 19 },
});

