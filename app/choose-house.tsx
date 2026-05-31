import { useState, useRef, useEffect, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Alert,
  Dimensions,
  Animated,
  Platform,
  ActivityIndicator,
  TextInput,
  KeyboardAvoidingView,
  ScrollView,
  BackHandler,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { useKeyboardBottomPadding } from "../src/hooks/useKeyboardBottomPadding";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import { useNavigation } from "@react-navigation/native";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import jsQR from "jsqr";
import { BlurView } from "expo-blur";
import { LinearGradient } from "expo-linear-gradient";
import {
  MaterialCommunityIcons,
  Ionicons,
  FontAwesome5,
} from "@expo/vector-icons";
import { apiClient } from "@/src/utils/apiClient";
import {
  clearPendingHouseCode,
  extractHouseCodeFromQrPayload,
  peekPendingHouseCode,
} from "@/src/utils/houseInviteLink";
import { notifyStoredUserUpdated } from "@/src/auth/userSessionBridge";

const { width, height } = Dimensions.get("window");
const SCANNER_SIZE = width * 0.75;

export default function ChooseHouse() {
  const router = useRouter();
  const navigation = useNavigation();
  const keyboardScrollPad = useKeyboardBottomPadding(32);
  const webViewRef = useRef<WebView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [manualCode, setManualCode] = useState("");

  useEffect(() => {
    (async () => {
      const pending = await peekPendingHouseCode();
      if (pending) {
        setManualCode((prev) => (prev.trim() ? prev : pending));
      }
    })();
  }, []);

  const returnToLogin = useCallback(async () => {
    try {
      await clearPendingHouseCode();
      await AsyncStorage.multiRemove(["token", "user", "house"]);
    } catch {
      /* still navigate */
    }
    router.replace("/(auth)/login");
  }, [router]);

  const handleBack = useCallback(() => {
    if (navigation.canGoBack()) {
      navigation.goBack();
      return;
    }
    Alert.alert(
      "Leave setup?",
      "Sign out and return to login. You can sign in again with Google, Apple, or email.",
      [
        { text: "Stay", style: "cancel" },
        { text: "Sign out", style: "destructive", onPress: () => void returnToLogin() },
      ],
    );
  }, [navigation, returnToLogin]);

  useEffect(() => {
    const sub = BackHandler.addEventListener("hardwareBackPress", () => {
      handleBack();
      return true;
    });
    return () => sub.remove();
  }, [handleBack]);

  // Animations
  const scanLineAnim = useRef(new Animated.Value(0)).current;
  const fadeAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 800,
      useNativeDriver: true,
    }).start();

    Animated.loop(
      Animated.sequence([
        Animated.timing(scanLineAnim, {
          toValue: 1,
          duration: 2500,
          useNativeDriver: true,
        }),
        Animated.timing(scanLineAnim, {
          toValue: 0,
          duration: 2500,
          useNativeDriver: true,
        }),
      ]),
    ).start();
  }, []);

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, SCANNER_SIZE - 4],
  });

  const saveAndNavigate = async (code: string) => {
    if (!code || code.trim().length < 3) {
      Alert.alert("Invalid Code", "Please enter a valid house code.");
      return;
    }
    const finalCode = extractHouseCodeFromQrPayload(code);
    setIsProcessing(true);
    try {
      const token = await AsyncStorage.getItem("token");
      if (!token) return Alert.alert("Error", "You are not logged in");
      const data = await apiClient(
        "/join-house",
        "POST",
        { house_code: finalCode.trim() },
        token,
      );
      if (data?.house) {
        await clearPendingHouseCode();
        const userStr = await AsyncStorage.getItem("user");
        const user = userStr ? JSON.parse(userStr) : {};
        user.house_id = data.house.id;
        user.role = data.user.role;
        user.status = data.user.status;
        await AsyncStorage.setItem("user", JSON.stringify(user));
        notifyStoredUserUpdated();
        await AsyncStorage.setItem("house", JSON.stringify(data.house));
        router.replace("/(tabs)/dashboard");
      }
    } catch (err: any) {
      Alert.alert(
        "Error",
        err.response?.data?.message || "Failed to join house.",
      );
    } finally {
      setIsProcessing(false);
    }
  };

  const createHouse = async () => {
    try {
      const token = await AsyncStorage.getItem("token");
      const userStr = await AsyncStorage.getItem("user");
      if (!token || !userStr) return;
      const user = JSON.parse(userStr);
      const data = await apiClient(
        "/house/create",
        "POST",
        { name: `${user.name}'s House`, currency: "$" },
        token,
      );
      if (data?.house) {
        await AsyncStorage.setItem("house", JSON.stringify(data.house));
        await AsyncStorage.setItem(
          "user",
          JSON.stringify({
            ...user,
            house_id: data.house.id,
            role: "admin",
            status: "admin",
          }),
        );
        notifyStoredUserUpdated();
        router.replace("/(tabs)/dashboard");
      }
    } catch (err: any) {
      Alert.alert("Error", "Failed to create house");
    }
  };

  const pickImageAndScan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });
    if (!result.canceled && result.assets.length > 0) {
      setIsProcessing(true);
      const base64 = await FileSystem.readAsStringAsync(result.assets[0].uri, {
        encoding: FileSystem.EncodingType.Base64,
      });
      const jsInject = `(function() { var img = new Image(); img.onload = function() { var canvas = document.createElement('canvas'); canvas.width = img.width; canvas.height = img.height; var ctx = canvas.getContext('2d'); ctx.drawImage(img, 0, 0); var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height); window.ReactNativeWebView.postMessage(JSON.stringify({ pixels: Array.from(imageData.data), width: imageData.width, height: imageData.height })); }; img.src = "data:image/jpeg;base64,${base64}"; })(); true;`;
      webViewRef.current?.injectJavaScript(jsInject);
    }
  };

  if (!permission?.granted) {
    return (
      <View style={styles.center}>
        <LinearGradient
          colors={["#F8FAFC", "#E2E8F0"]}
          style={StyleSheet.absoluteFill}
        />
        <SafeAreaView style={styles.permissionBackWrap}>
          <TouchableOpacity
            style={styles.backBtn}
            onPress={handleBack}
            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
          >
            <BlurView intensity={20} style={styles.blurBack}>
              <Ionicons name="chevron-back" size={24} color="#1E293B" />
            </BlurView>
          </TouchableOpacity>
        </SafeAreaView>
        <View style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={64} color="#FF6A6A" />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionSub}>
            We need camera access to scan your house QR code.
          </Text>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
            <Text style={styles.grantBtnText}>Enable Camera</Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={styles.container}
    >
      <LinearGradient
        colors={["#F8FAFC", "#F1F5F9"]}
        style={StyleSheet.absoluteFill}
      />

      <ScrollView
        contentContainerStyle={[
          styles.scrollContent,
          { paddingBottom: keyboardScrollPad },
        ]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
        keyboardDismissMode="interactive"
      >
        <SafeAreaView style={styles.safeArea}>
          {/* PREMIUM HEADER */}
          <View style={styles.header}>
            <TouchableOpacity
              style={styles.backBtn}
              onPress={handleBack}
              hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
            >
              <BlurView intensity={20} style={styles.blurBack}>
                <Ionicons name="chevron-back" size={24} color="#1E293B" />
              </BlurView>
            </TouchableOpacity>
            <View>
              <Text style={styles.headerTitle}>HabiMate</Text>
              <Text style={styles.headerSub}>Join a home or create your own</Text>
            </View>
            <View style={{ width: 45 }} />
          </View>

          <Animated.View style={{ opacity: fadeAnim, flex: 1 }}>
            {/* SCANNER AREA */}
            <View style={styles.scannerWrapper}>
              <View style={styles.cameraFrame}>
                <CameraView
                  style={styles.camera}
                  onBarcodeScanned={
                    scanned
                      ? undefined
                      : ({ data }) => {
                          setScanned(true);
                          saveAndNavigate(data);
                        }
                  }
                />
                <View style={styles.scannerOverlay}>
                  <View style={[styles.corner, styles.topLeft]} />
                  <View style={[styles.corner, styles.topRight]} />
                  <View style={[styles.corner, styles.bottomLeft]} />
                  <View style={[styles.corner, styles.bottomRight]} />
                  <Animated.View
                    style={[styles.scanLine, { transform: [{ translateY }] }]}
                  >
                    <LinearGradient
                      colors={["transparent", "#FF6A6A", "transparent"]}
                      start={{ x: 0, y: 0 }}
                      end={{ x: 1, y: 0 }}
                      style={{ flex: 1 }}
                    />
                  </Animated.View>
                </View>
              </View>

              <TouchableOpacity
                style={styles.galleryTrigger}
                onPress={pickImageAndScan}
              >
                <MaterialCommunityIcons
                  name="image-album"
                  size={20}
                  color="#FF6A6A"
                />
                <Text style={styles.galleryText}>Import from Gallery</Text>
              </TouchableOpacity>
            </View>

            {/* ACTION SECTION */}
            <View style={styles.formSection}>
              <View style={styles.premiumInputCard}>
                <Text style={styles.inputLabel}>HOUSE CODE</Text>
                <View style={styles.inputRow}>
                  <TextInput
                    style={styles.input}
                    placeholder="E.g. HM-882-QX"
                    placeholderTextColor="#CBD5E1"
                    value={manualCode}
                    onChangeText={setManualCode}
                    autoCapitalize="characters"
                  />
                  <TouchableOpacity
                    style={styles.joinBtn}
                    onPress={() => saveAndNavigate(manualCode)}
                  >
                    <Text style={styles.joinBtnText}>Join</Text>
                  </TouchableOpacity>
                </View>
              </View>

              <View style={styles.dividerContainer}>
                <View style={styles.line} />
                <Text style={styles.dividerText}>OR</Text>
                <View style={styles.line} />
              </View>

              <TouchableOpacity style={styles.createBtn} onPress={createHouse}>
                <LinearGradient
                  colors={["#FF8E8E", "#FF6A6A"]}
                  style={styles.gradientBtn}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                >
                  <FontAwesome5
                    name="home"
                    size={18}
                    color="#FFF"
                    style={{ marginRight: 12 }}
                  />
                  <Text style={styles.createBtnText}>Create New House</Text>
                </LinearGradient>
              </TouchableOpacity>
            </View>
          </Animated.View>
        </SafeAreaView>
      </ScrollView>

      <View style={{ height: 0, width: 0, opacity: 0 }}>
        <WebView
          ref={webViewRef}
          onMessage={(event) => {
            const data = JSON.parse(event.nativeEvent.data);
            setIsProcessing(false);
            if (data.pixels) {
              const code = jsQR(
                new Uint8ClampedArray(data.pixels),
                data.width,
                data.height,
              );
              if (code?.data) saveAndNavigate(code.data);
              else Alert.alert("Scan Failed", "No QR code detected in image.");
            }
          }}
          javaScriptEnabled={true}
        />
      </View>

      {isProcessing && (
        <BlurView intensity={30} style={styles.loadingOverlay}>
          <ActivityIndicator size="large" color="#FF6A6A" />
        </BlurView>
      )}
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scrollContent: { flexGrow: 1, paddingBottom: 40 },
  safeArea: { flex: 1, paddingHorizontal: 24 },
  center: { flex: 1, justifyContent: "center", alignItems: "center" },
  permissionBackWrap: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    paddingHorizontal: 24,
    zIndex: 10,
  },
  backBtn: {
    width: 45,
    height: 45,
  },

  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    paddingVertical: 20,
    marginBottom: 10,
  },
  blurBack: {
    width: 45,
    height: 45,
    borderRadius: 15,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "rgba(255,255,255,0.8)",
    borderWidth: 1,
    borderColor: "#FFF",
  },
  headerTitle: {
    fontSize: 24,
    fontWeight: "900",
    color: "#1E293B",
    textAlign: "center",
  },
  headerSub: {
    fontSize: 13,
    color: "#64748B",
    fontWeight: "600",
    textAlign: "center",
    marginTop: -2,
  },

  scannerWrapper: { alignItems: "center", marginTop: 10 },
  cameraFrame: {
    width: SCANNER_SIZE,
    height: SCANNER_SIZE,
    borderRadius: 40,
    overflow: "hidden",
    backgroundColor: "#000",
    borderWidth: 8,
    borderColor: "#FFF",
    shadowColor: "#000",
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.15,
    shadowRadius: 30,
    elevation: 15,
  },
  camera: { flex: 1 },
  scannerOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
  },

  // High-end Corners
  corner: {
    position: "absolute",
    width: 40,
    height: 40,
    borderColor: "#FF6A6A",
    borderWidth: 5,
  },
  topLeft: {
    top: 30,
    left: 30,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 20,
  },
  topRight: {
    top: 30,
    right: 30,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 20,
  },
  bottomLeft: {
    bottom: 30,
    left: 30,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 20,
  },
  bottomRight: {
    bottom: 30,
    right: 30,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 20,
  },

  scanLine: {
    width: "70%",
    height: 3,
    shadowColor: "#FF6A6A",
    shadowOpacity: 1,
    shadowRadius: 10,
    elevation: 10,
  },

  galleryTrigger: {
    flexDirection: "row",
    alignItems: "center",
    marginTop: 25,
    paddingHorizontal: 20,
    paddingVertical: 12,
    backgroundColor: "#FFF",
    borderRadius: 20,
    shadowColor: "#000",
    shadowOpacity: 0.05,
    shadowRadius: 10,
    elevation: 5,
  },
  galleryText: {
    color: "#64748B",
    fontWeight: "700",
    marginLeft: 10,
    fontSize: 14,
  },

  formSection: { marginTop: 35 },
  premiumInputCard: {
    backgroundColor: "#FFF",
    borderRadius: 25,
    padding: 20,
    shadowColor: "#000",
    shadowOpacity: 0.04,
    shadowRadius: 20,
    elevation: 3,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.8)",
  },
  inputLabel: {
    fontSize: 11,
    fontWeight: "900",
    color: "#94A3B8",
    letterSpacing: 2,
    marginBottom: 12,
  },
  inputRow: { flexDirection: "row", alignItems: "center" },
  input: {
    flex: 1,
    fontSize: 18,
    fontWeight: "700",
    color: "#1E293B",
    paddingVertical: 5,
  },
  joinBtn: {
    backgroundColor: "#1E293B",
    paddingHorizontal: 22,
    paddingVertical: 12,
    borderRadius: 15,
  },
  joinBtnText: { color: "#FFF", fontWeight: "800", fontSize: 14 },

  dividerContainer: {
    flexDirection: "row",
    alignItems: "center",
    marginVertical: 25,
    opacity: 0.4,
  },
  line: { flex: 1, height: 1, backgroundColor: "#94A3B8" },
  dividerText: {
    marginHorizontal: 15,
    color: "#64748B",
    fontSize: 12,
    fontWeight: "900",
  },

  createBtn: {
    width: "100%",
    height: 65,
    borderRadius: 22,
    overflow: "hidden",
    elevation: 8,
    shadowColor: "#FF6A6A",
    shadowOpacity: 0.3,
    shadowRadius: 15,
    shadowOffset: { width: 0, height: 8 },
  },
  gradientBtn: {
    flex: 1,
    flexDirection: "row",
    justifyContent: "center",
    alignItems: "center",
  },
  createBtnText: {
    color: "#FFF",
    fontSize: 17,
    fontWeight: "900",
    letterSpacing: 0.5,
  },

  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: "center",
    alignItems: "center",
    zIndex: 99,
  },

  permissionCard: {
    backgroundColor: "#FFF",
    padding: 40,
    borderRadius: 35,
    alignItems: "center",
    width: width * 0.85,
    shadowOpacity: 0.1,
  },
  permissionTitle: {
    fontSize: 22,
    fontWeight: "900",
    color: "#1E293B",
    marginTop: 20,
  },
  permissionSub: {
    textAlign: "center",
    color: "#64748B",
    marginTop: 10,
    lineHeight: 20,
  },
  grantBtn: {
    backgroundColor: "#FF6A6A",
    paddingHorizontal: 35,
    paddingVertical: 15,
    borderRadius: 20,
    marginTop: 25,
  },
  grantBtnText: { color: "#FFF", fontWeight: "800" },
});
