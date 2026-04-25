import AsyncStorage from "@react-native-async-storage/async-storage";
import NetInfo from "@react-native-community/netinfo";
import { notifySessionTokenCommitted } from "../auth/sessionTokenBridge";
import { API_BASE_URL } from "../config/api";
import { createPausableAbortController } from "./pausableAbortController";

/** After backgrounding, radios often need extra time to wake; 20s was too aggressive. */
const REQUEST_TIMEOUT_MS = 45000;
const RETRY_AFTER_ABORT_DELAY_MS = 900;
const AUTO_LOGOUT_FAILURE_WINDOW_MS = 2 * 60 * 1000; // 2 minutes
const AUTO_LOGOUT_FAILURE_THRESHOLD = 6;
const AUTO_LOGOUT_STORAGE_KEY = "api_failure_burst_v1";

let cachedToken: string | null | undefined = undefined;
const ENABLE_API_DEBUG =
  __DEV__ && String(process.env.EXPO_PUBLIC_API_DEBUG ?? "") === "1";

export class ApiClientError extends Error {
  status?: number;
  data?: unknown;
  raw?: unknown;

  constructor(message: string, opts?: { status?: number; data?: unknown; raw?: unknown }) {
    super(message);
    this.name = "ApiClientError";
    this.status = opts?.status;
    this.data = opts?.data;
    this.raw = opts?.raw;
  }
}

function isAbortError(err: unknown): boolean {
  const e = err as { name?: string; message?: string } | undefined;
  if (e?.name === "AbortError") return true;
  const m = String(e?.message ?? err ?? "");
  return /aborted|abort/i.test(m);
}

export function getApiErrorMessage(err: unknown, fallback = "Something went wrong"): string {
  if (!err) return fallback;
  if (typeof err === "string") return err || fallback;
  if (err instanceof Error) return err.message || fallback;
  if (typeof err === "object" && "message" in err) {
    const m = (err as { message?: unknown }).message;
    if (typeof m === "string" && m.trim()) return m;
  }
  return fallback;
}

async function forceLogoutLocal() {
  try {
    await AsyncStorage.multiRemove(["token", "user", "active_mode"]);
  } catch {
    // ignore
  }
  cachedToken = null;
  notifySessionTokenCommitted(null);
}

async function noteFailureAndMaybeLogout(): Promise<boolean> {
  const now = Date.now();
  try {
    const raw = await AsyncStorage.getItem(AUTO_LOGOUT_STORAGE_KEY);
    const prev = raw ? (JSON.parse(raw) as { t: number; n: number } | null) : null;
    const inWindow = prev && typeof prev.t === "number" && now - prev.t <= AUTO_LOGOUT_FAILURE_WINDOW_MS;
    const next = {
      t: inWindow ? prev!.t : now,
      n: (inWindow ? prev!.n : 0) + 1,
    };
    await AsyncStorage.setItem(AUTO_LOGOUT_STORAGE_KEY, JSON.stringify(next));
    if (next.n >= AUTO_LOGOUT_FAILURE_THRESHOLD) {
      await AsyncStorage.removeItem(AUTO_LOGOUT_STORAGE_KEY);
      await forceLogoutLocal();
      return true;
    }
  } catch {
    // If storage fails, do not logout users unexpectedly.
  }
  return false;
}

async function clearFailureBurst() {
  try {
    await AsyncStorage.removeItem(AUTO_LOGOUT_STORAGE_KEY);
  } catch {
    // ignore
  }
}

/** When there is no route to the internet, failed requests are expected — do not count toward auto-logout. */
async function isDeviceWithoutConnectivity(): Promise<boolean> {
  try {
    const s = await NetInfo.fetch();
    if (s.isConnected === false) return true;
    if (s.isInternetReachable === false) return true;
  } catch {
    // ignore; fall through to "maybe connected"
  }
  return false;
}

export const apiClient = async (
  endpoint: string,
  method: string = "GET",
  body?: any,
  token?: string,
  /** Extra request headers (e.g. X-Client-Platform for push registration). */
  extraHeaders?: Record<string, string>,
) => {
  const t0 = ENABLE_API_DEBUG ? global.performance?.now?.() ?? Date.now() : 0;

  if (!token) {
    if (cachedToken !== undefined) {
      token = cachedToken ?? undefined;
    } else {
      cachedToken = await AsyncStorage.getItem("token");
      token = cachedToken ?? undefined;
    }
  } else {
    cachedToken = token;
  }

  let res: Response;
  let data: any = {};

  const doFetch = async (timeoutMs: number) => {
    const { controller, cleanup } = createPausableAbortController(timeoutMs);
    try {
      return await fetch(`${API_BASE_URL}${endpoint}`, {
        method,
        signal: controller.signal,
        headers: {
          "Content-Type": "application/json",
          Accept: "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
          ...extraHeaders,
        },
        body: body ? JSON.stringify(body) : undefined,
      });
    } finally {
      cleanup();
    }
  };

  try {
    if (ENABLE_API_DEBUG) console.log("[api] ->", method, endpoint);

    try {
      res = await doFetch(REQUEST_TIMEOUT_MS);
    } catch (err) {
      // Android/Expo can occasionally get into a bad state after a large upload or
      // radio wake-up. For idempotent GET requests, do a single delayed retry.
      const isGet = String(method || "GET").toUpperCase() === "GET";
      if (isGet && isAbortError(err)) {
        await new Promise((r) => setTimeout(r, RETRY_AFTER_ABORT_DELAY_MS));
        res = await doFetch(Math.max(REQUEST_TIMEOUT_MS, 75000));
      } else {
        throw err;
      }
    }

    try {
      data = await res.json();
    } catch (jsonErr) {
      console.warn("⚠️ Failed to parse JSON:", jsonErr);
      data = {};
    }

    // Any successful round-trip clears burst counters (even if HTTP error handled below).
    // We only want to auto-logout on repeated network/abort failures.
    void clearFailureBurst();

    if (ENABLE_API_DEBUG) {
      const t1 = global.performance?.now?.() ?? Date.now();
      console.log(
        `[api] <- ${res.status} ${method} ${endpoint} ${Math.round(t1 - t0)}ms`,
      );
    }

    // 🔹 Handle 401 explicitly
    if (res.status === 401) {
      await AsyncStorage.removeItem("token");
      cachedToken = null;
      notifySessionTokenCommitted(null);
      throw new ApiClientError(
        (data?.message as string) || "Session expired. Please login again.",
        { status: 401, raw: data, data },
      );
    }

    // 🔹 Handle server success=false
    if (data?.success === false) {
      throw new ApiClientError(
        (data?.message as string) || (data?.error as string) || "Something went wrong",
        {
        status: res.status,
        data,
        raw: data,
        },
      );
    }

    // 🔹 Handle other HTTP errors
    // 🔥 UPDATED LOGIC TO HANDLE NESTED 'ORIGINAL' RESPONSES
    if (!res.ok) {
      let errorMessage = "Something went wrong";

      // 1. Check for Laravel Validation Errors
      if (data?.errors) {
        const firstError = Object.values(data.errors)[0] as string[];
        errorMessage = firstError[0];
      }
      // 2. Check for your custom 'original' wrapper
      else if (data?.original?.message) {
        errorMessage = data.original.message;
      }
      // 2b. Check for common "error" field (e.g. SocialLoginController)
      else if (data?.original?.error) {
        errorMessage = data.original.error;
      }
      // 3. Check for standard message
      else if (data?.message) {
        errorMessage = data.message;
      }
      // 4. Check for standard error
      else if (data?.error) {
        errorMessage = data.error;
      }

      throw new ApiClientError(errorMessage, {
        status: res.status,
        data: data?.original || data, // Unwrap data for easier access in screens
        raw: data,
      });
    }

    return data;
  } catch (err: any) {
    if (ENABLE_API_DEBUG) console.error("[api] error", method, endpoint, err);
    // If the device is repeatedly timing out/aborting requests, reset session as a last-resort
    // recovery mechanism (helps some Android devices after network wake-ups).
    if (isAbortError(err)) {
      if (await isDeviceWithoutConnectivity()) {
        void clearFailureBurst();
        throw new ApiClientError(
          `Request timed out (${method} ${endpoint}). Check your connection and try again.`,
        );
      }
      const loggedOut = await noteFailureAndMaybeLogout();
      if (loggedOut) {
        throw new ApiClientError(
          "We lost connection repeatedly, so we signed you out to reset the session. Please log in again.",
        );
      }
      throw new ApiClientError(
        `Request timed out (${method} ${endpoint}). Check your connection and try again.`,
      );
    }
    // Network-layer fetch failures (TypeError: Network request failed, Failed to fetch, etc)
    const msg = String(err?.message ?? err ?? "").toLowerCase();
    const isNetworkFail =
      msg.includes("network request failed") ||
      msg.includes("failed to fetch") ||
      msg.includes("networkerror");
    if (isNetworkFail) {
      if (await isDeviceWithoutConnectivity()) {
        void clearFailureBurst();
        if (err instanceof Error) throw err;
        throw new ApiClientError(getApiErrorMessage(err), { raw: err });
      }
      const loggedOut = await noteFailureAndMaybeLogout();
      if (loggedOut) {
        throw new ApiClientError(
          "We couldn’t reach the server repeatedly, so we signed you out to reset the session. Please log in again.",
        );
      }
    }
    if (err instanceof Error) throw err;
    throw new ApiClientError(getApiErrorMessage(err), { raw: err });
  }
};
