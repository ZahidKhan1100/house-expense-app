import { useEffect, useRef, useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Platform,
  Share,
  ActivityIndicator,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import QRCode from "react-native-qrcode-svg";
import { apiClient } from "../src/utils/apiClient";
import { buildHouseInviteQrValue } from "../src/utils/houseInviteLink";
import { useTheme } from "../src/theme/ThemeContext";
import { useRouter } from "expo-router";
import { FontAwesome5, MaterialIcons } from "@expo/vector-icons";
import * as MediaLibrary from "expo-media-library";

// Conditional imports for Native specific features
let RNFS: any;
let Clipboard: any;

if (Platform.OS !== "web") {
  try {
    RNFS = require("react-native-fs");
    Clipboard = require("@react-native-clipboard/clipboard");
  } catch (e) {
    console.warn("Native modules not available");
  }
}

export default function InviteQR() {
  const { isDark } = useTheme();
  const router = useRouter();

  const [code, setCode] = useState("");
  const [loading, setLoading] = useState(true);
  const qrRef = useRef<any>(null);

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#0F172A",
    sub: isDark ? "#94A3B8" : "#64748B",
    border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
    primary: "#FF6A6A",
  };

  useEffect(() => {
    fetchHouse();
  }, []);

  const fetchHouse = async () => {
    try {
      const res = await apiClient("/house/current");
      setCode(res.house?.house_code || "");
    } catch (err) {
      console.error("House fetch error:", err);
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    if (router.canGoBack()) {
      router.back();
    } else {
      router.replace("/(tabs)/mates");
    }
  };

  const copyCode = () => {
    if (!code) return;
    if (Platform.OS === "web") {
      navigator.clipboard.writeText(code);
    } else {
      Clipboard.setString(code);
    }
    if (Platform.OS !== "web")
      Alert.alert("Copied", "House code copied to clipboard! ✅");
    else alert("Code copied!");
  };

  const saveQRCode = async () => {
    if (Platform.OS === "web") return alert("Download not supported on web");
    if (!qrRef.current) return;

    const { status } = await MediaLibrary.requestPermissionsAsync();
    if (status !== "granted") return Alert.alert("Permission denied");

    qrRef.current.toDataURL(async (data: string) => {
      try {
        const path = RNFS.CachesDirectoryPath + "/house_qr.png";
        await RNFS.writeFile(path, data, "base64");
        await MediaLibrary.saveToLibraryAsync("file://" + path);
        Alert.alert("Success", "QR Code saved to gallery! 🖼️");
      } catch (err) {
        Alert.alert("Error", "Could not save QR");
      }
    });
  };

  const shareQRCode = async () => {
    if (Platform.OS === "web") return alert("Share not supported on web");
    if (!qrRef.current) return;

    qrRef.current.toDataURL(async (data: string) => {
      try {
        const path = RNFS.CachesDirectoryPath + "/house_qr.png";
        await RNFS.writeFile(path, data, "base64");
        await Share.share({
          message: `Join my house on HabiMate!\n${buildHouseInviteQrValue(code)}`,
          url: "file://" + path,
        });
      } catch (err) {
        Alert.alert("Error", "Could not share QR");
      }
    });
  };

  return (
    <SafeAreaView
      style={{ flex: 1, backgroundColor: colors.bg }}
      edges={["top"]}
    >
      {/* --- PREMIUM HEADER --- */}
      {/* --- PREMIUM HEADER --- */}
<View style={styles.newHeader}>
  <TouchableOpacity onPress={handleBack} style={styles.circularBackBtn}>
    <FontAwesome5 name="arrow-left" size={16} color="#fff" />
  </TouchableOpacity>
  
  <View style={styles.headerTitleContainer}>
    <Text style={[styles.screenTitle, { color: colors.text }]}>Invite</Text>
    <Text style={[styles.screenSubtitle, { color: colors.sub }]}>Add new house mates</Text>
  </View>

  <View style={{ width: 42 }} /> 
</View>

      <View style={styles.content}>
        <View
          style={[
            styles.qrCard,
            { backgroundColor: colors.card, borderColor: colors.border },
          ]}
        >
          <View style={styles.cardHeader}>
            <Text style={[styles.subtitle, { color: colors.text }]}>
              Scan QR Code
            </Text>
            <Text style={[styles.description, { color: colors.sub }]}>
              The QR opens a link in the browser (works without the app). After you install
              HabiMate, use the same code to join — or scan again from inside the app.
            </Text>
          </View>

          <View style={styles.qrContainer}>
            {loading ? (
              <ActivityIndicator size="large" color={colors.primary} />
            ) : (
              <QRCode
                value={code ? buildHouseInviteQrValue(code) : ""}
                size={220}
                backgroundColor={colors.card}
                color={colors.text}
                getRef={(c) => (qrRef.current = c)}
              />
            )}
          </View>

          <TouchableOpacity
            onPress={copyCode}
            activeOpacity={0.7}
            style={styles.codeContainer}
          >
            <Text style={[styles.codeLabel, { color: colors.sub }]}>
              HOUSE CODE
            </Text>
            <View style={styles.codeRow}>
              <Text style={styles.houseCode}>{code || "------"}</Text>
              <MaterialIcons
                name="content-copy"
                size={18}
                color={colors.primary}
              />
            </View>
          </TouchableOpacity>

          <View style={styles.actionRow}>
            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.bg }]}
              onPress={saveQRCode}
            >
              <MaterialIcons
                name="file-download"
                size={22}
                color={colors.text}
              />
              <Text style={[styles.iconButtonText, { color: colors.text }]}>
                Save
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.iconButton, { backgroundColor: colors.bg }]}
              onPress={shareQRCode}
            >
              <MaterialIcons name="share" size={22} color={colors.text} />
              <Text style={[styles.iconButtonText, { color: colors.text }]}>
                Share
              </Text>
            </TouchableOpacity>
          </View>
        </View>

       
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
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

  content: { flex: 1, padding: 25, alignItems: "center" },
  qrCard: {
    width: "100%",
    padding: 30,
    borderRadius: 32,
    alignItems: "center",
    borderWidth: 1,
    elevation: 10,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.1,
    shadowRadius: 20,
  },
  cardHeader: { alignItems: "center", marginBottom: 25 },
  subtitle: { fontSize: 18, fontWeight: "800" },
  description: { fontSize: 13, marginTop: 4, textAlign: "center" },

  qrContainer: {
    padding: 15,
    backgroundColor: "#fff",
    borderRadius: 20,
    marginBottom: 25,
  },

  codeContainer: { alignItems: "center", marginBottom: 25 },
  codeLabel: {
    fontSize: 10,
    fontWeight: "800",
    letterSpacing: 1.5,
    marginBottom: 4,
  },
  codeRow: { flexDirection: "row", alignItems: "center", gap: 8 },
  houseCode: { fontSize: 32, fontWeight: "900", color: "#FF6A6A" },

  actionRow: { flexDirection: "row", gap: 15, width: "100%" },
  iconButton: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    paddingVertical: 12,
    borderRadius: 16,
    gap: 8,
  },
  iconButtonText: { fontWeight: "700", fontSize: 14 },

  copyMainBtn: {
    marginTop: 30,
    backgroundColor: "#FF6A6A",
    paddingVertical: 18,
    paddingHorizontal: 40,
    borderRadius: 20,
    width: "100%",
    alignItems: "center",
    elevation: 4,
  },
  copyMainBtnText: { color: "#fff", fontWeight: "800", fontSize: 16 },
});
