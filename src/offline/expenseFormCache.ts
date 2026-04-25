import AsyncStorage from "@react-native-async-storage/async-storage";

/** v2: single key so save/load always match (v1 per-house keys missed when user.house_id != stored key). */
const CACHE_KEY_V2 = "@habimate/expense_form_cache_v2";
const VERSION = 2;

const LEGACY_PREFIX = "@habimate/expense_form_cache/v1";

export type ExpenseFormCachePayload = {
  v: number;
  houseId: string | null;
  mates: any[];
  categories: any[];
  currency: string;
  guestDayWeightPercent: number;
  savedAt: number;
};

async function getCurrentUserHouseIdString(): Promise<string | null> {
  try {
    const raw = await AsyncStorage.getItem("user");
    if (!raw) return null;
    const u = JSON.parse(raw) as { house_id?: number | string | null };
    if (u?.house_id == null) return null;
    return String(u.house_id);
  } catch {
    return null;
  }
}

function legacyKeyForHouse(houseId: string): string {
  return `${LEGACY_PREFIX}/house_${houseId}`;
}

/**
 * Migrated from v1 per-house file if v2 is empty.
 */
async function tryLoadLegacyMigrated(
  currentHouse: string | null,
): Promise<ExpenseFormCachePayload | null> {
  if (!currentHouse) return null;
  try {
    const raw = await AsyncStorage.getItem(legacyKeyForHouse(currentHouse));
    if (!raw) return null;
    const data = JSON.parse(raw) as Partial<ExpenseFormCachePayload> & { v?: number };
    if (data.v !== 1) return null;
    if (!Array.isArray(data.mates)) data.mates = [];
    if (!Array.isArray(data.categories)) data.categories = [];
    if (data.mates.length === 0 && data.categories.length === 0) return null;
    const next: ExpenseFormCachePayload = {
      v: VERSION,
      houseId: currentHouse,
      mates: data.mates,
      categories: data.categories,
      currency: data.currency || "$",
      guestDayWeightPercent:
        Number.isFinite(data.guestDayWeightPercent) && (data as any).guestDayWeightPercent >= 0
          ? (data as any).guestDayWeightPercent
          : 100,
      savedAt: data.savedAt ?? Date.now(),
    };
    await AsyncStorage.setItem(CACHE_KEY_V2, JSON.stringify(next));
    return next;
  } catch {
    return null;
  }
}

/**
 * Last successful /dashboard + categories fields for the add-expense modal. Updated from
 * Dashboard (primary) and from the Expenses screen. Single v2 key + houseId inside payload
 * so AsyncStorage "user" shape cannot break lookups.
 */
export async function saveExpenseFormCache(payload: {
  mates: any[];
  categories: any[];
  currency: string;
  guestDayWeightPercent: number;
  houseId: number | string | null;
}): Promise<void> {
  const mates = Array.isArray(payload.mates) ? payload.mates : [];
  const categories = Array.isArray(payload.categories) ? payload.categories : [];
  if (mates.length === 0 && categories.length === 0) {
    return;
  }
  const houseId =
    payload.houseId == null || payload.houseId === ""
      ? null
      : String(payload.houseId);
  const data: ExpenseFormCachePayload = {
    v: VERSION,
    houseId,
    mates,
    categories,
    currency: payload.currency || "$",
    guestDayWeightPercent:
      Number.isFinite(payload.guestDayWeightPercent) &&
      payload.guestDayWeightPercent >= 0
        ? payload.guestDayWeightPercent
        : 100,
    savedAt: Date.now(),
  };
  await AsyncStorage.setItem(CACHE_KEY_V2, JSON.stringify(data));
}

export async function loadExpenseFormCache(): Promise<ExpenseFormCachePayload | null> {
  const current = await getCurrentUserHouseIdString();
  const parseRow = (raw: string | null): ExpenseFormCachePayload | null => {
    if (!raw) return null;
    try {
      const data = JSON.parse(raw) as ExpenseFormCachePayload;
      if (data.v !== VERSION) return null;
      if (!Array.isArray(data.mates)) data.mates = [];
      if (!Array.isArray(data.categories)) data.categories = [];
      if (data.mates.length === 0 && data.categories.length === 0) return null;
      if (data.houseId == null) {
        if (current == null) return data;
        return null;
      }
      if (current != null && data.houseId !== current) {
        return null;
      }
      return data;
    } catch {
      return null;
    }
  };

  const v2 = parseRow(await AsyncStorage.getItem(CACHE_KEY_V2));
  if (v2) return v2;

  return tryLoadLegacyMigrated(current);
}
