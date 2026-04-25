import AsyncStorage from "@react-native-async-storage/async-storage";
import Toast from "react-native-toast-message";

import {
  ApiClientError,
  apiClient,
  getApiErrorMessage,
} from "../utils/apiClient";
import {
  emitPendingSync,
  listAllOrdered,
  removeAction,
  type PendingRow,
  type RunningLowPayload,
} from "./pendingActionsStore";

let syncing = false;

function isPermanentClientFailure(status: number | undefined): boolean {
  if (status == null) return false;
  if (status === 401 || status === 403) return true;
  if (status === 408 || status === 429) return false;
  if (status >= 400 && status < 500) return true;
  return false;
}

async function processRow(row: PendingRow, token: string): Promise<"ok" | "retry" | "stop"> {
  try {
    if (row.type === "expense_create") {
      const body = JSON.parse(row.payload);
      await apiClient("/records", "POST", body, token);
    } else if (row.type === "fridge_note") {
      const parsed = JSON.parse(row.payload) as { body: string | null };
      await apiClient(
        "/house-wall/fridge-note",
        "PUT",
        { body: parsed.body },
        token,
      );
    } else if (row.type === "running_low") {
      const parsed = JSON.parse(row.payload) as RunningLowPayload;
      if ("item_key" in parsed && parsed.item_key) {
        await apiClient(
          "/house-wall/running-low",
          "POST",
          { item_key: parsed.item_key },
          token,
        );
      } else if ("custom_label" in parsed && parsed.custom_label) {
        await apiClient(
          "/house-wall/running-low",
          "POST",
          { custom_label: parsed.custom_label },
          token,
        );
      } else {
        await removeAction(row.action_id);
        return "ok";
      }
    } else {
      await removeAction(row.action_id);
      return "ok";
    }
    await removeAction(row.action_id);
    return "ok";
  } catch (err) {
    const status = err instanceof ApiClientError ? err.status : undefined;
    const msg = getApiErrorMessage(err, "Sync failed");

    if (status === 401) {
      Toast.show({
        type: "error",
        text1: "Session expired",
        text2: "Sign in again to sync offline changes.",
      });
      await removeAction(row.action_id);
      return "stop";
    }

    if (isPermanentClientFailure(status)) {
      Toast.show({
        type: "error",
        text1: "Couldn't sync an offline change",
        text2: msg,
      });
      await removeAction(row.action_id);
      return "ok";
    }

    return "retry";
  }
}

/** Push queued offline actions to the API (FIFO). Safe to call often. */
export async function syncPendingActions(): Promise<void> {
  if (syncing) return;
  const token = await AsyncStorage.getItem("token");
  if (!token) return;

  syncing = true;
  let progressed = 0;
  try {
    const rows = await listAllOrdered();
    if (rows.length === 0) return;

    for (const row of rows) {
      const result = await processRow(row, token);
      if (result === "stop") break;
      if (result === "retry") break;
      progressed += 1;
    }

    const remaining = await listAllOrdered();
    if (remaining.length === 0 && progressed > 0) {
      Toast.show({
        type: "success",
        text1: "All caught up",
        text2: "Offline changes are synced.",
      });
    }
  } catch (e) {
    console.warn("syncPendingActions", e);
  } finally {
    emitPendingSync();
    syncing = false;
  }
}
