import React, { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  RefreshControl,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTheme } from "../../theme/ThemeContext";
import { apiClient } from "../../../src/utils/apiClient";

export default function Mates() {
  const { isDark } = useTheme();
  const tabBarHeight = useBottomTabBarHeight();

  const [mates, setMates] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [token, setToken] = useState<string>("");

  // ---------- Fetch mates ----------
  const fetchMates = async () => {
    try {
      const data = await apiClient("/mates", "GET", undefined, token);

      const approvedIds = new Set(data.approved.map((m: any) => m.id));

      const filteredPending = data.pending.filter(
        (m: any) => !approvedIds.has(m.id),
      );

      const combined = [
        data.admin
          ? {
              ...data.admin,
              name: data.admin.name || "Admin",
              pending: false,
              isAdmin: true,
            }
          : null,

        ...data.approved.map((m: any) => ({
          ...m,
          pending: false,
          isAdmin: false,
        })),

        ...filteredPending.map((m: any) => ({
          ...m,
          pending: true,
          isAdmin: false,
        })),
      ].filter(Boolean);

      setMates(combined);
      setIsAdmin(data.is_admin);
    } catch (err) {
      console.error(err);
      Alert.alert("Error", "Failed to load mates");
    }
  };

  useEffect(() => {
    fetchMates();
  }, []);

  // ---------- Pull to refresh ----------
  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMates();
    setRefreshing(false);
  };

  // ---------- Approve ----------
  const approveMate = async (mate: any) => {
    try {
      await apiClient(`/mates/${mate.id}/approve`, "POST", undefined, token);

      setMates((prev) => prev.filter((m) => m.id !== mate.id));

      Alert.alert("Approved", `${mate.name} joined the house`);
    } catch (err) {
      Alert.alert("Error", "Approval failed");
    }
  };

  // ---------- Reject ----------
  const rejectMate = async (mate: any) => {
    try {
      await apiClient(`/mates/${mate.id}/reject`, "POST", undefined, token);

      setMates((prev) => prev.filter((m) => m.id !== mate.id));

      Alert.alert("Rejected", `${mate.name} removed`);
    } catch (err) {
      Alert.alert("Error", "Reject failed");
    }
  };

  // ---------- Avatar ----------
  const Avatar = ({ name }: any) => (
    <View style={styles.avatar}>
      <Text style={styles.avatarText}>{name?.charAt(0)}</Text>
    </View>
  );

  // ---------- Swipe actions ----------
  const renderRightActions = (mate: any) => (
    <View style={styles.swipeContainer}>
      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: "#22C55E" }]}
        onPress={() => approveMate(mate)}
      >
        <Text style={styles.actionText}>Approve</Text>
      </TouchableOpacity>

      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: "#EF4444" }]}
        onPress={() => rejectMate(mate)}
      >
        <Text style={styles.actionText}>Reject</Text>
      </TouchableOpacity>
    </View>
  );

  // ---------- Render Mate ----------
  const renderMate = ({ item }: any) => {
    const gradientColors = item.pending
      ? isDark
        ? ["#374151", "#4B5563"]
        : ["#FFF8E1", "#FFECB3"]
      : item.isAdmin
        ? ["#6366F1", "#818CF8"]
        : isDark
          ? ["#B91C1C", "#F59E0B"]
          : ["#FF6A6A", "#FFB88C"];

    const textColor = item.pending ? (isDark ? "#E5E7EB" : "#1E293B") : "#fff";

    const card = (
      <LinearGradient colors={gradientColors} style={styles.card}>
        <Avatar name={item.name} />

        <View style={{ flex: 1 }}>
          <Text style={[styles.name, { color: textColor }]}>
            {item.name}
            {item.isAdmin && " (Admin)"}
          </Text>

          <Text style={[styles.email, { color: textColor }]}>{item.email}</Text>

          {item.pending && (
            <Text style={styles.pendingText}>Pending Approval</Text>
          )}
        </View>
      </LinearGradient>
    );

    if (isAdmin && item.pending) {
      return (
        <Swipeable renderRightActions={() => renderRightActions(item)}>
          {card}
        </Swipeable>
      );
    }

    return card;
  };

  return (
    <SafeAreaView
      style={[
        styles.container,
        { backgroundColor: isDark ? "#111827" : "#F5F5F5" },
      ]}
    >
      <Text style={[styles.title, { color: isDark ? "#F3F4F6" : "#111827" }]}>
        House Mates
      </Text>

      <FlatList
        data={mates}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMate}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} />
        }
        contentContainerStyle={{
          paddingBottom: tabBarHeight + 40,
          paddingHorizontal: 20,
        }}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },

  title: {
    fontSize: 28,
    fontWeight: "bold",
    textAlign: "center",
    marginVertical: 20,
  },

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 16,
    marginBottom: 12,
  },

  avatar: {
    width: 42,
    height: 42,
    borderRadius: 21,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    marginRight: 12,
  },

  avatarText: {
    fontWeight: "bold",
    color: "#FF6A6A",
    fontSize: 18,
  },

  name: {
    fontSize: 18,
    fontWeight: "600",
  },

  email: {
    fontSize: 14,
    marginTop: 2,
  },

  pendingText: {
    marginTop: 4,
    color: "#F59E0B",
    fontWeight: "600",
  },

  swipeContainer: {
    flexDirection: "row",
    alignItems: "center",
  },

  swipeBtn: {
    width: 90,
    height: "85%",
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 12,
    marginHorizontal: 5,
  },

  actionText: {
    color: "#fff",
    fontWeight: "600",
  },
});
