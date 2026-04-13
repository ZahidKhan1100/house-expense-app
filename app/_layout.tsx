import React, { useContext, useEffect } from "react";
import { View, ActivityIndicator, StyleSheet } from "react-native";
import { Slot, useRouter } from "expo-router";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import Toast from "react-native-toast-message";
import * as Linking from "expo-linking";

import { ThemeProvider } from "./theme/ThemeContext";
import { AuthProvider, AuthContext } from "../src/context/AuthContext";

function AppContent() {
  const { loading } = useContext(AuthContext);

  if (loading) {
    return (
      <View style={styles.loaderContainer}>
        <ActivityIndicator size="large" color="#FF6B6B" />
      </View>
    );
  }

  return <Slot />;
}

export default function RootLayout() {
  const router = useRouter();

  useEffect(() => {
    const handleDeepLink = (event: any) => {
      const data = Linking.parse(event.url);

      console.log("🔗 Deep link:", data);

      if (data.path === "reset-password") {
        router.push({
          pathname: "/reset-password",
          params: {
            token: data.queryParams?.token,
            email: data.queryParams?.email,
          },
        });
      }
    };

    // When app is already open
    const sub = Linking.addEventListener("url", handleDeepLink);

    // When app opens from closed state
    Linking.getInitialURL().then((url) => {
      if (url) handleDeepLink({ url });
    });

    return () => sub.remove();
  }, []);

  return (
    <SafeAreaProvider>
      <ThemeProvider>
        <GestureHandlerRootView style={styles.container}>
          <AuthProvider>
            <AppContent />
            <Toast />
          </AuthProvider>
        </GestureHandlerRootView>
      </ThemeProvider>
    </SafeAreaProvider>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  loaderContainer: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    backgroundColor: "transparent",
  },
});