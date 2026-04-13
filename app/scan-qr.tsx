import { useState, useRef, useEffect } from "react";
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
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { CameraView, useCameraPermissions } from "expo-camera";
import * as ImagePicker from "expo-image-picker";
import * as FileSystem from "expo-file-system/legacy";
import { useRouter } from "expo-router";
import AsyncStorage from "@react-native-async-storage/async-storage";
import { WebView } from "react-native-webview";
import jsQR from "jsqr";
import { BlurView } from "expo-blur";
import { MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

const { width, height } = Dimensions.get("window");
const innerDimension = width * 0.7;

export default function ScanQR() {
  const router = useRouter();
  const webViewRef = useRef<WebView>(null);
  const [permission, requestPermission] = useCameraPermissions();
  const [scanned, setScanned] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  // --- ANIMATIONS ---
  const scanLineAnim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (!scanned) {
      Animated.loop(
        Animated.sequence([
          Animated.timing(scanLineAnim, {
            toValue: 1,
            duration: 2000,
            useNativeDriver: true,
          }),
          Animated.timing(scanLineAnim, {
            toValue: 0,
            duration: 2000,
            useNativeDriver: true,
          }),
        ]),
      ).start();
    }
  }, [scanned]);

  const translateY = scanLineAnim.interpolate({
    inputRange: [0, 1],
    outputRange: [0, innerDimension - 2],
  });

  const saveAndNavigate = async (code: any) => {
    let finalCode = code;

    try {
      const parsed = JSON.parse(code);

      // ✅ handle both formats
      finalCode = parsed.house_code || parsed.houseCode || parsed.code || code;
    } catch {
      // not JSON, use raw string
      finalCode = code;
    }

    await AsyncStorage.setItem("pending_house_code", finalCode);

    Alert.alert("🔑 House Code Linked", "Ready to join the tribe?", [
      {
        text: "Continue Signup",
        onPress: () => router.replace("/(auth)/signup"),
      },
    ]);
  };

  const handleBarCodeScanned = ({ data }: { data: string }) => {
    if (scanned) return;
    setScanned(true);
    saveAndNavigate(data);
  };

  const pickImageAndScan = async () => {
    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ["images"],
      allowsEditing: false,
      quality: 1,
    });

    if (!result.canceled && result.assets.length > 0) {
      setIsProcessing(true);
      const uri = result.assets[0].uri;

      try {
        const base64 = await FileSystem.readAsStringAsync(uri, {
          encoding: FileSystem.EncodingType.Base64,
        });

        const jsInject = `
          (function() {
            var img = new Image();
            img.onload = function() {
              var canvas = document.createElement('canvas');
              canvas.width = img.width; canvas.height = img.height;
              var ctx = canvas.getContext('2d');
              ctx.drawImage(img, 0, 0);
              var imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
              window.ReactNativeWebView.postMessage(JSON.stringify({
                pixels: Array.from(imageData.data), width: imageData.width, height: imageData.height
              }));
            };
            img.src = "data:image/jpeg;base64,${base64}";
          })(); true;
        `;
        webViewRef.current?.injectJavaScript(jsInject);
      } catch (err) {
        setIsProcessing(false);
        Alert.alert("Error", "Could not read image.");
      }
    }
  };

  const onWebViewMessage = (event: any) => {
    const data = JSON.parse(event.nativeEvent.data);
    setIsProcessing(false);
    if (data.pixels) {
      const code = jsQR(
        new Uint8ClampedArray(data.pixels),
        data.width,
        data.height,
      );
      if (code?.data) saveAndNavigate(code.data);
      else Alert.alert("No QR Code", "Try a clearer image.");
    }
  };

  if (!permission) return <View style={styles.darkBg} />;

  if (!permission.granted) {
    return (
      <View style={styles.center}>
        <BlurView intensity={20} style={styles.permissionCard}>
          <Ionicons name="camera-outline" size={60} color="#FF6B6B" />
          <Text style={styles.permissionTitle}>Camera Access</Text>
          <Text style={styles.permissionSubtitle}>
            We need your camera to scan House QR codes.
          </Text>
          <TouchableOpacity style={styles.grantBtn} onPress={requestPermission}>
            <Text style={styles.grantBtnText}>Allow Camera</Text>
          </TouchableOpacity>
        </BlurView>
      </View>
    );
  }

  return (
    <View style={styles.container}>
      <CameraView
        style={StyleSheet.absoluteFillObject}
        // ADD THIS PROP: It tells the native module to look for QR codes
        barcodeScannerSettings={{
          barcodeTypes: ["qr"],
        }}
        onBarcodeScanned={scanned ? undefined : handleBarCodeScanned}
      />

      {/* VIEW FINDER OVERLAY */}
      <View style={styles.overlay}>
        <View style={styles.unfocusedContainer}></View>
        <View style={styles.middleRow}>
          <View style={styles.unfocusedContainer}></View>
          <View style={styles.viewfinder}>
            <View style={[styles.corner, styles.topLeft]} />
            <View style={[styles.corner, styles.topRight]} />
            <View style={[styles.corner, styles.bottomLeft]} />
            <View style={[styles.corner, styles.bottomRight]} />
            {!scanned && (
              <Animated.View
                style={[styles.scanLine, { transform: [{ translateY }] }]}
              />
            )}
          </View>
          <View style={styles.unfocusedContainer}></View>
        </View>
        <View style={styles.unfocusedContainer}>
          <Text style={styles.instructionText}>
            Center the QR code within the frame
          </Text>
        </View>
      </View>

      {/* CONTROLS */}
      <SafeAreaView style={styles.uiLayer}>
        <View style={styles.header}>
          <TouchableOpacity
            style={styles.roundBtn}
            onPress={() => router.replace("/login")}
          >
            <Ionicons name="chevron-back" size={24} color="#FFF" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Scan QR</Text>
          <View style={{ width: 44 }} />
        </View>

        <View style={styles.footer}>
          <BlurView intensity={30} tint="dark" style={styles.footerBlur}>
            {isProcessing ? (
              <ActivityIndicator color="#FF6B6B" />
            ) : (
              <TouchableOpacity
                style={styles.actionBtn}
                onPress={pickImageAndScan}
              >
                <MaterialCommunityIcons
                  name="image-multiple"
                  size={24}
                  color="#FFF"
                />
                <Text style={styles.actionText}>Gallery</Text>
              </TouchableOpacity>
            )}

            <View style={styles.divider} />

            <TouchableOpacity
              style={styles.actionBtn}
              onPress={() => setScanned(false)}
              disabled={!scanned}
            >
              <MaterialCommunityIcons
                name="refresh"
                size={24}
                color={scanned ? "#FFF" : "#666"}
              />
              <Text
                style={[
                  styles.actionText,
                  { color: scanned ? "#FFF" : "#666" },
                ]}
              >
                Reset
              </Text>
            </TouchableOpacity>
          </BlurView>
        </View>
      </SafeAreaView>

      <View style={{ height: 0, width: 0, opacity: 0 }}>
        <WebView
          ref={webViewRef}
          onMessage={onWebViewMessage}
          javaScriptEnabled={true}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#000" },
  darkBg: { flex: 1, backgroundColor: "#000" },
  center: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "#121212",
  },

  // Viewfinder Logic
  overlay: { position: "absolute", top: 0, left: 0, right: 0, bottom: 0 },
  unfocusedContainer: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.6)",
    justifyContent: "center",
    alignItems: "center",
  },
  middleRow: { flexDirection: "row", height: innerDimension },
  viewfinder: {
    width: innerDimension,
    height: innerDimension,
    position: "relative",
  },

  // Corners
  corner: {
    position: "absolute",
    width: 30,
    height: 30,
    borderColor: "#FF6B6B",
    borderWidth: 4,
  },
  topLeft: {
    top: 0,
    left: 0,
    borderRightWidth: 0,
    borderBottomWidth: 0,
    borderTopLeftRadius: 15,
  },
  topRight: {
    top: 0,
    right: 0,
    borderLeftWidth: 0,
    borderBottomWidth: 0,
    borderTopRightRadius: 15,
  },
  bottomLeft: {
    bottom: 0,
    left: 0,
    borderRightWidth: 0,
    borderTopWidth: 0,
    borderBottomLeftRadius: 15,
  },
  bottomRight: {
    bottom: 0,
    right: 0,
    borderLeftWidth: 0,
    borderTopWidth: 0,
    borderBottomRightRadius: 15,
  },

  scanLine: {
    width: "100%",
    height: 3,
    backgroundColor: "#FF6B6B",
    shadowColor: "#FF6B6B",
    shadowOpacity: 0.8,
    shadowRadius: 10,
    elevation: 5,
  },

  // UI Components
  uiLayer: { flex: 1, justifyContent: "space-between", padding: 20 },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
  },
  headerTitle: {
    color: "#FFF",
    fontSize: 18,
    fontWeight: "900",
    letterSpacing: 1,
  },
  roundBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: "rgba(255,255,255,0.2)",
    justifyContent: "center",
    alignItems: "center",
  },

  instructionText: {
    color: "rgba(255,255,255,0.7)",
    fontSize: 14,
    fontWeight: "600",
    marginTop: 20,
  },

  footer: { alignItems: "center", marginBottom: 30 },
  footerBlur: {
    flexDirection: "row",
    borderRadius: 30,
    paddingHorizontal: 30,
    paddingVertical: 15,
    alignItems: "center",
    overflow: "hidden",
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
  },
  actionBtn: { alignItems: "center", paddingHorizontal: 20 },
  actionText: { color: "#FFF", fontSize: 12, fontWeight: "800", marginTop: 4 },
  divider: { width: 1, height: 30, backgroundColor: "rgba(255,255,255,0.2)" },

  // Permissions
  permissionCard: {
    padding: 40,
    borderRadius: 30,
    alignItems: "center",
    width: width * 0.8,
  },
  permissionTitle: {
    color: "#FFF",
    fontSize: 22,
    fontWeight: "900",
    marginTop: 20,
  },
  permissionSubtitle: {
    color: "#999",
    textAlign: "center",
    marginTop: 10,
    lineHeight: 20,
  },
  grantBtn: {
    backgroundColor: "#FF6B6B",
    paddingHorizontal: 40,
    paddingVertical: 15,
    borderRadius: 20,
    marginTop: 30,
  },
  grantBtnText: { color: "#FFF", fontWeight: "900" },
});
