import { useEffect, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  FlatList,
  Alert,
  TouchableOpacity,
  RefreshControl,
  Platform,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { FontAwesome5, MaterialCommunityIcons, MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import Swipeable from "react-native-gesture-handler/ReanimatedSwipeable";
import { useBottomTabBarHeight } from "@react-navigation/bottom-tabs";
import { useTheme } from "../../theme/ThemeContext";
import { apiClient } from "../../../src/utils/apiClient";

export default function Mates() {
  const { isDark } = useTheme();
  const router = useRouter();
  const tabBarHeight = useBottomTabBarHeight();

  const [mates, setMates] = useState<any[]>([]);
  const [isAdmin, setIsAdmin] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#0F172A",
    sub: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    primary: "#FF6A6A",
    accent: "#6366F1",
    pending: "#F59E0B",
  };

  const fetchMates = async () => {
    try {
      const data = await apiClient("/mates", "GET");
      const approvedIds = new Set(data.approved.map((m: any) => m.id));
      const filteredPending = data.pending.filter(
        (m: any) => !approvedIds.has(m.id),
      );

      const combined = [
        data.admin ? { ...data.admin, pending: false, isAdmin: true } : null,
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
    }
  };

  useEffect(() => {
    fetchMates();
  }, []);

  const onRefresh = async () => {
    setRefreshing(true);
    await fetchMates();
    setRefreshing(false);
  };

  const handleBack = () => {
    if (router.canGoBack()) router.back();
    else router.replace("/(tabs)/dashboard");
  };

  const approveMate = async (mate: any) => {
    try {
      await apiClient(`/mates/${mate.id}/approve`, "POST");
      fetchMates();
      Alert.alert("Approved", `${mate.name} joined the house`);
    } catch (err) {
      Alert.alert("Error", "Approval failed");
    }
  };

  const rejectMate = async (mate: any) => {
    try {
      await apiClient(`/mates/${mate.id}/reject`, "POST");
      fetchMates();
    } catch (err) {
      Alert.alert("Error", "Action failed");
    }
  };

  const confirmRemoveMateFromHouse = (mate: any) => {
    Alert.alert(
      "Remove from house",
      `Remove ${mate.name} from this house? They will lose access like when someone leaves on their own.`,
      [
        { text: "Cancel", style: "cancel" },
        {
          text: "Remove",
          style: "destructive",
          onPress: () => removeMateFromHouse(mate),
        },
      ],
    );
  };

  const removeMateFromHouse = async (mate: any) => {
    try {
      await apiClient(`/mates/${mate.id}`, "DELETE");
      await fetchMates();
      Alert.alert("Done", `${mate.name} was removed from the house`);
    } catch (err: any) {
      Alert.alert("Error", err?.message ?? "Could not remove this person");
    }
  };

  const renderRightActions = (mate: any) => (
    <View style={styles.swipeContainer}>
      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: "#22C55E" }]}
        onPress={() => approveMate(mate)}
      >
        <MaterialIcons name="check" size={24} color="#fff" />
      </TouchableOpacity>
      <TouchableOpacity
        style={[styles.swipeBtn, { backgroundColor: "#EF4444" }]}
        onPress={() => rejectMate(mate)}
      >
        <MaterialIcons name="close" size={24} color="#fff" />
      </TouchableOpacity>
    </View>
  );

  const renderMate = ({ item }: any) => {
    const cardContent = (
      <View
        style={[
          styles.card,
          { backgroundColor: colors.card, borderColor: colors.border },
        ]}
      >
        <View
          style={[
            styles.avatar,
            {
              backgroundColor: item.isAdmin
                ? colors.accent + "20"
                : colors.primary + "15",
            },
          ]}
        >
          <Text
            style={[
              styles.avatarText,
              { color: item.isAdmin ? colors.accent : colors.primary },
            ]}
          >
            {item.name?.charAt(0).toUpperCase()}
          </Text>
        </View>

        <View style={{ flex: 1, marginLeft: 15 }}>
          <View style={styles.nameRow}>
            <Text style={[styles.name, { color: colors.text }]}>
              {item.name}
            </Text>
            {item.isAdmin && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.accent + "20" },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.accent }]}>
                  ADMIN
                </Text>
              </View>
            )}
            {item.pending && (
              <View
                style={[
                  styles.badge,
                  { backgroundColor: colors.pending + "20" },
                ]}
              >
                <Text style={[styles.badgeText, { color: colors.pending }]}>
                  PENDING
                </Text>
              </View>
            )}
          </View>
          <Text style={[styles.email, { color: colors.sub }]}>
            {item.email}
          </Text>
        </View>

        {isAdmin && item.pending && (
          <MaterialIcons
            name="swipe"
            size={18}
            color={colors.sub}
            style={{ opacity: 0.5 }}
          />
        )}

        {isAdmin && !item.pending && !item.isAdmin && (
          <TouchableOpacity
            onPress={() => confirmRemoveMateFromHouse(item)}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            accessibilityLabel={`Remove ${item.name} from house`}
          >
            <MaterialCommunityIcons
              name="account-remove-outline"
              size={24}
              color="#EF4444"
            />
          </TouchableOpacity>
        )}
      </View>
    );

    if (isAdmin && item.pending) {
      return (
        <Swipeable renderRightActions={() => renderRightActions(item)}>
          {cardContent}
        </Swipeable>
      );
    }
    return cardContent;
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      {/* --- PREMIUM HEADER --- */}
      <View style={styles.header}>
        <TouchableOpacity onPress={handleBack} style={styles.circularBackBtn}>
          <FontAwesome5 name="arrow-left" size={16} color="#fff" />
        </TouchableOpacity>

        <View style={styles.headerTitleContainer}>
          <Text style={[styles.screenTitle, { color: colors.text }]}>
            House Mates
          </Text>
          <Text style={[styles.screenSubtitle, { color: colors.sub }]}>
            Manage access and requests
          </Text>
        </View>

        <TouchableOpacity
          style={[
            styles.headerActionBtn,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
          onPress={() => router.push("/invite-qr")}
        >
          <FontAwesome5 name="user-plus" size={14} color={colors.primary} />
        </TouchableOpacity>
      </View>

      <FlatList
        data={mates}
        keyExtractor={(item) => item.id.toString()}
        renderItem={renderMate}
        refreshControl={
          <RefreshControl
            refreshing={refreshing}
            onRefresh={onRefresh}
            tintColor={colors.primary}
          />
        }
        contentContainerStyle={{
          paddingBottom: tabBarHeight + 20,
          paddingHorizontal: 20,
          paddingTop: 10,
        }}
        ListEmptyComponent={
          <View style={styles.emptyContainer}>
            <FontAwesome5 name="users" size={40} color={colors.border} />
            <Text style={[styles.emptyText, { color: colors.sub }]}>
              No mates found
            </Text>
          </View>
        }
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  header: {
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

  card: {
    flexDirection: "row",
    alignItems: "center",
    padding: 14,
    borderRadius: 20,
    marginBottom: 12,
    borderWidth: 1,
    ...Platform.select({
      ios: {
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.05,
        shadowRadius: 10,
      },
      android: { elevation: 2 },
    }),
  },

  avatar: {
    width: 48,
    height: 48,
    borderRadius: 16,
    justifyContent: "center",
    alignItems: "center",
  },
  avatarText: { fontWeight: "bold", fontSize: 20 },

  nameRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  name: { fontSize: 16, fontWeight: "700" },
  email: { fontSize: 13, marginTop: 2 },

  badge: { paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 },
  badgeText: { fontSize: 9, fontWeight: "900" },

  swipeContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingLeft: 10,
    height: "85%",
    alignSelf: "center",
  },
  swipeBtn: {
    width: 50,
    height: 50,
    justifyContent: "center",
    alignItems: "center",
    borderRadius: 15,
    marginLeft: 8,
  },

  emptyContainer: { alignItems: "center", marginTop: 100, gap: 10 },
  emptyText: { fontSize: 14, fontWeight: "600" },
});
