import { useCallback, useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  Modal,
  Platform,
  RefreshControl,
  ScrollView,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView, useSafeAreaInsets } from "react-native-safe-area-context";
import DateTimePicker from "@react-native-community/datetimepicker";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";

import { apiClient } from "../src/utils/apiClient";
import { useTheme } from "../src/theme/ThemeContext";

type CalendarBlock = {
  id: number;
  user_id: number;
  starts_on: string;
  ends_on: string;
  kind: "away" | "guest";
  reason_emoji?: string | null;
};

const TRIP_REASONS: { emoji: string; label: string }[] = [
  { emoji: "🏠", label: "Family" },
  { emoji: "🏖️", label: "Vacation" },
  { emoji: "💼", label: "Work" },
];

type SummaryRow = { away_days: number; guest_extra_days: number };

function fmtLocalYmd(d: Date): string {
  const y = d.getFullYear();
  const m = (d.getMonth() + 1).toString().padStart(2, "0");
  const day = d.getDate().toString().padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function parseYmd(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, (m || 1) - 1, d || 1);
}

function formatMonthLong(ym: string) {
  return new Date(ym + "-02").toLocaleString("default", {
    month: "long",
    year: "numeric",
  });
}

export default function WhosHomeScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isDark } = useTheme();

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#0F172A",
    sub: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    primary: "#FF6A6A",
    accent: "#6366F1",
  };

  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [monthKey, setMonthKey] = useState(
    () => new Date().toISOString().slice(0, 7),
  );
  const [mates, setMates] = useState<{ id: string; name: string }[]>([]);
  const [blocks, setBlocks] = useState<CalendarBlock[]>([]);
  const [summary, setSummary] = useState<Record<string, SummaryRow>>({});

  const [addOpen, setAddOpen] = useState(false);
  const [kind, setKind] = useState<"away" | "guest">("away");
  const [mateId, setMateId] = useState<string | null>(null);
  const [startDate, setStartDate] = useState(() => new Date());
  const [endDate, setEndDate] = useState(() => new Date());
  const [picker, setPicker] = useState<"start" | "end" | null>(null);
  const [saving, setSaving] = useState(false);
  const [reasonEmoji, setReasonEmoji] = useState<string | null>(null);

  const nameById = useMemo(() => {
    const m: Record<string, string> = {};
    for (const x of mates) m[String(x.id)] = x.name;
    return m;
  }, [mates]);

  const load = useCallback(async () => {
    const token = await AsyncStorage.getItem("token");
    if (!token) return;
    const [dash, cal] = await Promise.all([
      apiClient("/dashboard", "GET", undefined, token),
      apiClient(
        `/house/calendar?month=${encodeURIComponent(monthKey)}`,
        "GET",
        undefined,
        token,
      ),
    ]);
    setMates(dash?.mates || []);
    setBlocks(cal?.blocks || []);
    const raw = cal?.summary || {};
    const norm: Record<string, SummaryRow> = {};
    for (const [k, v] of Object.entries(raw)) {
      const row = v as any;
      norm[k] = {
        away_days: Number(row?.away_days ?? 0),
        guest_extra_days: Number(row?.guest_extra_days ?? 0),
      };
    }
    setSummary(norm);
  }, [monthKey]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        await load();
      } catch (e) {
        console.warn(e);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [load]);

  const onRefresh = async () => {
    setRefreshing(true);
    try {
      await load();
    } finally {
      setRefreshing(false);
    }
  };

  const handleMonthStep = (step: number) => {
    const [year, monthNum] = monthKey.split("-").map(Number);
    const date = new Date(year, monthNum - 1 + step, 1);
    setMonthKey(
      `${date.getFullYear()}-${(date.getMonth() + 1).toString().padStart(2, "0")}`,
    );
  };

  const openAdd = () => {
    const first = mates[0]?.id ?? null;
    setMateId(first);
    setKind("away");
    setReasonEmoji(null);
    const t = new Date();
    setStartDate(t);
    setEndDate(t);
    setAddOpen(true);
  };

  const saveBlock = async () => {
    if (!mateId) {
      Alert.alert("Choose someone", "Pick a housemate for this schedule.");
      return;
    }
    if (fmtLocalYmd(endDate) < fmtLocalYmd(startDate)) {
      Alert.alert("Dates", "End date must be on or after start.");
      return;
    }
    setSaving(true);
    try {
      const token = await AsyncStorage.getItem("token");
      await apiClient(
        "/house/calendar",
        "POST",
        {
          user_id: Number(mateId),
          starts_on: fmtLocalYmd(startDate),
          ends_on: fmtLocalYmd(endDate),
          kind,
          ...(reasonEmoji ? { reason_emoji: reasonEmoji } : {}),
        },
        token!,
      );
      setAddOpen(false);
      await load();
    } catch (e: any) {
      Alert.alert("Could not save", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  };

  const deleteBlock = (b: CalendarBlock) => {
    Alert.alert(
      "Remove schedule",
      `${nameById[String(b.user_id)] ?? "Mate"} · ${b.starts_on} → ${b.ends_on}`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: async () => {
            try {
              const token = await AsyncStorage.getItem("token");
              await apiClient(`/house/calendar/${b.id}`, "DELETE", undefined, token!);
              await load();
            } catch (e: any) {
              Alert.alert("Error", e?.message ?? "Could not delete");
            }
          },
        },
      ],
    );
  };

  const monthBlocks = useMemo(() => {
    const [y, m] = monthKey.split("-").map(Number);
    const start = new Date(y, m - 1, 1);
    const end = new Date(y, m, 0);
    const es = start.getTime();
    const ee = end.getTime();
    return blocks.filter((b) => {
      const bs = parseYmd(b.starts_on).getTime();
      const be = parseYmd(b.ends_on).getTime();
      return bs <= ee && be >= es;
    });
  }, [blocks, monthKey]);

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <ActivityIndicator style={{ marginTop: 40 }} color={colors.primary} />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]} edges={["top"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => (router.canGoBack() ? router.back() : router.replace("/(tabs)/mates"))}
          style={styles.circularBackBtn}
        >
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>
        <View style={styles.headerTitleContainer}>
          <View style={styles.monthToggleRow}>
            <TouchableOpacity onPress={() => handleMonthStep(-1)} hitSlop={15}>
              <MaterialIcons name="chevron-left" size={28} color={colors.primary} />
            </TouchableOpacity>
            <View style={styles.titleCenter}>
              <Text style={[styles.screenTitle, { color: colors.text }]}>Who's Home</Text>
              <Text style={[styles.screenSubtitle, { color: colors.sub }]}>
                {formatMonthLong(monthKey)}
              </Text>
            </View>
            <TouchableOpacity onPress={() => handleMonthStep(1)} hitSlop={15}>
              <MaterialIcons name="chevron-right" size={28} color={colors.primary} />
            </TouchableOpacity>
          </View>
        </View>
        <View style={{ width: 42 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={colors.primary} />
        }
      >
        <View style={[styles.hero, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <FontAwesome5 name="home" size={22} color={colors.primary} />
          <View style={{ flex: 1, marginLeft: 12 }}>
            <Text style={[styles.heroTitle, { color: colors.text }]}>
              Vacation & guest days
            </Text>
            <Text style={[styles.heroBody, { color: colors.sub }]}>
              Away blocks lower utility shares for those dates. Plus One adds extra person-days so
              that roommate pays a bit more while their guest is around.
            </Text>
          </View>
        </View>

        <TouchableOpacity
          style={[styles.coralCta, { backgroundColor: colors.primary }]}
          onPress={openAdd}
          activeOpacity={0.9}
        >
          <FontAwesome5 name="plane-departure" size={16} color="#fff" />
          <Text style={styles.coralCtaText}>Plan absence or guest stay</Text>
        </TouchableOpacity>

        <Text style={[styles.sectionLabel, { color: colors.sub }]}>This month (per person)</Text>
        {mates.length === 0 ? (
          <Text style={{ color: colors.sub }}>No housemates loaded.</Text>
        ) : (
          mates.map((m) => {
            const s = summary[String(m.id)] ?? summary[m.id] ?? {
              away_days: 0,
              guest_extra_days: 0,
            };
            const away = s.away_days ?? 0;
            const gx = s.guest_extra_days ?? 0;
            return (
              <View
                key={m.id}
                style={[styles.personRow, { backgroundColor: colors.card, borderColor: colors.border }]}
              >
                <View style={[styles.avatar, { backgroundColor: colors.primary + "18" }]}>
                  <Text style={[styles.avatarTxt, { color: colors.primary }]}>
                    {m.name?.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                    {m.name}
                  </Text>
                  <Text style={[styles.personMeta, { color: colors.sub }]}>
                    {away > 0 ? `${away} day${away === 1 ? "" : "s"} away` : "Home"}
                    {gx > 0
                      ? ` · +${gx} guest day${gx === 1 ? "" : "s"}`
                      : ""}
                  </Text>
                </View>
                {away > 0 ? (
                  <Text style={{ fontSize: 18 }} accessibilityLabel="Away">
                    ✈️
                  </Text>
                ) : null}
                {gx > 0 ? (
                  <Text style={{ fontSize: 18, marginLeft: 4 }} accessibilityLabel="Guest">
                    👥
                  </Text>
                ) : null}
              </View>
            );
          })
        )}

        <View style={styles.rowBetween}>
          <Text style={[styles.sectionLabel, { color: colors.sub, marginBottom: 0 }]}>
            Scheduled ranges
          </Text>
          <TouchableOpacity
            onPress={openAdd}
            style={[styles.addBtn, { backgroundColor: colors.primary + "22" }]}
          >
            <MaterialIcons name="add" size={20} color={colors.primary} />
            <Text style={{ color: colors.primary, fontWeight: "800", fontSize: 13 }}>Add</Text>
          </TouchableOpacity>
        </View>

        {monthBlocks.length === 0 ? (
          <Text style={{ color: colors.sub, marginBottom: 16 }}>
            Nothing overlapping {formatMonthLong(monthKey)}. Add a trip or guest stay above.
          </Text>
        ) : (
          monthBlocks.map((b) => (
            <TouchableOpacity
              key={b.id}
              onLongPress={() => deleteBlock(b)}
              activeOpacity={0.85}
              style={[styles.blockRow, { backgroundColor: colors.card, borderColor: colors.border }]}
            >
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[styles.blockTitle, { color: colors.text }]} numberOfLines={1}>
                  {nameById[String(b.user_id)] ?? `User ${b.user_id}`}
                </Text>
                <Text style={[styles.blockMeta, { color: colors.sub }]}>
                  {b.reason_emoji ? `${b.reason_emoji} · ` : ""}
                  {b.starts_on} → {b.ends_on} · {b.kind === "away" ? "Away" : "Plus One"}
                </Text>
              </View>
              <TouchableOpacity onPress={() => deleteBlock(b)} hitSlop={10}>
                <MaterialIcons name="delete-outline" size={22} color="#EF4444" />
              </TouchableOpacity>
            </TouchableOpacity>
          ))
        )}

        <Text style={[styles.hint, { color: colors.sub }]}>
          Long-press or tap delete on a row to remove. Variable bills that use “Split by days” pick
          this up automatically.
        </Text>
      </ScrollView>

      <Modal visible={addOpen} animationType="slide" transparent>
        <View style={styles.modalOverlay}>
          <View
            style={[
              styles.modalCard,
              { backgroundColor: colors.card, paddingBottom: 20 + insets.bottom },
            ]}
          >
            <ScrollView
              keyboardShouldPersistTaps="handled"
              showsVerticalScrollIndicator={false}
              bounces={false}
              contentContainerStyle={styles.modalScrollContent}
            >
            <Text style={[styles.modalTitle, { color: colors.text }]}>New schedule</Text>

            <Text style={[styles.fieldLbl, { color: colors.sub }]}>Type</Text>
            <View style={styles.kindRow}>
              {(
                [
                  { id: "away" as const, label: "Away", icon: "plane" as const },
                  { id: "guest" as const, label: "Plus One", icon: "user-plus" as const },
                ]
              ).map((k) => (
                <TouchableOpacity
                  key={k.id}
                  onPress={() => setKind(k.id)}
                  style={[
                    styles.kindChip,
                    {
                      borderColor: kind === k.id ? colors.primary : colors.border,
                      backgroundColor: kind === k.id ? colors.primary + "18" : "transparent",
                    },
                  ]}
                >
                  <FontAwesome5
                    name={k.icon}
                    size={14}
                    color={kind === k.id ? colors.primary : colors.sub}
                  />
                  <Text
                    style={{
                      marginLeft: 8,
                      fontWeight: "800",
                      color: kind === k.id ? colors.primary : colors.text,
                    }}
                  >
                    {k.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.fieldLbl, { color: colors.sub }]}>Who</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 12 }}>
              <View style={{ flexDirection: "row", gap: 8 }}>
                {mates.map((m) => (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => setMateId(m.id)}
                    style={[
                      styles.mateChip,
                      {
                        borderColor: mateId === m.id ? colors.primary : colors.border,
                        backgroundColor: mateId === m.id ? colors.primary + "15" : "transparent",
                      },
                    ]}
                  >
                    <Text
                      style={{
                        fontWeight: "700",
                        color: mateId === m.id ? colors.primary : colors.text,
                      }}
                    >
                      {m.name}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text style={[styles.fieldLbl, { color: colors.sub }]}>Start</Text>
            <TouchableOpacity
              style={[styles.dateBtn, { borderColor: colors.border }]}
              onPress={() => setPicker("start")}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{fmtLocalYmd(startDate)}</Text>
            </TouchableOpacity>

            <Text style={[styles.fieldLbl, { color: colors.sub }]}>End</Text>
            <TouchableOpacity
              style={[styles.dateBtn, { borderColor: colors.border }]}
              onPress={() => setPicker("end")}
            >
              <Text style={{ color: colors.text, fontWeight: "700" }}>{fmtLocalYmd(endDate)}</Text>
            </TouchableOpacity>

            <Text style={[styles.fieldLbl, { color: colors.sub }]}>Reason (optional)</Text>
            <View style={styles.reasonRow}>
              {TRIP_REASONS.map((r) => (
                <TouchableOpacity
                  key={r.emoji}
                  onPress={() =>
                    setReasonEmoji((prev) => (prev === r.emoji ? null : r.emoji))
                  }
                  style={[
                    styles.reasonChip,
                    {
                      borderColor: reasonEmoji === r.emoji ? colors.primary : colors.border,
                      backgroundColor:
                        reasonEmoji === r.emoji ? colors.primary + "20" : "transparent",
                    },
                  ]}
                >
                  <Text style={{ fontSize: 22 }}>{r.emoji}</Text>
                  <Text
                    style={{
                      marginLeft: 6,
                      fontWeight: "800",
                      fontSize: 12,
                      color: reasonEmoji === r.emoji ? colors.primary : colors.sub,
                    }}
                  >
                    {r.label}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={[styles.logicNote, { color: colors.sub }]}>
              HabiMate will automatically adjust variable bills (utilities, water, groceries) that use
              “Split by days” for these dates — rent stays even if you travel.
            </Text>

            {picker && (
              <>
                {Platform.OS === "ios" && (
                  <TouchableOpacity
                    style={{ alignSelf: "flex-end", marginBottom: 8 }}
                    onPress={() => setPicker(null)}
                  >
                    <Text style={{ color: colors.primary, fontWeight: "800" }}>Done</Text>
                  </TouchableOpacity>
                )}
                <DateTimePicker
                  value={picker === "start" ? startDate : endDate}
                  mode="date"
                  display={Platform.OS === "ios" ? "spinner" : "default"}
                  onChange={(event, date) => {
                    if (Platform.OS === "android") setPicker(null);
                    if (!date) return;
                    if (picker === "start") setStartDate(date);
                    else setEndDate(date);
                  }}
                />
              </>
            )}
            </ScrollView>

            <View style={[styles.modalActions, { borderTopColor: colors.border }]}>
              <TouchableOpacity
                onPress={() => setAddOpen(false)}
                style={[styles.btnGhost, { borderColor: colors.border }]}
              >
                <Text style={{ color: colors.text, fontWeight: "700" }}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                onPress={saveBlock}
                disabled={saving}
                style={[styles.btnPrimary, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
              >
                {saving ? (
                  <ActivityIndicator color="#fff" />
                ) : (
                  <Text style={{ color: "#fff", fontWeight: "800" }}>Save</Text>
                )}
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  circularBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FF6A6A",
    justifyContent: "center",
    alignItems: "center",
  },
  headerTitleContainer: { flex: 1, alignItems: "center" },
  monthToggleRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  titleCenter: { alignItems: "center" },
  screenTitle: { fontSize: 20, fontWeight: "900" },
  screenSubtitle: { fontSize: 11, fontWeight: "700", textTransform: "uppercase", marginTop: 2 },
  scroll: { paddingHorizontal: 20, paddingBottom: 40 },
  hero: {
    flexDirection: "row",
    alignItems: "flex-start",
    padding: 16,
    borderRadius: 18,
    borderWidth: 1,
    marginBottom: 20,
  },
  heroTitle: { fontWeight: "900", fontSize: 16, marginBottom: 6 },
  heroBody: { fontSize: 13, lineHeight: 19, fontWeight: "600" },
  coralCta: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 10,
    paddingVertical: 16,
    borderRadius: 16,
    marginBottom: 20,
  },
  coralCtaText: { color: "#fff", fontWeight: "900", fontSize: 16, letterSpacing: -0.2 },
  sectionLabel: {
    fontSize: 11,
    fontWeight: "800",
    letterSpacing: 0.8,
    textTransform: "uppercase",
    marginBottom: 10,
  },
  personRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 10,
  },
  avatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    alignItems: "center",
    justifyContent: "center",
    marginRight: 12,
  },
  avatarTxt: { fontSize: 18, fontWeight: "900" },
  personName: { fontSize: 16, fontWeight: "800" },
  personMeta: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginTop: 8,
    marginBottom: 10,
  },
  addBtn: {
    flexDirection: "row",
    alignItems: "center",
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
  },
  blockRow: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 8,
  },
  blockTitle: { fontSize: 15, fontWeight: "800" },
  blockMeta: { fontSize: 12, fontWeight: "600", marginTop: 2 },
  hint: { fontSize: 12, fontWeight: "600", marginTop: 16, lineHeight: 18 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalCard: {
    borderTopLeftRadius: 22,
    borderTopRightRadius: 22,
    paddingHorizontal: 20,
    paddingTop: 20,
    maxHeight: "92%",
  },
  modalScrollContent: { paddingBottom: 12 },
  modalTitle: { fontSize: 20, fontWeight: "900", marginBottom: 16 },
  fieldLbl: { fontSize: 11, fontWeight: "800", marginBottom: 8, textTransform: "uppercase" },
  reasonRow: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: 12 },
  reasonChip: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  logicNote: { fontSize: 12, fontWeight: "600", lineHeight: 17, marginBottom: 8 },
  kindRow: { flexDirection: "row", gap: 10, marginBottom: 14 },
  kindChip: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 14,
    borderWidth: 1,
  },
  mateChip: {
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 12,
    borderWidth: 1,
  },
  dateBtn: {
    borderWidth: 1,
    borderRadius: 12,
    paddingVertical: 12,
    paddingHorizontal: 14,
    marginBottom: 12,
  },
  modalActions: {
    flexDirection: "row",
    gap: 12,
    marginTop: 12,
    paddingTop: 12,
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  btnGhost: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
  },
  btnPrimary: {
    flex: 1,
    alignItems: "center",
    paddingVertical: 14,
    borderRadius: 14,
  },
});
