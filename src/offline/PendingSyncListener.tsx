import NetInfo from "@react-native-community/netinfo";
import { useEffect, useRef } from "react";
import { AppState, AppStateStatus } from "react-native";

import { initPendingActionsStore } from "./pendingActionsStore";
import { syncPendingActions } from "./syncPendingActions";

/**
 * Boots the offline queue DB and runs sync when connectivity returns or app becomes active.
 */
export function PendingSyncListener() {
  const appState = useRef(AppState.currentState);

  useEffect(() => {
    let cancelled = false;

    void (async () => {
      try {
        await initPendingActionsStore();
        if (!cancelled) await syncPendingActions();
      } catch (e) {
        console.warn("Offline queue init/sync", e);
      }
    })();

    // Do not require isInternetReachable: it is often false/null briefly after reconnect,
    // or wrong on some networks — users stay stuck on "Syncing…" while fully online.
    const unsubNet = NetInfo.addEventListener((state) => {
      if (state.isConnected === true) {
        void syncPendingActions();
      }
    });

    const subApp = AppState.addEventListener(
      "change",
      (next: AppStateStatus) => {
        if (
          appState.current.match(/inactive|background/) &&
          next === "active"
        ) {
          void syncPendingActions();
        }
        appState.current = next;
      },
    );

    return () => {
      cancelled = true;
      unsubNet();
      subApp.remove();
    };
  }, []);

  return null;
}
