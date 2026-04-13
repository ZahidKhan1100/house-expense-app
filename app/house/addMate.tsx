import { useRouter } from "expo-router";
import { useEffect, useState } from "react";
import {
  Alert,
  FlatList,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import { apiClient } from "../../src/utils/apiClient";
import { useTheme } from "../theme/ThemeContext";

export default function ManageMates() {
  const { isDark } = useTheme();
  const router = useRouter();

  const [mates, setMates] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [houseCode, setHouseCode] = useState("");
  const [loading, setLoading] = useState(true);

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#0F172A",
    sub: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    primary: "#FF6A6A",
  };

  useEffect(() => {
    fetchMates();
  }, []);

  const fetchMates = async () => {
    try {
      const data = await apiClient("/mates", "GET");
      const combined = [
        data.admin ? { ...data.admin, isAdmin: true } : null,
        ...data.approved.map((m: any) => ({ ...m, isAdmin: false })),
      ].filter(Boolean);

      setMates(combined);
      setIsAdmin(data.is_admin);
      setHouseCode(data.house.house_code || "");
    } catch (err) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    // If we can't go back (like after a refresh), jump to the main Dashboard
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/dashboard");
    }
  };

  const removeMate = async (mate: any) => {
    if (!isAdmin) return;

    // Web-friendly Alert check
    const confirmMsg = `Remove ${mate.name} from house?`;
    if (Platform.OS === "web") {
      if (!window.confirm(confirmMsg)) return;
      processRemoval(mate.id);
    } else {
      Alert.alert("Remove Mate", confirmMsg, [
        { text: "Cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => processRemoval(mate.id),
        },
      ]);
    }
  };

  const processRemoval = async (id: string) => {
    try {
      await apiClient(`/mates/${id}`, "DELETE");
      setMates((prev) => prev.filter((m) => m.id !== id));
      if (Platform.OS !== "web") Alert.alert("Success", "Mate removed");
    } catch (err) {
      Alert.alert("Error", "Could not remove mate");
    }
  };

  const renderMate = ({ item }: any) => (
    <View
      style={[
        styles.mateCard,
        { backgroundColor: colors.card, borderColor: colors.border },
      ]}
    >
      <View
        style={[
          styles.avatarCircle,
          {
            backgroundColor: item.isAdmin ? "#FFD70020" : colors.primary + "15",
          },
        ]}
      >
        <FontAwesome5
          name={item.isAdmin ? "crown" : "user"}
          size={14}
          color={item.isAdmin ? "#F59E0B" : colors.primary}
        />
      </View>

      <View style={{ flex: 1, marginLeft: 15 }}>
        <Text style={[styles.mateText, { color: colors.text }]}>
          {item.name}{" "}
          {item.isAdmin && <Text style={styles.adminTag}> (Admin)</Text>}
        </Text>
        <Text style={[styles.mateEmail, { color: colors.sub }]}>
          {item.email}
        </Text>
      </View>

      {isAdmin && !item.isAdmin && (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeMate(item)}
        >
          <MaterialIcons name="person-remove" size={20} color="#EF4444" />
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      {/* --- PREMIUM HEADER --- */}
      <View style={styles.newHeader}>
        <TouchableOpacity onPress={handleBack} style={styles.circularBackBtn}>
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            House Mates
          </Text>
          <Text style={[styles.screenSubtitle, { color: colors.sub }]}>
            {mates.length} Members active
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.headerActionBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/invite-qr")}
        >
          <FontAwesome5 name="qrcode" size={16} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <View style={{ flex: 1, paddingHorizontal: 20 }}>
        {/* QR Invite Card */}
        <TouchableOpacity
          style={[styles.qrBanner, { backgroundColor: colors.primary }]}
          onPress={() => router.push("/invite-qr")}
        >
          <View style={styles.qrContent}>
            <FontAwesome5 name="user-plus" size={20} color="#fff" />
            <Text style={styles.qrText}>Invite New Mate via QR</Text>
          </View>
          <MaterialIcons name="chevron-right" size={24} color="#fff" />
        </TouchableOpacity>

        <FlatList
          data={mates}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMate}
          showsVerticalScrollIndicator={false}
          ListEmptyComponent={
            <View style={styles.emptyContainer}>
              <Text style={{ color: colors.sub }}>No mates found.</Text>
            </View>
          }
        />

        {/* House Code Footer */}
        <View
          style={[
            styles.codeCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <Text style={[styles.codeLabel, { color: colors.sub }]}>
            HOUSE INVITE CODE
          </Text>
          <Text style={styles.houseCode}>{houseCode}</Text>
          <Text style={styles.note}>
            Mates can enter this code during signup
          </Text>
        </View>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  // Header Styles
  newHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 20,
    paddingVertical: 15,
  },
  circularBackBtn: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#FF6A6A",
    justifyContent: "center",
    alignItems: "center",
    elevation: 4,
    shadowColor: "#FF6A6A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 5,
  },
  headerTitleContainer: { flex: 1, marginLeft: 15 },
  screenTitle: { fontSize: 24, fontWeight: "900", letterSpacing: -0.5 },
  screenSubtitle: { fontSize: 12, fontWeight: "600", marginTop: -2 },
  headerActionBtn: {
    width: 42,
    height: 42,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    borderWidth: 1,
  },

  // QR Banner
  qrBanner: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    elevation: 4,
    shadowColor: "#FF6A6A",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.2,
    shadowRadius: 8,
  },
  qrContent: { flexDirection: "row", alignItems: "center" },
  qrText: { color: "#fff", fontWeight: "800", marginLeft: 12, fontSize: 16 },

  // Mate Card
  mateCard: {
    flexDirection: "row",
    padding: 12,
    borderRadius: 16,
    marginBottom: 10,
    alignItems: "center",
    borderWidth: 1,
  },
  avatarCircle: {
    width: 44,
    height: 44,
    borderRadius: 14,
    justifyContent: "center",
    alignItems: "center",
  },
  mateText: { fontSize: 16, fontWeight: "700" },
  adminTag: { color: "#F59E0B", fontSize: 12, fontWeight: "800" },
  mateEmail: { fontSize: 13, marginTop: 2 },
  removeBtn: { padding: 8 },

  // Footer / House Code
  codeCard: {
    padding: 20,
    borderRadius: 24,
    alignItems: "center",
    borderWidth: 1,
    marginBottom: 60,
    marginTop: 10,
  },
  codeLabel: { fontSize: 10, fontWeight: "800", letterSpacing: 1 },
  houseCode: {
    fontSize: 32,
    fontWeight: "900",
    color: "#FF6A6A",
    marginVertical: 5,
  },
  note: { fontSize: 12, color: "#666", textAlign: "center" },
  emptyContainer: { alignItems: "center", marginTop: 40 },
});
