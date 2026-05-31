import { MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import React, { useMemo } from "react";
import { ScrollView, StyleSheet, Text, TouchableOpacity, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useTheme } from "../src/theme/ThemeContext";
import { FEATURE_GUIDE_SECTIONS } from "../src/guides/featureGuideContent";

export default function FeatureGuideScreen() {
  const router = useRouter();
  const { isDark } = useTheme();

  const palette = useMemo(
    () => ({
      bg: isDark ? "#0F172A" : "#F8FAFC",
      text: isDark ? "#F1F5F9" : "#0F172A",
      sub: isDark ? "#94A3B8" : "#475569",
      card: isDark ? "#1E293B" : "#FFFFFF",
      border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    }),
    [isDark],
  );

  return (
    <SafeAreaView
      style={[styles.container, { backgroundColor: palette.bg }]}
      edges={["top", "left", "right"]}
    >
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={12} style={styles.backBtn}>
          <MaterialIcons name="arrow-back" size={24} color={palette.text} />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: palette.text }]}>How it works</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <LinearGradient
          colors={["#FF8E8E", "#FF6A6A"]}
          start={{ x: 0, y: 0 }}
          end={{ x: 1, y: 1 }}
          style={styles.hero}
        >
          <MaterialCommunityIcons name="book-open-page-variant" size={28} color="rgba(255,255,255,0.95)" />
          <Text style={styles.heroTitle}>How it works</Text>
          <Text style={styles.heroSub}>
            Expenses, cent-exact splits, buy-backs, Pay — what the app actually does with your numbers.
          </Text>
        </LinearGradient>

        {FEATURE_GUIDE_SECTIONS.map((section) => (
          <View key={section.id} style={{ marginBottom: 16 }}>
            <Text style={[styles.sectionTitle, { color: palette.text }]}>{section.title}</Text>
            {section.items.map((item, idx) => (
              <View
                key={`${section.id}-${idx}`}
                style={[
                  styles.card,
                  {
                    backgroundColor: palette.card,
                    borderColor: palette.border,
                  },
                ]}
              >
                <Text style={[styles.itemTitle, { color: palette.text }]}>{item.title}</Text>
                <Text style={[styles.itemBody, { color: palette.sub }]}>{item.body}</Text>
              </View>
            ))}
          </View>
        ))}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 8,
    paddingBottom: 4,
  },
  backBtn: { padding: 8 },
  headerTitle: { fontSize: 18, fontWeight: "900" },
  content: { paddingHorizontal: 16, paddingBottom: 40 },
  hero: {
    borderRadius: 22,
    padding: 18,
    marginTop: 10,
    marginBottom: 6,
    gap: 8,
  },
  heroTitle: { color: "#fff", fontSize: 18, fontWeight: "900" },
  heroSub: { color: "rgba(255,255,255,0.92)", fontWeight: "600", fontSize: 14, lineHeight: 19 },
  sectionTitle: { fontWeight: "900", fontSize: 16, marginBottom: 10, marginTop: 8 },
  card: {
    borderRadius: 18,
    padding: 14,
    marginBottom: 10,
    borderWidth: 1,
  },
  itemTitle: { fontWeight: "900", fontSize: 15 },
  itemBody: { marginTop: 6, fontWeight: "600", fontSize: 14, lineHeight: 21 },
});
