import { useLocalSearchParams, useRouter } from "expo-router";
import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { apiClient } from "../../src/utils/apiClient";
import { splitEqualCents } from "../../src/utils/expenseSplit";
import {
  parseMoneyAmount,
  sanitizeMoneyAmountInput,
} from "../../src/utils/moneyAmount";
import { useTheme } from "../../src/theme/ThemeContext";
import { SplitRoundingNote } from "../../src/components/SplitRoundingNote";

type Mate = { id: number; name?: string; email?: string };

const getCurrentMonth = () => {
  const now = new Date();
  return `${now.getFullYear()}-${(now.getMonth() + 1)
    .toString()
    .padStart(2, "0")}`;
};

export default function NewBuyback() {
  const router = useRouter();
  const raw = useLocalSearchParams<{ month?: string }>();
  const month = raw.month ?? getCurrentMonth();
  const { isDark } = useTheme();

  const colors = useMemo(
    () => ({
      bg: isDark ? "#0F172A" : "#F8FAFC",
      card: isDark ? "#111C33" : "#FFFFFF",
      text: isDark ? "#F1F5F9" : "#0F172A",
      sub: isDark ? "#94A3B8" : "#64748B",
      border: isDark ? "rgba(255,255,255,0.10)" : "#E2E8F0",
      primary: "#FF6A6A",
      teal: "#2EC4B6",
    }),
    [isDark],
  );

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [mates, setMates] = useState<Mate[]>([]);
  const [meId, setMeId] = useState<number | null>(null);

  const [title, setTitle] = useState("Router buy-back");
  const [note, setNote] = useState("");
  const [amount, setAmount] = useState("60");
  const [selected, setSelected] = useState<Record<number, boolean>>({});

  useEffect(() => {
    const boot = async () => {
      try {
        const rawUser = await AsyncStorage.getItem("user");
        if (rawUser) {
          const u = JSON.parse(rawUser);
          const id = Number(u?.id);
          if (Number.isFinite(id)) setMeId(id);
        }

        const res = await apiClient("/mates", "GET");
        const list: Mate[] = [];
        if (res?.admin?.id) list.push(res.admin);
        if (Array.isArray(res?.approved)) list.push(...res.approved);
        const uniq = new Map<number, Mate>();
        list.forEach((m: any) => {
          const id = Number(m?.id);
          if (!Number.isFinite(id)) return;
          uniq.set(id, { id, name: m?.name, email: m?.email });
        });
        const arr = Array.from(uniq.values());
        setMates(arr);

        const nextSel: Record<number, boolean> = {};
        arr.forEach((m) => {
          if (meId != null && m.id === meId) return;
          nextSel[m.id] = true;
        });
        setSelected(nextSel);
      } catch (e: any) {
        Alert.alert("Could not load mates", e?.message ?? "Try again.");
      } finally {
        setLoading(false);
      }
    };
    void boot();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const participantIds = Object.entries(selected)
    .filter(([, on]) => on)
    .map(([id]) => Number(id))
    .filter((id) => Number.isFinite(id) && (meId == null || id !== meId));

  const parsedAmount = parseMoneyAmount(amount);
  const shareMap =
    participantIds.length > 0 && Number.isFinite(parsedAmount) && parsedAmount > 0
      ? splitEqualCents(parsedAmount, participantIds)
      : {};
  const shareValues = Object.values(shareMap);
  const shareMin = shareValues.length ? Math.min(...shareValues) : 0;
  const shareMax = shareValues.length ? Math.max(...shareValues) : 0;

  const toggle = (id: number) => {
    setSelected((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const onSave = async () => {
    const amt = parseMoneyAmount(amount);
    if (!title.trim()) {
      Alert.alert("Add a title", "Example: Router buy-back, Shared supplies.");
      return;
    }
    if (!Number.isFinite(amt) || amt <= 0) {
      Alert.alert("Invalid amount", "Enter a positive number.");
      return;
    }
    if (participantIds.length === 0) {
      Alert.alert("Pick participants", "Select who should reimburse this buy-back.");
      return;
    }

    setSaving(true);
    try {
      await apiClient("/buybacks", "POST", {
        title: title.trim(),
        note: note.trim() || null,
        month,
        amount: amt,
        participant_user_ids: participantIds,
      });
      Alert.alert("Created", "Buy-back rows added to Settlements.", [
        { text: "OK", onPress: () => router.back() },
      ]);
    } catch (e: any) {
      Alert.alert("Could not create buy-back", e?.message ?? "Try again.");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
        <View style={styles.center}>
          <ActivityIndicator color={colors.primary} />
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={[styles.safe, { backgroundColor: colors.bg }]}>
      <View style={styles.header}>
        <TouchableOpacity
          style={[styles.backBtn, { backgroundColor: colors.primary }]}
          onPress={() => router.back()}
        >
          <MaterialCommunityIcons name="chevron-left" size={22} color="#fff" />
        </TouchableOpacity>
        <View style={{ flex: 1, alignItems: "center" }}>
          <Text style={[styles.title, { color: colors.text }]}>Stock buy-back</Text>
          <Text style={[styles.sub, { color: colors.sub }]}>{month}</Text>
        </View>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.sub }]}>What is this?</Text>
          <Text style={[styles.help, { color: colors.text }]}>
            Record a clean transfer when the house buys shared supplies (or when someone moves out).
            This creates settlement rows so nobody’s left holding the bag.
          </Text>
        </View>

        <View style={[styles.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
          <Text style={[styles.label, { color: colors.sub }]}>Title</Text>
          <TextInput
            value={title}
            onChangeText={setTitle}
            placeholder="Router buy-back"
            placeholderTextColor={colors.sub}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.sub, marginTop: 14 }]}>Total amount</Text>
          <TextInput
            value={amount}
            onChangeText={(t) => setAmount(sanitizeMoneyAmountInput(t))}
            keyboardType="decimal-pad"
            inputMode="decimal"
            placeholder="60"
            placeholderTextColor={colors.sub}
            style={[styles.input, { color: colors.text, borderColor: colors.border }]}
          />

          <Text style={[styles.label, { color: colors.sub, marginTop: 14 }]}>Note (optional)</Text>
          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="Bought on Apr 10. Keep it fair."
            placeholderTextColor={colors.sub}
            style={[styles.input, styles.inputMultiline, { color: colors.text, borderColor: colors.border }]}
            multiline
          />

          <View style={{ marginTop: 14 }}>
            <Text style={[styles.label, { color: colors.sub }]}>Who reimburses?</Text>
            {mates
              .filter((m) => (meId == null ? true : m.id !== meId))
              .map((m) => {
                const on = !!selected[m.id];
                return (
                  <TouchableOpacity
                    key={m.id}
                    onPress={() => toggle(m.id)}
                    style={[
                      styles.mateRow,
                      { borderColor: colors.border, backgroundColor: on ? colors.teal + "12" : "transparent" },
                    ]}
                    activeOpacity={0.85}
                  >
                    <MaterialCommunityIcons
                      name={on ? "checkbox-marked-circle" : "checkbox-blank-circle-outline"}
                      size={20}
                      color={on ? colors.teal : colors.sub}
                    />
                    <Text style={[styles.mateName, { color: colors.text }]}>
                      {m.name ?? `User ${m.id}`}
                    </Text>
                  </TouchableOpacity>
                );
              })}

            <Text style={[styles.calc, { color: colors.sub }]}>
              Split preview: {participantIds.length} people ·{" "}
              {shareValues.length === 0
                ? "—"
                : shareMin === shareMax
                  ? `${shareMin.toFixed(2)} each`
                  : `${shareMin.toFixed(2)}–${shareMax.toFixed(2)} each (cent split)`}{" "}
              · total {Number.isFinite(parsedAmount) ? parsedAmount.toFixed(2) : "0.00"}
            </Text>
            {participantIds.length >= 2 && (
              <SplitRoundingNote
                textColor={colors.text}
                subColor={colors.sub}
                borderColor={colors.border}
                bgColor={isDark ? "#0f172a" : "#f8fafc"}
                accent={colors.teal}
                compact
                showFeatureGuideLink
              />
            )}
          </View>
        </View>

        <TouchableOpacity
          style={[styles.saveBtn, { backgroundColor: colors.primary, opacity: saving ? 0.7 : 1 }]}
          onPress={onSave}
          disabled={saving}
          activeOpacity={0.9}
        >
          {saving ? (
            <ActivityIndicator color="#fff" />
          ) : (
            <>
              <MaterialCommunityIcons name="content-save" size={18} color="#fff" />
              <Text style={styles.saveText}>Create buy-back rows</Text>
            </>
          )}
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    paddingVertical: 12,
  },
  backBtn: {
    width: 40,
    height: 40,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  title: { fontSize: 18, fontWeight: "900", letterSpacing: -0.3 },
  sub: { fontSize: 11, fontWeight: "800", textTransform: "uppercase" },
  content: { padding: 16, paddingBottom: 28, gap: 12 },
  card: {
    borderWidth: 1,
    borderRadius: 16,
    padding: 14,
  },
  label: { fontSize: 12, fontWeight: "900", textTransform: "uppercase" },
  help: { marginTop: 8, fontSize: 14, lineHeight: 20 },
  input: {
    marginTop: 8,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 15,
    fontWeight: "700",
  },
  inputMultiline: { minHeight: 90, textAlignVertical: "top" },
  mateRow: {
    marginTop: 10,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
  },
  mateName: { fontSize: 14, fontWeight: "800" },
  calc: { marginTop: 10, fontSize: 12, fontWeight: "700" },
  saveBtn: {
    marginTop: 6,
    height: 54,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    flexDirection: "row",
    gap: 10,
  },
  saveText: { color: "#fff", fontSize: 15, fontWeight: "900" },
});

