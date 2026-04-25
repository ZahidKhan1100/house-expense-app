import AsyncStorage from "@react-native-async-storage/async-storage";
import { Platform } from "react-native";

const WEB_KEY = "offline_pending_actions_v1";

export type PendingActionType =
  | "expense_create"
  | "fridge_note"
  | "running_low";

export type ExpenseCreatePayload = {
  description: string;
  amount: number;
  category_id: number;
  included_mates: string[];
  paid_by: string;
  month: string;
  split_method: "equal" | "days";
  excluded_days_by_user?: Record<string, number>;
  guest_extra_days_by_user?: Record<string, number>;
};

export type FridgeNotePayload = { body: string | null };

/** POST /house-wall/running-low — preset chip or custom label (not both). */
export type RunningLowPayload =
  | { item_key: string }
  | { custom_label: string };

export type PendingRow = {
  action_id: string;
  type: PendingActionType;
  payload: string;
  created_at: number;
};

const listeners = new Set<() => void>();

export function subscribePendingSync(cb: () => void): () => void {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

function emitPendingSync() {
  listeners.forEach((l) => {
    try {
      l();
    } catch {
      // ignore
    }
  });
}

function randomActionId(): string {
  return `a_${Date.now()}_${Math.random().toString(36).slice(2, 12)}`;
}

// ——— Web / fallback: AsyncStorage JSON ———

async function webLoad(): Promise<PendingRow[]> {
  try {
    const raw = await AsyncStorage.getItem(WEB_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as PendingRow[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

async function webSave(rows: PendingRow[]) {
  await AsyncStorage.setItem(WEB_KEY, JSON.stringify(rows));
}

// ——— Native: expo-sqlite ———

type DbMode = { kind: "sqlite"; db: import("expo-sqlite").SQLiteDatabase } | { kind: "web" };

let storePromise: Promise<DbMode> | null = null;

async function getStore(): Promise<DbMode> {
  if (storePromise) return storePromise;
  storePromise = (async () => {
    if (Platform.OS === "web") {
      return { kind: "web" };
    }
    try {
      const { openDatabaseAsync } = await import("expo-sqlite");
      const db = await openDatabaseAsync("habimate_offline.db");
      await db.execAsync(`
        CREATE TABLE IF NOT EXISTS pending_actions (
          action_id TEXT PRIMARY KEY NOT NULL,
          type TEXT NOT NULL,
          payload TEXT NOT NULL,
          created_at INTEGER NOT NULL
        );
      `);
      return { kind: "sqlite", db };
    } catch (e) {
      console.warn("expo-sqlite init failed, using AsyncStorage queue", e);
      return { kind: "web" };
    }
  })();
  return storePromise;
}

export async function initPendingActionsStore(): Promise<void> {
  await getStore();
}

export async function listAllOrdered(): Promise<PendingRow[]> {
  const s = await getStore();
  if (s.kind === "sqlite") {
    const rows = await s.db.getAllAsync<{
      action_id: string;
      type: string;
      payload: string;
      created_at: number;
    }>(
      `SELECT action_id, type, payload, created_at FROM pending_actions ORDER BY created_at ASC`,
      [],
    );
    return rows.map((r) => ({
      action_id: r.action_id,
      type: r.type as PendingActionType,
      payload: r.payload,
      created_at: r.created_at,
    }));
  }
  const all = await webLoad();
  return all.slice().sort((a, b) => a.created_at - b.created_at);
}

export async function listExpenseCreates(): Promise<PendingRow[]> {
  const all = await listAllOrdered();
  return all.filter((r) => r.type === "expense_create");
}

export async function countPendingRunningLow(): Promise<number> {
  const all = await listAllOrdered();
  return all.filter((r) => r.type === "running_low").length;
}

export async function enqueueRunningLow(
  payload: RunningLowPayload,
): Promise<string> {
  const hasKey =
    "item_key" in payload &&
    typeof (payload as { item_key?: string }).item_key === "string" &&
    String((payload as { item_key: string }).item_key).trim().length > 0;
  const hasCustom =
    "custom_label" in payload &&
    typeof (payload as { custom_label?: string }).custom_label === "string" &&
    String((payload as { custom_label: string }).custom_label).trim().length >
      0;
  if (hasKey === hasCustom) {
    throw new Error("enqueueRunningLow: pass item_key or custom_label");
  }

  const action_id = randomActionId();
  const row: PendingRow = {
    action_id,
    type: "running_low",
    payload: JSON.stringify(payload),
    created_at: Date.now(),
  };
  const s = await getStore();
  if (s.kind === "sqlite") {
    await s.db.runAsync(
      `INSERT INTO pending_actions (action_id, type, payload, created_at) VALUES (?, ?, ?, ?)`,
      [row.action_id, row.type, row.payload, row.created_at],
    );
  } else {
    const all = await webLoad();
    all.push(row);
    await webSave(all);
  }
  return action_id;
}

export async function enqueueExpenseCreate(
  payload: ExpenseCreatePayload,
): Promise<string> {
  const action_id = randomActionId();
  const row: PendingRow = {
    action_id,
    type: "expense_create",
    payload: JSON.stringify(payload),
    created_at: Date.now(),
  };
  const s = await getStore();
  if (s.kind === "sqlite") {
    await s.db.runAsync(
      `INSERT INTO pending_actions (action_id, type, payload, created_at) VALUES (?, ?, ?, ?)`,
      [row.action_id, row.type, row.payload, row.created_at],
    );
  } else {
    const all = await webLoad();
    all.push(row);
    await webSave(all);
  }
  return action_id;
}

/** Only one pending fridge note — latest wins (matches server “one note” semantics). */
export async function enqueueFridgeNote(body: string | null): Promise<void> {
  const s = await getStore();
  if (s.kind === "sqlite") {
    await s.db.runAsync(
      `DELETE FROM pending_actions WHERE type = 'fridge_note'`,
      [],
    );
  } else {
    const all = (await webLoad()).filter((r) => r.type !== "fridge_note");
    await webSave(all);
  }

  const row: PendingRow = {
    action_id: randomActionId(),
    type: "fridge_note",
    payload: JSON.stringify({ body } satisfies FridgeNotePayload),
    created_at: Date.now(),
  };

  const s2 = await getStore();
  if (s2.kind === "sqlite") {
    await s2.db.runAsync(
      `INSERT INTO pending_actions (action_id, type, payload, created_at) VALUES (?, ?, ?, ?)`,
      [row.action_id, row.type, row.payload, row.created_at],
    );
  } else {
    const all = await webLoad();
    all.push(row);
    await webSave(all);
  }
}

export async function peekFridgeNotePending(): Promise<FridgeNotePayload | null> {
  const all = await listAllOrdered();
  const f = all.filter((r) => r.type === "fridge_note").pop();
  if (!f) return null;
  try {
    return JSON.parse(f.payload) as FridgeNotePayload;
  } catch {
    return null;
  }
}

export async function removeAction(action_id: string): Promise<void> {
  const s = await getStore();
  if (s.kind === "sqlite") {
    await s.db.runAsync(`DELETE FROM pending_actions WHERE action_id = ?`, [
      action_id,
    ]);
  } else {
    const all = (await webLoad()).filter((r) => r.action_id !== action_id);
    await webSave(all);
  }
  emitPendingSync();
}

export { emitPendingSync };
