import { useCallback, useEffect, useMemo, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ActivityIndicator,
  ScrollView,
  Pressable,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useLocalSearchParams, useRouter } from "expo-router";
import { FontAwesome5, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";

import { useTheme } from "../../src/theme/ThemeContext";
import { apiClient } from "../../src/utils/apiClient";
import { UserAvatar } from "../../src/components/UserAvatar";
import { FullScreenImageModal } from "../../src/components/FullScreenImageModal";

type MateRow = {
  id: number;
  name: string;
  email: string;
  avatar_url?: string | null;
  is_founder?: boolean;
  karma_balance?: number;
  is_house_legend?: boolean;
  pending?: boolean;
  isAdmin?: boolean;
};

export default function MateProfileScreen() {
  const { id: idParam } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { isDark } = useTheme();

  const mateId = Number(idParam);
  const [loading, setLoading] = useState(true);
  const [mate, setMate] = useState<MateRow | null>(null);
  const [imageModal, setImageModal] = useState(false);

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0F172A" : "#F8FAFC",
      card: isDark ? "#1E293B" : "#FFFFFF",
      text: isDark ? "#F1F5F9" : "#0F172A",
      sub: isDark ? "#94A3B8" : "#64748B",
      border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
      primary: "#FF6A6A",
      accent: "#6366F1",
    }),
    [isDark],
  );

  const levelFor = (k: number) => Math.floor(Math.max(0, k) / 500) + 1;

  const load = useCallback(async () => {
    if (!Number.isFinite(mateId) || mateId < 1) {
      setMate(null);
      setLoading(false);
      return;
    }
    setLoading(true);
    try {
      const data = await apiClient("/mates", "GET");
      const approvedIds = new Set((data.approved || []).map((m: MateRow) => m.id));
      const pending = (data.pending || []).filter(
        (m: MateRow) => !approvedIds.has(m.id),
      ) as MateRow[];

      const candidates: MateRow[] = [
        ...(data.admin ? [{ ...data.admin, isAdmin: true }] : []),
        ...(data.approved || []).map((m: MateRow) => ({ ...m, isAdmin: false })),
        ...pending.map((m: MateRow) => ({ ...m, pending: true, isAdmin: false })),
      ];

      const found = candidates.find((m) => Number(m.id) === mateId) ?? null;
      setMate(found);
    } catch {
      setMate(null);
    } finally {
      setLoading(false);
    }
  }, [mateId]);

  useEffect(() => {
    void load();
  }, [load]);

  const avatarUri =
    typeof mate?.avatar_url === "string" ? mate.avatar_url.trim() : "";

  if (loading) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]} edges={["top"]}>
        <ActivityIndicator size="large" color={colors.primary} />
      </SafeAreaView>
    );
  }

  if (!mate) {
    return (
      <SafeAreaView style={[styles.center, { backgroundColor: colors.bg }]} edges={["top"]}>
        <Text style={{ color: colors.sub, fontWeight: "700", marginBottom: 16 }}>
          Could not load this mate.
        </Text>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <Text style={{ color: "#fff", fontWeight: "800" }}>Go back</Text>
        </TouchableOpacity>
      </SafeAreaView>
    );
  }

  const karma = Number(mate.karma_balance ?? 0);
  const lvl = levelFor(karma);

  return (
    <SafeAreaView style={[styles.root, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.headerCircle, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>
        <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
          Mate profile
        </Text>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scrollPad}
      >
        <View
          style={[
            styles.heroCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Pressable
            onPress={() => {
              if (avatarUri) setImageModal(true);
            }}
            disabled={!avatarUri}
            style={({ pressed }) => [
              styles.avatarWrap,
              !!mate.is_house_legend && styles.legendRing,
              { opacity: pressed && avatarUri ? 0.92 : 1 },
            ]}
          >
            <UserAvatar
              name={mate.name ?? "?"}
              avatarUrl={avatarUri || null}
              size={144}
              borderRadius={48}
              bg={mate.isAdmin ? colors.accent + "22" : colors.primary + "18"}
              letterColor={mate.isAdmin ? colors.accent : colors.primary}
            />
          </Pressable>

          {avatarUri ? (
            <Text style={[styles.photoHint, { color: colors.sub }]}>
              Tap photo to view full size
            </Text>
          ) : null}

          <Text style={[styles.name, { color: colors.text }]}>{mate.name}</Text>
          <Text style={[styles.email, { color: colors.sub }]}>{mate.email}</Text>

          <View style={styles.badgeRow}>
            {mate.isAdmin ? (
              <View style={[styles.badge, { backgroundColor: colors.accent + "22" }]}>
                <MaterialIcons name="admin-panel-settings" size={14} color={colors.accent} />
                <Text style={[styles.badgeTxt, { color: colors.accent }]}>Admin</Text>
              </View>
            ) : null}
            {mate.pending ? (
              <View style={[styles.badge, { backgroundColor: "#F59E0B28" }]}>
                <MaterialCommunityIcons name="clock-outline" size={14} color="#F59E0B" />
                <Text style={[styles.badgeTxt, { color: "#F59E0B" }]}>Pending</Text>
              </View>
            ) : null}
            {mate.is_founder ? (
              <View style={[styles.badge, { backgroundColor: "#FFD70030" }]}>
                <FontAwesome5 name="award" size={12} color="#B45309" />
                <Text style={[styles.badgeTxt, { color: "#B45309" }]}>Founder</Text>
              </View>
            ) : null}
            {mate.is_house_legend ? (
              <View style={[styles.badge, { backgroundColor: "#FFD70038" }]}>
                <FontAwesome5 name="crown" size={12} color="#B45309" />
                <Text style={[styles.badgeTxt, { color: "#B45309" }]}>House legend</Text>
              </View>
            ) : null}
          </View>

          {!mate.pending ? (
            <View
              style={[
                styles.karmaCard,
                { borderColor: colors.border, backgroundColor: isDark ? "#0F172A" : "#FFF5F5" },
              ]}
            >
              <MaterialCommunityIcons name="star-four-points" size={22} color={colors.primary} />
              <View style={{ marginLeft: 12, flex: 1 }}>
                <Text style={[styles.karmaLabel, { color: colors.sub }]}>Karma</Text>
                <Text style={[styles.karmaBig, { color: colors.text }]}>
                  Level {lvl} · {karma.toLocaleString()} pts
                </Text>
              </View>
            </View>
          ) : null}
        </View>
      </ScrollView>

      <FullScreenImageModal
        visible={imageModal}
        uri={avatarUri}
        onClose={() => setImageModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center", padding: 24 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  headerCircle: {
    width: 42,
    height: 42,
    borderRadius: 21,
    alignItems: "center",
    justifyContent: "center",
    ...Platform.select({
      ios: {
        shadowColor: "#FF6A6A",
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.25,
        shadowRadius: 5,
      },
      android: { elevation: 3 },
    }),
  },
  headerTitle: { fontSize: 18, fontWeight: "900", flex: 1, textAlign: "center" },
  backBtn: { paddingHorizontal: 20, paddingVertical: 12, borderRadius: 14 },
  scrollPad: { paddingBottom: 40, paddingHorizontal: 20 },
  heroCard: {
    alignItems: "center",
    borderRadius: 24,
    borderWidth: 1,
    paddingVertical: 28,
    paddingHorizontal: 20,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 8 },
        shadowOpacity: 0.06,
        shadowRadius: 16,
      },
      android: { elevation: 2 },
    }),
  },
  avatarWrap: { marginBottom: 8 },
  legendRing: {
    borderWidth: 3,
    borderColor: "#FFD700",
    borderRadius: 52,
    padding: 4,
  },
  photoHint: { fontSize: 12, fontWeight: "600", marginBottom: 12 },
  name: { fontSize: 26, fontWeight: "900", textAlign: "center", letterSpacing: -0.5 },
  email: { fontSize: 15, marginTop: 8, textAlign: "center" },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
    marginTop: 16,
  },
  badge: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 999,
  },
  badgeTxt: { fontSize: 12, fontWeight: "800" },
  karmaCard: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 22,
    width: "100%",
    padding: 16,
    borderRadius: 16,
    borderWidth: 1,
  },
  karmaLabel: { fontSize: 12, fontWeight: "700", textTransform: "uppercase" },
  karmaBig: { fontSize: 18, fontWeight: "900", marginTop: 2 },
});
