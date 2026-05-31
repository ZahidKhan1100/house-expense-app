import AsyncStorage from "@react-native-async-storage/async-storage";
import { useCallback, useEffect, useState } from "react";

import { subscribeStoredUser } from "../auth/userSessionBridge";

/**
 * Mirrors AsyncStorage `user` and re-reads whenever {@link notifyStoredUserUpdated} runs
 * (login, profile save, karma sync, etc.).
 */
export function useStoredUser(): Record<string, unknown> | null {
  const [user, setUser] = useState<Record<string, unknown> | null>(null);

  const reload = useCallback(async () => {
    try {
      const raw = await AsyncStorage.getItem("user");
      setUser(raw ? (JSON.parse(raw) as Record<string, unknown>) : null);
    } catch {
      setUser(null);
    }
  }, []);

  useEffect(() => {
    void reload();
    return subscribeStoredUser(() => {
      void reload();
    });
  }, [reload]);

  return user;
}
