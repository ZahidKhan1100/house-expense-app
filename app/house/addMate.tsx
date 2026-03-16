import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  FlatList,
  TouchableOpacity,
  StyleSheet,
  Alert,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import { apiClient } from "../../src/utils/apiClient";
import { useTheme } from "../theme/ThemeContext";

export default function AddMate() {
  const { isDark } = useTheme();
  const router = useRouter();

  const [mates, setMates] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [houseCode, setHouseCode] = useState("");
  const [token, setToken] = useState<string>("");

  useEffect(() => {
    fetchMates();
  }, []);

  const fetchMates = async () => {
    try {
      const data = await apiClient("/mates", "GET", undefined, token);

      const combined = [
        data.admin ? { ...data.admin, isAdmin: true } : null,
        ...data.approved.map((m: any) => ({
          ...m,
          isAdmin: false,
        })),
      ].filter(Boolean);

      console.log("data",data);
      

      setMates(combined);
      setIsAdmin(data.is_admin);
      setHouseCode(data.house_code || "");
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load mates");
    }
  };

  // ---------- Delete mate (admin only) ----------
  const removeMate = async (mate: any) => {
    if (!isAdmin) return;

    Alert.alert("Remove Mate", `Remove ${mate.name} from house?`, [
      { text: "Cancel" },
      {
        text: "Remove",
        style: "destructive",
        onPress: async () => {
          try {
            await apiClient(`/mates/${mate.id}`, "DELETE", undefined, token);

            setMates((prev) => prev.filter((m) => m.id !== mate.id));

            Alert.alert("Success", "Mate removed");
          } catch (err) {
            Alert.alert("Error", "Could not remove mate");
          }
        },
      },
    ]);
  };

  // ---------- Render mate ----------
  const renderMate = ({ item }: any) => (
    <View
      style={[
        styles.mateCard,
        { backgroundColor: isDark ? "#1F2937" : "#FFEAEA" },
      ]}
    >
      <View>
        <Text
          style={[styles.mateText, { color: isDark ? "#F3F4F6" : "#111827" }]}
        >
          {item.name}
          {item.isAdmin && " (Admin)"}
        </Text>

        <Text style={{ color: isDark ? "#9CA3AF" : "#666" }}>{item.email}</Text>
      </View>

      {isAdmin && !item.isAdmin && (
        <TouchableOpacity
          style={styles.removeBtn}
          onPress={() => removeMate(item)}
        >
          <Text style={styles.removeText}>Remove</Text>
        </TouchableOpacity>
      )}
    </View>
  );

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#111827" : "#fff" },
      ]}
    >
      <Text style={[styles.title, { color: isDark ? "#F3F4F6" : "#111827" }]}>
        Manage Mates
      </Text>

      <TouchableOpacity
        style={styles.backBtn}
        onPress={() => router.push("/(tabs)/dashboard")}
      >
        <Text style={styles.backBtnText}>← Back to Dashboard</Text>
      </TouchableOpacity>

      {mates.length === 0 ? (
        <View style={styles.emptyCard}>
          <Text style={styles.emptyText}>No mates in your house yet.</Text>
        </View>
      ) : (
        <FlatList
          data={mates}
          keyExtractor={(item) => item.id.toString()}
          renderItem={renderMate}
          contentContainerStyle={{ paddingBottom: 50 }}
        />
      )}

      <View style={styles.codeContainer}>
        <Text style={[styles.info, { color: isDark ? "#F3F4F6" : "#111827" }]}>
          Share this house code:
        </Text>

        <Text style={styles.houseCode}>{houseCode}</Text>

        <Text style={styles.note}>
          New users can use this code to join your house.
        </Text>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 20 },

  title: {
    fontSize: 26,
    fontWeight: "bold",
    marginBottom: 15,
  },

  backBtn: {
    marginBottom: 20,
    paddingVertical: 10,
    paddingHorizontal: 15,
    backgroundColor: "#FF6A6A",
    borderRadius: 12,
    alignSelf: "flex-start",
  },

  backBtnText: {
    color: "#fff",
    fontWeight: "bold",
  },

  mateCard: {
    flexDirection: "row",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    marginBottom: 10,
    alignItems: "center",
  },

  mateText: {
    fontSize: 17,
    fontWeight: "600",
  },

  removeBtn: {
    backgroundColor: "#EF4444",
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 8,
  },

  removeText: {
    color: "#fff",
    fontWeight: "600",
  },

  emptyCard: {
    padding: 30,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: "#FF6A6A33",
    alignItems: "center",
    marginBottom: 20,
  },

  emptyText: {
    fontSize: 16,
    color: "#666",
  },

  codeContainer: {
    marginTop: 30,
    alignItems: "center",
  },

  info: {
    fontSize: 16,
  },

  houseCode: {
    fontSize: 28,
    fontWeight: "bold",
    marginVertical: 8,
    color: "#FF6A6A",
  },

  note: {
    fontSize: 14,
    color: "#666",
    textAlign: "center",
  },
});
