import React, { useState, useEffect, useMemo } from "react";
import {
  View,
  TextInput,
  Text,
  TouchableOpacity,
  Alert,
  StyleSheet,
  Switch,
  ActivityIndicator,
  ScrollView,
  FlatList,
  Modal,
  Dimensions,
  Platform,
  KeyboardAvoidingView,
  Linking,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import {
  MaterialCommunityIcons,
  FontAwesome5,
  MaterialIcons,
} from "@expo/vector-icons";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { useTheme } from "../../../src/theme/ThemeContext";
import { useTabBarScrollSync } from "../../../src/context/TabBarScrollContext";
import { ApiClientError, apiClient, getApiErrorMessage } from "../../../src/utils/apiClient";
import { clearPendingHouseCode } from "../../../src/utils/houseInviteLink";
import { useKeyboardBottomPadding } from "../../../src/hooks/useKeyboardBottomPadding";
import * as LocalAuthentication from "expo-local-authentication";
import { requestWebNotificationPermission, webNotificationsSupported } from "../../../src/realtime/webNotifications";
import { HABIMATE_PROMISE_SUMMARY, LEGAL_URLS } from "../../../src/config/legal";

const { height: SCREEN_HEIGHT } = Dimensions.get("window");

const WORLD_CURRENCIES = [
  { "code": "USD", "name": "US Dollar", "symbol": "$" },
  { "code": "EUR", "name": "Euro", "symbol": "€" },
  { "code": "GBP", "name": "British Pound", "symbol": "£" },
  { "code": "JPY", "name": "Japanese Yen", "symbol": "¥" },
  { "code": "INR", "name": "Indian Rupee", "symbol": "₹" },
  { "code": "AED", "name": "UAE Dirham", "symbol": "د.إ" },
  { "code": "AFN", "name": "Afghan Afghani", "symbol": "؋" },
  { "code": "ALL", "name": "Albanian Lek", "symbol": "L" },
  { "code": "AMD", "name": "Armenian Dram", "symbol": "֏" },
  { "code": "AUD", "name": "Australian Dollar", "symbol": "A$" },
  { "code": "BHD", "name": "Bahraini Dinar", "symbol": "BD" },
  { "code": "BDT", "name": "Bangladeshi Taka", "symbol": "৳" },
  { "code": "BRL", "name": "Brazilian Real", "symbol": "R$" },
  { "code": "CAD", "name": "Canadian Dollar", "symbol": "C$" },
  { "code": "CHF", "name": "Swiss Franc", "symbol": "CHF" },
  { "code": "CLP", "name": "Chilean Peso", "symbol": "$" },
  { "code": "CNY", "name": "Chinese Yuan", "symbol": "¥" },
  { "code": "COP", "name": "Colombian Peso", "symbol": "$" },
  { "code": "CZK", "name": "Czech Koruna", "symbol": "Kč" },
  { "code": "DKK", "name": "Danish Krone", "symbol": "kr" },
  { "code": "EGP", "name": "Egyptian Pound", "symbol": "E£" },
  { "code": "HKD", "name": "Hong Kong Dollar", "symbol": "HK$" },
  { "code": "HUF", "name": "Hungarian Forint", "symbol": "Ft" },
  { "code": "IDR", "name": "Indonesian Rupiah", "symbol": "Rp" },
  { "code": "ILS", "name": "Israeli New Shekel", "symbol": "₪" },
  { "code": "KRW", "name": "South Korean Won", "symbol": "₩" },
  { "code": "KWD", "name": "Kuwaiti Dinar", "symbol": "KD" },
  { "code": "MXN", "name": "Mexican Peso", "symbol": "$" },
  { "code": "MYR", "name": "Malaysian Ringgit", "symbol": "RM" },
  { "code": "NOK", "name": "Norwegian Krone", "symbol": "kr" },
  { "code": "NZD", "name": "New Zealand Dollar", "symbol": "NZ$" },
  { "code": "OMR", "name": "Omani Rial", "symbol": "RO" },
  { "code": "PHP", "name": "Philippine Peso", "symbol": "₱" },
  { "code": "PKR", "name": "Pakistani Rupee", "symbol": "Rs" },
  { "code": "PLN", "name": "Polish Zloty", "symbol": "zł" },
  { "code": "QAR", "name": "Qatari Rial", "symbol": "QR" },
  { "code": "RUB", "name": "Russian Ruble", "symbol": "₽" },
  { "code": "SAR", "name": "Saudi Riyal", "symbol": "SR" },
  { "code": "SEK", "name": "Swedish Krona", "symbol": "kr" },
  { "code": "SGD", "name": "Singapore Dollar", "symbol": "S$" },
  { "code": "THB", "name": "Thai Baht", "symbol": "฿" },
  { "code": "TRY", "name": "Turkish Lira", "symbol": "₺" },
  { "code": "TWD", "name": "Taiwan New Dollar", "symbol": "NT$" },
  { "code": "VND", "name": "Vietnamese Dong", "symbol": "₫" },
  { "code": "ZAR", "name": "South African Rand", "symbol": "R" }
];

export default function Profile() {
  const router = useRouter();
  const { isDark, toggleTheme } = useTheme();
  const { onScroll, scrollEventThrottle } = useTabBarScrollSync();

  const [loading, setLoading] = useState(true);
  const [userData, setUserData] = useState<any>(null);
  const [houseName, setHouseName] = useState("");
  const [currency, setCurrency] = useState("$");
  const [editingHouse, setEditingHouse] = useState(false);
  const [showCurrencyModal, setShowCurrencyModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [faceIdEnabled, setFaceIdEnabled] = useState(false);
  const [webNotifEnabled, setWebNotifEnabled] = useState(false);
  const [guestWeightStr, setGuestWeightStr] = useState("100");

  const mainScrollPad = useKeyboardBottomPadding(100);
  const currencyModalPad = useKeyboardBottomPadding(28);

  const colors = {
    bg: isDark ? "#0F172A" : "#F8FAFC",
    card: isDark ? "#1E293B" : "#FFFFFF",
    text: isDark ? "#F1F5F9" : "#1E293B",
    subText: isDark ? "#94A3B8" : "#64748B",
    accent: "#FF6A6A",
    border: isDark ? "rgba(255,255,255,0.08)" : "#E2E8F0",
  };

  const fetchProfile = async () => {
    try {
      const profile = await apiClient("/profile", "GET");
      setUserData(profile);
      if (profile.house) {
        setHouseName(profile.house.name);
        setCurrency(profile.house.currency || "$");
        setGuestWeightStr(
          String(profile.house.guest_day_weight_percent ?? 100),
        );
      }
    } catch (err: any) {
      if (err instanceof ApiClientError && err.status === 401) {
        router.replace("/(auth)/login");
        return;
      }
      console.error("Profile Load Error:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
    (async () => {
      const saved = await AsyncStorage.getItem("faceIdEnabled");
      if (saved === "true") setFaceIdEnabled(true);
    })();
    (async () => {
      if (Platform.OS !== "web") return;
      try {
        setWebNotifEnabled(webNotificationsSupported() && Notification.permission === "granted");
      } catch {
        setWebNotifEnabled(false);
      }
    })();
  }, []);

  const checkFaceIdSupport = async () => {
    const hasHardware = await LocalAuthentication.hasHardwareAsync();
    const supportedTypes =
      await LocalAuthentication.supportedAuthenticationTypesAsync();
    return (
      hasHardware &&
      supportedTypes.includes(
        LocalAuthentication.AuthenticationType.FACIAL_RECOGNITION,
      )
    );
  };

  const handleFaceIdToggle = async () => {
    const supported = await checkFaceIdSupport();
    if (!supported) {
      Alert.alert("Not supported", "Face ID is not available on this device");
      return;
    }
    if (!faceIdEnabled) {
      const result = await LocalAuthentication.authenticateAsync({
        promptMessage: "Enable Face ID",
      });
      if (!result.success) return;
    }
    const newValue = !faceIdEnabled;
    setFaceIdEnabled(newValue);
    await AsyncStorage.setItem("faceIdEnabled", JSON.stringify(newValue));
  };

  const handleLogout = async () => {
    try {
      await clearPendingHouseCode();
      await AsyncStorage.multiRemove(["token", "user"]);
      router.replace("/(auth)/login");
    } catch (error) {
      router.replace("/(auth)/login");
    }
  };

  const confirmSignOut = () => {
    if (Platform.OS === "web") {
      if (window.confirm("Are you sure you want to sign out?")) handleLogout();
    } else {
      Alert.alert("Sign Out", "Are you sure you want to leave?", [
        { text: "Cancel", style: "cancel" },
        { text: "Sign Out", style: "destructive", onPress: handleLogout },
      ]);
    }
  };

  const filteredCurrencies = useMemo(() => {
    return WORLD_CURRENCIES.filter(
      (item) =>
        item.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        item.code.toLowerCase().includes(searchQuery.toLowerCase()),
    );
  }, [searchQuery]);

  const saveGuestWeight = async () => {
    if (!userData?.house?.id) return;
    if (
      userData?.has_pending_settlements &&
      userData?.house
    ) {
      Alert.alert(
        "Settle up first",
        "Finish pending settlement transfers on the Pay tab before changing house settings.",
      );
      return;
    }
    const n = parseFloat(String(guestWeightStr).replace(",", "."));
    if (!Number.isFinite(n) || n < 0 || n > 500) {
      Alert.alert("Invalid value", "Enter a number between 0 and 500.");
      return;
    }
    try {
      await apiClient(
        `/houses/${userData.house.id}`,
        "PUT",
        { guest_day_weight_percent: n },
      );
      setUserData((prev: any) => ({
        ...prev,
        house: { ...prev.house, guest_day_weight_percent: n },
      }));
      setGuestWeightStr(String(n));
      Alert.alert("Saved", "Guest billing weight updated for this house.");
    } catch (err) {
      Alert.alert("Error", getApiErrorMessage(err, "Could not save"));
    }
  };

  const saveUpdate = async (type: "name" | "currency", value: string) => {
    if (
      userData?.has_pending_settlements &&
      (type === "name" || type === "currency")
    ) {
      Alert.alert(
        "Settle up first",
        "Finish your pending settlement transfers on the Pay tab before changing house settings.",
      );
      return;
    }
    try {
      await apiClient(
        `/houses/${userData.house.id}`,
        "PUT",
        { [type === "name" ? "name" : "currency"]: value },
      );
      if (type === "currency") {
        setCurrency(value);
        setShowCurrencyModal(false);
      } else {
        setEditingHouse(false);
      }
    } catch (err) {
      Alert.alert("Error", "Update failed");
    }
  };

  const handleLeaveHouse = async () => {
    try {
      await apiClient("/leave-house", "POST", {});
      await clearPendingHouseCode();
      Alert.alert("Success", "You left the house");
      router.replace("/(auth)/login");
    } catch (err) {
      Alert.alert("Can't leave", getApiErrorMessage(err, "Failed to leave house"));
    }
  };

  const handleDeleteAccount = async () => {
    try {
      await apiClient("/delete-account", "POST", {});
      await clearPendingHouseCode();
      await AsyncStorage.multiRemove(["token", "user"]);
      Alert.alert("Deleted", "Your account has been deleted");
      router.replace("/(auth)/login");
    } catch (err) {
      Alert.alert(
        "Can't delete account",
        getApiErrorMessage(err, "Failed to delete account"),
      );
    }
  };

  const confirmLeaveHouse = () => {
    Alert.alert("Leave House", "Are you sure you want to leave this house?", [
      { text: "Cancel", style: "cancel" },
      { text: "Leave", style: "destructive", onPress: handleLeaveHouse },
    ]);
  };

  const confirmDeleteAccount = () => {
    Alert.alert("Delete Account", "This action is permanent. Are you sure?", [
      { text: "Cancel", style: "cancel" },
      { text: "Delete", style: "destructive", onPress: handleDeleteAccount },
    ]);
  };

  if (loading || !userData)
    return (
      <View style={[styles.loadingContainer, { backgroundColor: colors.bg }]}>
        <ActivityIndicator size="large" color="#FF6A6A" />
      </View>
    );

  const isAdmin = userData.role === "admin";
  const settlementLocked = !!userData.has_pending_settlements;

  return (
    <View style={[styles.container, { backgroundColor: colors.bg }]}>
      <ScrollView
        onScroll={onScroll}
        scrollEventThrottle={scrollEventThrottle}
        showsVerticalScrollIndicator={false}
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: mainScrollPad },
        ]}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        {/* HEADER SECTION */}
        <LinearGradient colors={["#FF8E8E", "#FF6A6A"]} style={styles.header}>
          <SafeAreaView edges={["top"]}>
            <View style={styles.profileHeader}>
              <View style={styles.avatarContainer}>
                <View style={styles.avatarMain}>
                  <Text style={styles.avatarLetter}>
                    {userData.name.charAt(0).toUpperCase()}
                  </Text>
                </View>
                <View style={styles.roleBadge}>
                  <FontAwesome5
                    name={isAdmin ? "crown" : "user"}
                    size={10}
                    color="#FF6A6A"
                  />
                </View>
              </View>
              <Text style={styles.nameText}>{userData.name}</Text>
              {!!userData.is_founder && (
                <LinearGradient
                  colors={["#FFD700", "#FF6A6A"]}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 1 }}
                  style={styles.founderChip}
                >
                  <FontAwesome5 name="crown" size={10} color="#fff" />
                  <Text style={styles.founderChipText}>Founder</Text>
                </LinearGradient>
              )}
              <Text style={styles.emailText}>{userData.email}</Text>
            </View>
          </SafeAreaView>
        </LinearGradient>

        <View style={styles.body}>
          {settlementLocked && (
            <View
              style={{
                padding: 14,
                marginBottom: 12,
                borderRadius: 12,
                backgroundColor: isDark
                  ? "rgba(251, 191, 36, 0.12)"
                  : "#FFFBEB",
                borderWidth: 1,
                borderColor: "rgba(245, 158, 11, 0.35)",
              }}
            >
              <Text style={{ color: colors.text, fontWeight: "800", fontSize: 14 }}>
                Pending settlements
              </Text>
              <Text
                style={{ color: colors.subText, marginTop: 6, fontSize: 13, lineHeight: 18 }}
              >
                Use the Pay tab to mark your transfers paid. Other tabs stay limited until
                you are fully settled.
              </Text>
            </View>
          )}
          {/* GROUP 1: PREFERENCES */}
          <Text style={[styles.sectionTitle, { color: colors.subText }]}>
            Preferences
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={styles.row}
              onPress={() => router.push("/whats-new" as any)}
              activeOpacity={0.85}
            >
              <View style={styles.rowIconLabel}>
                <View style={[styles.iconBox, { backgroundColor: "#FF6A6A20" }]}>
                  <MaterialCommunityIcons
                    name="newspaper-variant-outline"
                    size={18}
                    color={colors.accent}
                  />
                </View>
                <Text style={[styles.rowText, { color: colors.text }]}>
                  What’s new
                </Text>
              </View>
              <MaterialIcons name="chevron-right" size={22} color={colors.subText} />
            </TouchableOpacity>

            <View style={styles.row}>
              <View style={styles.rowIconLabel}>
                <View
                  style={[styles.iconBox, { backgroundColor: "#6366F120" }]}
                >
                  <MaterialCommunityIcons
                    name="theme-light-dark"
                    size={18}
                    color="#6366F1"
                  />
                </View>
                <Text style={[styles.rowText, { color: colors.text }]}>
                  Dark Mode
                </Text>
              </View>
              <Switch
                value={isDark}
                onValueChange={toggleTheme}
                trackColor={{ false: "#E2E8F0", true: "#FF6A6A" }}
              />
            </View>

            <View style={styles.row}>
              <View style={styles.rowIconLabel}>
                <View
                  style={[styles.iconBox, { backgroundColor: "#22C55E20" }]}
                >
                  <MaterialCommunityIcons
                    name="face-recognition"
                    size={18}
                    color="#22C55E"
                  />
                </View>
                <Text style={[styles.rowText, { color: colors.text }]}>
                  Face ID Login
                </Text>
              </View>
              <Switch
                value={faceIdEnabled}
                onValueChange={handleFaceIdToggle}
                trackColor={{ false: "#E2E8F0", true: "#FF6A6A" }}
              />
            </View>

            {Platform.OS === "web" && (
              <View style={styles.row}>
                <View style={styles.rowIconLabel}>
                  <View style={[styles.iconBox, { backgroundColor: "#3B82F620" }]}>
                    <MaterialCommunityIcons name="bell-outline" size={18} color="#3B82F6" />
                  </View>
                  <Text style={[styles.rowText, { color: colors.text }]}>
                    Web Notifications
                  </Text>
                </View>
                <Switch
                  value={webNotifEnabled}
                  onValueChange={async (next) => {
                    if (!next) {
                      Alert.alert(
                        "Browser setting",
                        "To disable, block notifications for this site in your browser settings.",
                      );
                      return;
                    }
                    const perm = await requestWebNotificationPermission();
                    setWebNotifEnabled(perm === "granted");
                    if (perm !== "granted") {
                      Alert.alert(
                        "Permission denied",
                        "Please allow notifications in the browser prompt/settings.",
                      );
                    }
                  }}
                  trackColor={{ false: "#E2E8F0", true: "#FF6A6A" }}
                />
              </View>
            )}
          </View>

          {/* GROUP 2: HOUSE SETTINGS */}
          {isAdmin && userData.house && (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.subText, marginTop: 25 },
                ]}
              >
                House Settings
              </Text>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <View style={styles.row}>
                  <View style={styles.rowIconLabel}>
                    <View
                      style={[styles.iconBox, { backgroundColor: "#F59E0B20" }]}
                    >
                      <FontAwesome5 name="home" size={14} color="#F59E0B" />
                    </View>
                    <View>
                      <Text style={[styles.rowText, { color: colors.text }]}>
                        House Name
                      </Text>
                      {!editingHouse && (
                        <Text
                          style={[
                            styles.houseValueDisplay,
                            { color: colors.accent },
                          ]}
                        >
                          {houseName}
                        </Text>
                      )}
                    </View>
                  </View>
                  <TouchableOpacity
                    onPress={() => {
                      if (settlementLocked) {
                        Alert.alert(
                          "Settle up first",
                          "Finish pending settlement transfers on the Pay tab before editing house settings.",
                        );
                        return;
                      }
                      setEditingHouse(!editingHouse);
                    }}
                  >
                    <Text
                      style={[
                        styles.actionLink,
                        {
                          color: editingHouse ? colors.subText : colors.accent,
                          opacity: settlementLocked ? 0.45 : 1,
                        },
                      ]}
                    >
                      {editingHouse ? "Cancel" : "Edit"}
                    </Text>
                  </TouchableOpacity>
                </View>

                {editingHouse && (
                  <View style={styles.inputWrapper}>
                    <View
                      style={[
                        styles.inlineInput,
                        { backgroundColor: isDark ? "#0F172A" : "#F1F5F9" },
                      ]}
                    >
                      <TextInput
                        style={[styles.inputField, { color: colors.text }]}
                        value={houseName}
                        onChangeText={setHouseName}
                        autoFocus
                        placeholder="Type house name..."
                        placeholderTextColor={colors.subText}
                      />
                      <TouchableOpacity
                        style={styles.saveIconBtn}
                        onPress={() => saveUpdate("name", houseName)}
                      >
                        <MaterialIcons name="check" size={20} color="#fff" />
                      </TouchableOpacity>
                    </View>
                  </View>
                )}

                <View style={styles.divider} />

                <TouchableOpacity
                  style={styles.row}
                  onPress={() => {
                    if (settlementLocked) {
                      Alert.alert(
                        "Settle up first",
                        "Finish pending settlement transfers on the Pay tab before changing currency.",
                      );
                      return;
                    }
                    setShowCurrencyModal(true);
                  }}
                >
                  <View style={styles.rowIconLabel}>
                    <View
                      style={[styles.iconBox, { backgroundColor: "#10B98120" }]}
                    >
                      <FontAwesome5 name="globe" size={14} color="#10B981" />
                    </View>
                    <Text style={[styles.rowText, { color: colors.text }]}>
                      Currency Symbol
                    </Text>
                  </View>
                  <View style={styles.currencyBadge}>
                    <Text style={styles.currencyBadgeText}>{currency}</Text>
                    <FontAwesome5
                      name="chevron-right"
                      size={10}
                      color={colors.accent}
                      style={{ marginLeft: 8 }}
                    />
                  </View>
                </TouchableOpacity>

                <View style={styles.divider} />

                <View style={{ paddingHorizontal: 15, paddingBottom: 16 }}>
                  <Text style={[styles.rowText, { color: colors.text }]}>
                    Guest night billing
                  </Text>
                  <Text
                    style={{
                      fontSize: 11,
                      color: colors.subText,
                      marginTop: 6,
                      lineHeight: 16,
                    }}
                  >
                    Each guest night counts as this percent of one full bill day in
                    day-weighted splits. 100 = one person-day (same as one night at
                    home). Lower values lighten the impact; higher values charge more
                    per guest night.
                  </Text>
                  <View
                    style={{
                      flexDirection: "row",
                      alignItems: "center",
                      marginTop: 12,
                      gap: 10,
                    }}
                  >
                    <TextInput
                      style={[
                        styles.inputField,
                        {
                          flex: 1,
                          color: colors.text,
                          backgroundColor: isDark ? "#0F172A" : "#F1F5F9",
                          paddingVertical: 10,
                        },
                      ]}
                      keyboardType="decimal-pad"
                      value={guestWeightStr}
                      onChangeText={setGuestWeightStr}
                      placeholder="100"
                      placeholderTextColor={colors.subText}
                    />
                    <TouchableOpacity
                      onPress={() => {
                        if (settlementLocked) {
                          Alert.alert(
                            "Settle up first",
                            "Finish pending settlement transfers on the Pay tab before editing house settings.",
                          );
                          return;
                        }
                        saveGuestWeight();
                      }}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 10,
                        backgroundColor: colors.accent,
                      }}
                    >
                      <Text style={{ color: "#fff", fontWeight: "800" }}>Save</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            </>
          )}

          {/* GROUP: HOUSE ACTIONS */}
          {userData.house && (
            <>
              <Text
                style={[
                  styles.sectionTitle,
                  { color: colors.subText, marginTop: 25 },
                ]}
              >
                House Actions
              </Text>
              <View
                style={[
                  styles.card,
                  { backgroundColor: colors.card, borderColor: colors.border },
                ]}
              >
                <TouchableOpacity
                  style={[styles.row, settlementLocked && { opacity: 0.45 }]}
                  onPress={() => {
                    if (settlementLocked) {
                      Alert.alert(
                        "Settle up first",
                        "Mark your pending settlement transfers paid on the Pay tab before leaving the house.",
                      );
                      return;
                    }
                    confirmLeaveHouse();
                  }}
                >
                  <View style={styles.rowIconLabel}>
                    <View
                      style={[styles.iconBox, { backgroundColor: "#F9731620" }]}
                    >
                      <MaterialIcons
                        name="exit-to-app"
                        size={18}
                        color="#F97316"
                      />
                    </View>
                    <Text style={[styles.rowText, { color: colors.text }]}>
                      Leave House
                    </Text>
                  </View>
                </TouchableOpacity>
              </View>
            </>
          )}

          {/* Privacy & Trust — full legal docs on website */}
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.subText, marginTop: 25 },
            ]}
          >
            Privacy & Trust
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <View style={{ paddingHorizontal: 15, paddingTop: 14, paddingBottom: 8 }}>
              <Text
                style={{
                  fontSize: 12,
                  lineHeight: 18,
                  color: colors.subText,
                }}
              >
                {HABIMATE_PROMISE_SUMMARY}
              </Text>
            </View>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.row}
              onPress={async () => {
                const ok = await Linking.canOpenURL(LEGAL_URLS.privacy);
                if (ok) Linking.openURL(LEGAL_URLS.privacy);
                else Alert.alert("Unable to open link", LEGAL_URLS.privacy);
              }}
            >
              <View style={styles.rowIconLabel}>
                <View style={[styles.iconBox, { backgroundColor: "#2EC4B620" }]}>
                  <MaterialCommunityIcons name="shield-lock-outline" size={18} color="#2EC4B6" />
                </View>
                <Text style={[styles.rowText, { color: colors.text }]}>
                  Privacy Policy (website)
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={10} color={colors.accent} />
            </TouchableOpacity>
            <View style={styles.divider} />
            <TouchableOpacity
              style={styles.row}
              onPress={async () => {
                const ok = await Linking.canOpenURL(LEGAL_URLS.terms);
                if (ok) Linking.openURL(LEGAL_URLS.terms);
                else Alert.alert("Unable to open link", LEGAL_URLS.terms);
              }}
            >
              <View style={styles.rowIconLabel}>
                <View style={[styles.iconBox, { backgroundColor: "#6366F120" }]}>
                  <MaterialCommunityIcons name="file-document-outline" size={18} color="#6366F1" />
                </View>
                <Text style={[styles.rowText, { color: colors.text }]}>
                  Terms of Service (website)
                </Text>
              </View>
              <FontAwesome5 name="chevron-right" size={10} color={colors.accent} />
            </TouchableOpacity>
          </View>

          {/* GROUP: DANGER ZONE */}
          <Text
            style={[
              styles.sectionTitle,
              { color: colors.subText, marginTop: 25 },
            ]}
          >
            Danger Zone
          </Text>
          <View
            style={[
              styles.card,
              { backgroundColor: colors.card, borderColor: colors.border },
            ]}
          >
            <TouchableOpacity
              style={[styles.row, settlementLocked && { opacity: 0.45 }]}
              onPress={() => {
                if (settlementLocked) {
                  Alert.alert(
                    "Settle up first",
                    "Mark your pending settlement transfers paid on the Pay tab before deleting your account.",
                  );
                  return;
                }
                confirmDeleteAccount();
              }}
            >
              <View style={styles.rowIconLabel}>
                <View
                  style={[styles.iconBox, { backgroundColor: "#EF444420" }]}
                >
                  <MaterialIcons
                    name="delete-forever"
                    size={18}
                    color="#EF4444"
                  />
                </View>
                <Text style={[styles.rowText, { color: "#EF4444" }]}>
                  Delete Account
                </Text>
              </View>
            </TouchableOpacity>
          </View>

          <TouchableOpacity style={styles.logoutBtn} onPress={confirmSignOut}>
            <Text style={styles.logoutBtnText}>Sign Out</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>

      {/* CURRENCY MODAL */}
      <Modal
        visible={showCurrencyModal}
        animationType="slide"
        transparent={true}
      >
        <KeyboardAvoidingView
          style={{ flex: 1 }}
          behavior={Platform.OS === "ios" ? "padding" : undefined}
          keyboardVerticalOffset={0}
        >
          <View style={styles.modalOverlay}>
            <View style={[styles.modalContent, { backgroundColor: colors.card }]}>
            <View style={styles.modalHeader}>
              <Text style={[styles.modalTitle, { color: colors.text }]}>
                Select Currency
              </Text>
              <TouchableOpacity onPress={() => setShowCurrencyModal(false)}>
                <MaterialCommunityIcons
                  name="close-circle"
                  size={28}
                  color={colors.subText}
                />
              </TouchableOpacity>
            </View>

            <View
              style={[
                styles.searchContainer,
                { backgroundColor: isDark ? "#0F172A" : "#F1F5F9" },
              ]}
            >
              <FontAwesome5 name="search" size={14} color={colors.subText} />
              <TextInput
                placeholder="Search Currency..."
                placeholderTextColor={colors.subText}
                style={[styles.searchInput, { color: colors.text }]}
                value={searchQuery}
                onChangeText={setSearchQuery}
              />
            </View>

            <FlatList
              data={filteredCurrencies}
              keyExtractor={(item) => item.code}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="interactive"
              contentContainerStyle={{ paddingBottom: currencyModalPad }}
              renderItem={({ item }) => (
                <TouchableOpacity
                  style={styles.currencyRow}
                  onPress={() => saveUpdate("currency", item.symbol)}
                >
                  <View style={styles.currencyInfo}>
                    <View style={styles.currencyCircle}>
                      <Text style={styles.symbolText}>{item.symbol}</Text>
                    </View>
                    <View>
                      <Text
                        style={[styles.currencyName, { color: colors.text }]}
                      >
                        {item.name}
                      </Text>
                      <Text style={styles.currencyCode}>{item.code}</Text>
                    </View>
                  </View>
                  {currency === item.symbol && (
                    <FontAwesome5
                      name="check-circle"
                      size={20}
                      color="#FF6A6A"
                    />
                  )}
                </TouchableOpacity>
              )}
            />
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loadingContainer: { flex: 1, justifyContent: "center" },
  scrollContent: { paddingBottom: 100 }, // CRITICAL FIX: Extra space at the bottom
  header: {
    paddingBottom: 40,
    borderBottomLeftRadius: 40,
    borderBottomRightRadius: 40,
  },
  profileHeader: { alignItems: "center", marginTop: 10 },
  avatarContainer: { position: "relative", marginBottom: 12 },
  avatarMain: {
    width: 90,
    height: 90,
    borderRadius: 32,
    backgroundColor: "#fff",
    justifyContent: "center",
    alignItems: "center",
    elevation: 8,
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
  },
  avatarLetter: { fontSize: 38, fontWeight: "900", color: "#FF6A6A" },
  roleBadge: {
    position: "absolute",
    bottom: -4,
    right: -4,
    backgroundColor: "#fff",
    padding: 6,
    borderRadius: 10,
    elevation: 4,
  },
  founderChip: {
    marginTop: 10,
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 999,
    shadowColor: "#FFD700",
    shadowOpacity: 0.22,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  founderChipText: { color: "#fff", fontWeight: "900", fontSize: 12 },
  nameText: { fontSize: 24, fontWeight: "800", color: "#fff" },
  emailText: {
    fontSize: 14,
    color: "rgba(255,255,255,0.7)",
    fontWeight: "600",
  },
  body: { padding: 20, marginTop: -20 },
  sectionTitle: {
    fontSize: 12,
    fontWeight: "800",
    textTransform: "uppercase",
    letterSpacing: 1.5,
    marginBottom: 10,
    marginLeft: 5,
  },
  card: {
    borderRadius: 24,
    paddingVertical: 8,
    paddingHorizontal: 4,
    elevation: 2,
    borderWidth: 1,
    overflow: "hidden",
    marginBottom: 10,
  },
  row: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    padding: 15,
  },
  rowIconLabel: { flexDirection: "row", alignItems: "center" },
  iconBox: {
    width: 36,
    height: 36,
    borderRadius: 12,
    justifyContent: "center",
    alignItems: "center",
    marginRight: 15,
  },
  rowText: { fontSize: 16, fontWeight: "700" },
  houseValueDisplay: { fontSize: 13, fontWeight: "600", marginTop: 2 },
  actionLink: { fontWeight: "800", fontSize: 14 },
  currencyBadge: {
    flexDirection: "row",
    alignItems: "center",
    backgroundColor: "#FF6A6A15",
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 12,
  },
  currencyBadgeText: { color: "#FF6A6A", fontWeight: "800", fontSize: 15 },
  divider: {
    height: 1,
    backgroundColor: "rgba(0,0,0,0.05)",
    marginHorizontal: 15,
  },
  inputWrapper: { paddingHorizontal: 15, paddingBottom: 15, width: "100%" },
  inlineInput: {
    flexDirection: "row",
    borderRadius: 14,
    paddingHorizontal: 12,
    paddingVertical: 4,
    alignItems: "center",
    width: "100%",
  },
  inputField: { flex: 1, height: 44, fontSize: 15, fontWeight: "600" },
  saveIconBtn: {
    width: 36,
    height: 36,
    backgroundColor: "#FF6A6A",
    borderRadius: 10,
    justifyContent: "center",
    alignItems: "center",
    marginLeft: 8,
  },
  logoutBtn: {
    marginTop: 30,
    padding: 18,
    borderRadius: 20,
    backgroundColor: "#FF6A6A20",
    alignItems: "center",
    marginBottom: 20,
  },
  logoutBtnText: { color: "#FF6A6A", fontWeight: "800", fontSize: 16 },
  modalOverlay: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.5)",
    justifyContent: "flex-end",
  },
  modalContent: {
    height: SCREEN_HEIGHT * 0.75,
    borderTopLeftRadius: 35,
    borderTopRightRadius: 35,
    padding: 25,
  },
  modalHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    marginBottom: 20,
  },
  modalTitle: { fontSize: 22, fontWeight: "900" },
  searchContainer: {
    flexDirection: "row",
    alignItems: "center",
    paddingHorizontal: 15,
    borderRadius: 15,
    height: 50,
    marginBottom: 20,
  },
  searchInput: { flex: 1, marginLeft: 10, fontWeight: "600" },
  currencyRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 15,
    borderBottomWidth: 1,
    borderBottomColor: "rgba(0,0,0,0.03)",
  },
  currencyInfo: { flexDirection: "row", alignItems: "center", gap: 15 },
  currencyCircle: {
    width: 45,
    height: 45,
    borderRadius: 22.5,
    backgroundColor: "#FF6A6A15",
    justifyContent: "center",
    alignItems: "center",
  },
  symbolText: { color: "#FF6A6A", fontWeight: "900", fontSize: 18 },
  currencyName: { fontSize: 16, fontWeight: "700" },
  currencyCode: { fontSize: 12, color: "#94A3B8", fontWeight: "600" },
});
