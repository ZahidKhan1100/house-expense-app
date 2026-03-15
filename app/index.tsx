// app/index.tsx
import { Redirect } from "expo-router";
import { onAuthStateChanged } from "firebase/auth";
import { auth } from "../firebase";
import { useState, useEffect } from "react";
import { View, ActivityIndicator } from "react-native";

export default function Index() {
  const [user, setUser] = useState<any>(null);
  const [initializing, setInitializing] = useState(true);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, (u) => {
      setUser(u);
      setInitializing(false);
    });
    return unsub;
  }, []);

  if (initializing) return <ActivityIndicator />;

  // Redirect based on auth status
  return user ? <Redirect href="/(tabs)/dashboard" /> : <Redirect href="/(auth)/login" />;
}