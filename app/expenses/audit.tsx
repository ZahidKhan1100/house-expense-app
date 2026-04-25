import { MaterialIcons } from "@expo/vector-icons";
import { useRouter } from "expo-router";
import { useCallback, useEffect, useState } from "react";
import {
  ActivityIndicator,
  FlatList,
  RefreshControl,
  StyleSheet,
  Text,
  TouchableOpacity,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Toast from "react-native-toast-message";

import { ApiClientError, apiClient, getApiErrorMessage } from "../../src/utils/apiClient";
import { useTheme } from "../../src/theme/ThemeContext";

type AuditRow = {
  id: number;
  action: string;
  summary: string | null;
  actor_name: string;
  actor_user_id: number;
  record_id: number | null;
  created_at: string | null;
};

function formatWhen(iso: string | null | undefined): string {
  if (!iso) return "";
  try {
    return new Date(iso).toLocaleString(undefined, {
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export default function ExpenseAuditScreen() {
  const router = useRouter();
  const { isDark } = useTheme();
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [logs, setLogs] = useState<AuditRow[]>([]);

  const load = useCallback(async () => {
    try {
      const data: any = await apiClient("/expense-audit", "GET");
      setLogs(Array.isArray(data?.logs) ? data.logs : []);
    } catch (e) {
      if (e instanceof ApiClientError && e.status === 401) {
        router.replace("/(auth)/login");
        return;
      }
      Toast.show({
        type: "error",
        text1: "Could not load log",
        text2: getApiErrorMessage(e),
      });
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [router]);

  useEffect(() => {
    load();
  }, [load]);

  const onRefresh = () => {
    setRefreshing(true);
    load();
  };

  const styles = createStyles(isDark);

  if (loading) {
    return (
      <SafeAreaView style={styles.centered}>
        <ActivityIndicator size="large" color="#FF6A6A" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
      <View style={styles.header}>
        <TouchableOpacity
          onPress={() => router.back()}
          hitSlop={12}
          style={styles.backBtn}
        >
          <MaterialIcons
            name="arrow-back"
            size={24}
            color={isDark ? "#F1F5F9" : "#0F172A"}
          />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Expense log</Text>
        <View style={{ width: 40 }} />
      </View>
      <Text style={styles.subtitle}>
        Who added, edited, or removed bills in your house (newest first).
      </Text>

      <FlatList
        data={logs}
        keyExtractor={(item) => String(item.id)}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#FF6A6A" />
        }
        contentContainerStyle={
          logs.length === 0 ? styles.emptyList : styles.listContent
        }
        ListEmptyComponent={
          <Text style={styles.emptyText}>
            No activity yet. Changes to bills will show up here.
          </Text>
        }
        renderItem={({ item }) => (
          <View style={styles.row}>
            <View style={styles.rowIcon}>
              <MaterialIcons
                name={
                  item.action === "deleted"
                    ? "remove-circle-outline"
                    : item.action === "updated"
                      ? "edit"
                      : "add-circle-outline"
                }
                size={20}
                color="#FF6A6A"
              />
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={styles.summary}>{item.summary || item.action}</Text>
              <Text style={styles.meta}>
                {item.actor_name}
                {item.created_at ? ` · ${formatWhen(item.created_at)}` : ""}
              </Text>
            </View>
          </View>
        )}
      />
    </SafeAreaView>
  );
}

const createStyles = (isDark: boolean) =>
  StyleSheet.create({
    container: {
      flex: 1,
      backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
    },
    centered: {
      flex: 1,
      justifyContent: "center",
      alignItems: "center",
      backgroundColor: isDark ? "#0F172A" : "#F8FAFC",
    },
    header: {
      flexDirection: "row",
      alignItems: "center",
      justifyContent: "space-between",
      paddingHorizontal: 8,
      paddingBottom: 4,
    },
    backBtn: { padding: 8 },
    headerTitle: {
      fontSize: 18,
      fontWeight: "800",
      color: isDark ? "#F1F5F9" : "#0F172A",
    },
    subtitle: {
      fontSize: 13,
      color: isDark ? "#94A3B8" : "#64748B",
      paddingHorizontal: 20,
      marginBottom: 12,
      lineHeight: 18,
    },
    listContent: { paddingHorizontal: 16, paddingBottom: 40 },
    emptyList: { flexGrow: 1, justifyContent: "center", paddingHorizontal: 24 },
    emptyText: {
      textAlign: "center",
      color: isDark ? "#94A3B8" : "#64748B",
      fontSize: 14,
      fontWeight: "500",
    },
    row: {
      flexDirection: "row",
      alignItems: "flex-start",
      gap: 12,
      paddingVertical: 12,
      paddingHorizontal: 12,
      marginBottom: 8,
      borderRadius: 14,
      backgroundColor: isDark ? "#1E293B" : "#FFFFFF",
      borderWidth: 1,
      borderColor: isDark ? "rgba(255,255,255,0.06)" : "#E2E8F0",
    },
    rowIcon: {
      width: 36,
      height: 36,
      borderRadius: 10,
      backgroundColor: isDark ? "rgba(255,106,106,0.12)" : "#FFF1F1",
      justifyContent: "center",
      alignItems: "center",
    },
    summary: {
      fontSize: 15,
      fontWeight: "700",
      color: isDark ? "#F1F5F9" : "#0F172A",
    },
    meta: {
      marginTop: 4,
      fontSize: 12,
      color: isDark ? "#94A3B8" : "#64748B",
      fontWeight: "500",
    },
  });
