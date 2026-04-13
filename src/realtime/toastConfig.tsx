import React from "react";
import { View, Text, StyleSheet } from "react-native";
import Toast, { BaseToast, ToastConfigParams } from "react-native-toast-message";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { REALTIME } from "./realtimeConfig";

type RealtimeToastProps = {
  title?: string;
  message?: string;
};

export const toastConfig = {
  realtime: ({ text1, text2 }: ToastConfigParams<any>) => {
    const title = (text1 as string | undefined) ?? "Update";
    const message = (text2 as string | undefined) ?? "";
    return (
      <View style={styles.wrap}>
        <View style={styles.iconWrap}>
          <MaterialCommunityIcons
            name="bell-badge"
            size={18}
            color={REALTIME.brand.coral}
          />
        </View>
        <View style={{ flex: 1 }}>
          <Text style={styles.title} numberOfLines={1}>
            {title}
          </Text>
          {!!message && (
            <Text style={styles.message} numberOfLines={2}>
              {message}
            </Text>
          )}
        </View>
      </View>
    );
  },
} satisfies Toast["props"]["config"];

const styles = StyleSheet.create({
  wrap: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 16,
    backgroundColor: "#FFFFFF",
    borderWidth: 1,
    borderColor: "rgba(255,106,106,0.25)",
    shadowColor: "#000",
    shadowOpacity: 0.12,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
    maxWidth: 360,
  },
  iconWrap: {
    width: 34,
    height: 34,
    borderRadius: 12,
    backgroundColor: "rgba(255,106,106,0.12)",
    alignItems: "center",
    justifyContent: "center",
  },
  title: { fontWeight: "900", color: "#0F172A", fontSize: 13 },
  message: { marginTop: 2, fontWeight: "700", color: "#64748B", fontSize: 12 },
});

