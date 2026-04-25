import AsyncStorage from "@react-native-async-storage/async-storage";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as SecureStore from "expo-secure-store";

/** Public site used in QR + share when no `expo.extra.houseInviteWebBase` override. */
const DEFAULT_HOUSE_INVITE_WEB = "https://habimate.com";

export const PENDING_HOUSE_CODE_KEY = "pending_house_code";
const SECURE_KEY = "pending_house_code";

function firstQuery(raw: unknown): string | undefined {
  if (typeof raw === "string" && raw.length > 0) return raw;
  if (Array.isArray(raw) && raw[0] != null) return String(raw[0]);
  return undefined;
}

function isJoinInvitePath(path: string): boolean {
  const p = path.replace(/^\/+/, "").toLowerCase();
  if (!p) return false;
  return (
    p === "join" ||
    p === "invite" ||
    p.endsWith("/join") ||
    p.endsWith("/invite") ||
    p.includes("/join/") ||
    p.includes("/invite/")
  );
}

/**
 * Parses house invite deep links, e.g. com.ihabimate.habimate://join?code=ABC
 * and https://host/join?code=ABC. Returns null if the URL is not an invite.
 */
export function tryParseHouseInviteUrl(url: string): string | null {
  const trimmed = url.trim();
  if (!trimmed) return null;

  try {
    const parsed = Linking.parse(trimmed);
    const qp = parsed.queryParams ?? {};
    const code = firstQuery(qp.code) ?? firstQuery(qp.house_code);
    const rawPath = String(parsed.path ?? "").replace(/^\/+/, "");
    const pathNorm = rawPath.toLowerCase();
    const hostNorm = String(parsed.hostname ?? "").toLowerCase();

    if (code?.trim()) {
      if (
        isJoinInvitePath(pathNorm) ||
        hostNorm === "join" ||
        hostNorm === "invite"
      ) {
        return code.trim();
      }
      // Expo dev / Router sometimes nests paths (e.g. "--/join")
      if (pathNorm.includes("join") || pathNorm.includes("invite")) {
        return code.trim();
      }
    }
  } catch {
    // fall through
  }

  try {
    const u = new URL(trimmed);
    const c =
      u.searchParams.get("code") ?? u.searchParams.get("house_code") ?? "";
    const pathOnly = u.pathname.replace(/^\/+/, "").toLowerCase();
    if (
      c.trim() &&
      (isJoinInvitePath(pathOnly) ||
        pathOnly === "join" ||
        pathOnly === "invite")
    ) {
      return c.trim();
    }
  } catch {
    // invalid URL
  }

  return null;
}

/** Deep link for in-app / share to devices that have the app — uses the app scheme from Expo. */
export function buildHouseInviteDeepLink(houseCode: string): string {
  return Linking.createURL("join", {
    queryParams: { code: houseCode.trim() },
  });
}

/**
 * Public https URL base for invite links (set `expo.extra.houseInviteWebBase` in app config to
 * override, e.g. another domain). Used by {@link getHouseInviteWebBaseUrl}.
 */
export function getHouseInviteWebBaseUrl(): string {
  const extra = (
    Constants.expoConfig as { extra?: { houseInviteWebBase?: string } } | null
  )?.extra?.houseInviteWebBase;
  const raw = (extra?.trim() || DEFAULT_HOUSE_INVITE_WEB).replace(/\/$/, "");
  if (!/^https?:\/\//i.test(raw)) {
    return DEFAULT_HOUSE_INVITE_WEB.replace(/\/$/, "");
  }
  return raw;
}

/**
 * Value encoded in the invite QR. Prefer a **https** link so the system Camera app and generic
 * scanners can open a browser; custom schemes often show "No usable data" when the app is not
 * installed. In-app camera still works via {@link tryParseHouseInviteUrl} on the same URL.
 */
export function buildHouseInviteQrValue(houseCode: string): string {
  const code = houseCode.trim();
  if (!code) return "";
  const web = getHouseInviteWebBaseUrl();
  return `${web}/join?code=${encodeURIComponent(code)}`;
}

export async function setPendingHouseCode(code: string): Promise<void> {
  const trimmed = code.trim();
  if (!trimmed) return;
  await AsyncStorage.setItem(PENDING_HOUSE_CODE_KEY, trimmed);
  try {
    await SecureStore.setItemAsync(SECURE_KEY, trimmed);
  } catch (e) {
    console.warn("SecureStore pending house code:", e);
  }
}

export async function clearPendingHouseCode(): Promise<void> {
  await AsyncStorage.removeItem(PENDING_HOUSE_CODE_KEY);
  try {
    await SecureStore.deleteItemAsync(SECURE_KEY);
  } catch {
    // not present or unsupported
  }
}

/** Prefer SecureStore, then AsyncStorage. Does not remove. */
export async function peekPendingHouseCode(): Promise<string | null> {
  try {
    const secure = await SecureStore.getItemAsync(SECURE_KEY);
    if (secure?.trim()) return secure.trim();
  } catch {
    // SecureStore unavailable
  }
  const legacy = await AsyncStorage.getItem(PENDING_HOUSE_CODE_KEY);
  return legacy?.trim() || null;
}

/** QR may encode a deep link, JSON `{ house_code }`, or a raw code string. */
export function extractHouseCodeFromQrPayload(data: string): string {
  const trimmed = data.trim();
  const fromInvite = tryParseHouseInviteUrl(trimmed);
  if (fromInvite) return fromInvite;
  try {
    const parsed = JSON.parse(trimmed) as Record<string, unknown>;
    const c = parsed.house_code ?? parsed.houseCode ?? parsed.code;
    if (typeof c === "string" && c.trim()) return c.trim();
  } catch {
    // not JSON
  }
  return trimmed;
}
