import { LinearGradient } from "expo-linear-gradient";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";

import { apiClient } from "../../src/utils/apiClient";
import { useTheme } from "../../src/theme/ThemeContext";
import { UserAvatar } from "../../src/components/UserAvatar";

type Row = {
  id: number;
  name: string;
  avatar_url?: string | null;
  karma_balance: number;
  level: number;
  is_founder?: boolean;
};

const CORAL = "#FF6A6A";

export default function HouseLegends() {
  const router = useRouter();
  const { isDark } = useTheme();

  const [loading, setLoading] = useState(true);
  const [rows, setRows] = useState<Row[]>([]);
  const [houseLegendUserId, setHouseLegendUserId] = useState<number | null>(null);

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0F172A" : "#F8FAFC",
      card: isDark ? "#1E293B" : "#FFFFFF",
      text: isDark ? "#F1F5F9" : "#0F172A",
      sub: isDark ? "#94A3B8" : "#64748B",
      border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    }),
    [isDark],
  );

  const fetchData = async () => {
    setLoading(true);
    try {
      const res = await apiClient("/leaderboard", "GET");
      setRows(res.users || []);
      setHouseLegendUserId(
        res.house_legend_user_id != null ? Number(res.house_legend_user_id) : null,
      );
    } catch (e: any) {
      Alert.alert("Error", e?.message ?? "Could not load leaderboard");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const top3 = rows.slice(0, 3);
  const rest = rows.slice(3);

  const medal = (rank: number) => (rank === 1 ? "🥇" : rank === 2 ? "🥈" : "🥉");

  const goMateProfile = (id: number) => {
    router.push(`/mate/${id}` as any);
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.bg }} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/dashboard"))} style={styles.backBtn}>
          <MaterialCommunityIcons name="chevron-left" size={26} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={[styles.title, { color: colors.text }]}>House Legends</Text>
          <Text style={[styles.sub, { color: colors.sub }]}>Karma leaderboard</Text>
        </View>
        <TouchableOpacity onPress={fetchData} style={[styles.refreshBtn, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <MaterialCommunityIcons name="refresh" size={18} color={CORAL} />
        </TouchableOpacity>
      </View>

      {loading ? (
        <View style={styles.loader}>
          <ActivityIndicator size="large" color={CORAL} />
        </View>
      ) : (
        <>
          <LinearGradient colors={["#FF8E8E", "#FF6A6A"]} style={styles.hero}>
            <Text style={styles.heroTitle}>Top Legends</Text>
            <View style={styles.topRow}>
              {top3.map((u, idx) => {
                const rank = idx + 1;
                const isLegend =
                  houseLegendUserId != null && u.id === houseLegendUserId;
                return (
                  <View
                    key={u.id}
                    style={[
                      styles.topCard,
                      { opacity: rank === 1 ? 1 : 0.92 },
                      rank === 1 && styles.topCardGlow,
                    ]}
                  >
                    {rank === 1 && (
                      <View style={styles.crownFloater}>
                        <MaterialCommunityIcons name="crown" size={20} color="#FFD700" />
                      </View>
                    )}
                    <Text style={styles.topMedal}>{medal(rank)}</Text>
                    <View style={[styles.heroAvatar, isLegend && styles.heroAvatarLegend]}>
                      <UserAvatar
                        name={u.name}
                        avatarUrl={u.avatar_url}
                        size={44}
                        borderRadius={16}
                        bg="rgba(255,255,255,0.22)"
                        letterColor="#fff"
                        onPress={() => goMateProfile(u.id)}
                      />
                    </View>
                    <Text style={styles.topName} numberOfLines={1}>
                      {u.name}
                    </Text>
                    <Text style={styles.topMeta}>Lvl {u.level}</Text>
                    <Text style={styles.topPts}>{u.karma_balance.toLocaleString()} pts</Text>
                  </View>
                );
              })}
            </View>
          </LinearGradient>

          <FlatList
            data={rest}
            keyExtractor={(i) => String(i.id)}
            contentContainerStyle={{ padding: 18, paddingBottom: 30 }}
            renderItem={({ item, index }) => {
              const rank = index + 4;
              const isLegend =
                houseLegendUserId != null && item.id === houseLegendUserId;
              return (
                <View style={[styles.row, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={[styles.rank, { color: colors.sub }]}>{rank}</Text>
                  <View style={styles.avatarWrap}>
                    <View style={[styles.avatarLegendShell, isLegend && styles.avatarLegend]}>
                      <UserAvatar
                        name={item.name}
                        avatarUrl={item.avatar_url}
                        size={38}
                        borderRadius={14}
                        bg="rgba(255,106,106,0.12)"
                        letterColor={CORAL}
                        onPress={() => goMateProfile(item.id)}
                      />
                    </View>
                    {isLegend && (
                      <View style={styles.avatarCrownBadge}>
                        <MaterialCommunityIcons name="crown" size={11} color="#FFD700" />
                      </View>
                    )}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                        {item.name}
                      </Text>
                      {!!item.is_founder && (
                        <LinearGradient colors={["#FFD700", "#FF6A6A"]} style={styles.founderMini}>
                          <MaterialCommunityIcons name="crown" size={12} color="#fff" />
                        </LinearGradient>
                      )}
                    </View>
                    <Text style={[styles.meta, { color: colors.sub }]}>
                      Lvl {item.level} • {item.karma_balance.toLocaleString()} pts
                    </Text>
                  </View>
                </View>
              );
            }}
            ListEmptyComponent={
              <View style={{ padding: 18 }}>
                <Text style={{ color: colors.sub, fontWeight: "700" }}>
                  No leaderboard data yet.
                </Text>
              </View>
            }
          />
        </>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: { flexDirection: "row", alignItems: "center", gap: 12, paddingHorizontal: 18, paddingVertical: 12 },
  backBtn: { width: 42, height: 42, borderRadius: 16, backgroundColor: CORAL, alignItems: "center", justifyContent: "center" },
  refreshBtn: { width: 42, height: 42, borderRadius: 14, borderWidth: 1, alignItems: "center", justifyContent: "center" },
  title: { fontSize: 20, fontWeight: "900" },
  sub: { fontSize: 12, fontWeight: "700", marginTop: -2 },
  loader: { flex: 1, alignItems: "center", justifyContent: "center" },
  hero: { marginHorizontal: 18, borderRadius: 24, padding: 16 },
  heroTitle: { color: "#fff", fontWeight: "900", fontSize: 14, marginBottom: 12, textTransform: "uppercase" },
  topRow: { flexDirection: "row", gap: 10 },
  topCard: { flex: 1, borderRadius: 18, backgroundColor: "rgba(255,255,255,0.18)", padding: 12, overflow: "visible" },
  topCardGlow: {
    borderWidth: 1.5,
    borderColor: "rgba(255,215,0,0.65)",
    shadowColor: "#FFD700",
    shadowOpacity: 0.55,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    elevation: 8,
  },
  crownFloater: { alignItems: "center", marginBottom: 4 },
  heroAvatar: {
    width: 44,
    height: 44,
    borderRadius: 16,
    backgroundColor: "rgba(255,255,255,0.22)",
    alignItems: "center",
    justifyContent: "center",
    alignSelf: "center",
    marginTop: 6,
    marginBottom: 4,
  },
  heroAvatarLegend: {
    borderWidth: 2,
    borderColor: "rgba(255,215,0,0.95)",
    shadowColor: "#FFD700",
    shadowOpacity: 0.5,
    shadowRadius: 10,
    elevation: 4,
  },
  topMedal: { fontSize: 18, fontWeight: "900" },
  topName: { color: "#fff", fontWeight: "900", marginTop: 6 },
  topMeta: { color: "rgba(255,255,255,0.85)", fontWeight: "800", fontSize: 11, marginTop: 4 },
  topPts: { color: "#fff", fontWeight: "900", fontSize: 12, marginTop: 6 },
  row: { flexDirection: "row", alignItems: "center", gap: 10, padding: 14, borderRadius: 18, borderWidth: 1, marginBottom: 10 },
  rank: { width: 24, textAlign: "center", fontWeight: "900" },
  avatarWrap: { position: "relative" },
  avatarLegendShell: {
    width: 38,
    height: 38,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    overflow: "hidden",
  },
  avatarLegend: {
    borderWidth: 2,
    borderColor: "#FFD700",
    shadowColor: "#FFD700",
    shadowOpacity: 0.35,
    shadowRadius: 8,
    elevation: 3,
  },
  avatarCrownBadge: {
    position: "absolute",
    top: -6,
    right: -4,
    backgroundColor: "rgba(15,23,42,0.9)",
    borderRadius: 999,
    padding: 2,
  },
  name: { fontWeight: "900" },
  meta: { marginTop: 2, fontWeight: "700", fontSize: 12 },
  founderMini: { width: 24, height: 24, borderRadius: 10, alignItems: "center", justifyContent: "center" },
});

