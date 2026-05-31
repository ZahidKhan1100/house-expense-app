import AsyncStorage from "@react-native-async-storage/async-storage";
import * as ImageManipulator from "expo-image-manipulator";
import { RECEIPT_IMAGE_MAX_DIMENSION } from "../constants/receiptImage";
import { API_BASE_URL } from "../config/api";
import * as FileSystem from "expo-file-system";
import { Platform } from "react-native";
import { createPausableAbortController } from "../utils/pausableAbortController";

export type ReceiptExtraction = {
  total_amount: number | null;
  currency: string | null;
  merchant_name: string | null;
  date: string | null; // YYYY-MM-DD
  /** AI suggestion; matched client-side to house category names. */
  category_hint: string | null;
};

export type ExtractReceiptOptions = {
  /** When aborted, upload is cancelled client-side as soon as possible. */
  signal?: AbortSignal;
};

export function makeReceiptScanAbortError(): Error {
  const e = new Error("Canceled");
  e.name = "AbortError";
  return e;
}

function isLikelyAbortError(e: unknown): boolean {
  const err = e as { name?: string; message?: string } | undefined;
  if (err?.name === "AbortError") return true;
  const m = String(err?.message ?? e ?? "").toLowerCase();
  return m.includes("aborted") || m.includes("abort");
}

function throwIfAborted(signal?: AbortSignal): void {
  if (signal?.aborted) {
    throw makeReceiptScanAbortError();
  }
}

async function fetchReceiptExtract(
  form: FormData,
  token: string,
  outerSignal?: AbortSignal,
): Promise<Response> {
  const { controller: timeoutCtrl, cleanup: cleanupTimeout } =
    createPausableAbortController(120000);
  const combined = new AbortController();
  const forward = () => {
    try {
      combined.abort();
    } catch {
      // ignore
    }
  };

  timeoutCtrl.signal.addEventListener("abort", forward);

  let removeUserListener: (() => void) | undefined;
  if (outerSignal) {
    if (outerSignal.aborted) {
      forward();
    } else {
      outerSignal.addEventListener("abort", forward);
      removeUserListener = () => outerSignal.removeEventListener("abort", forward);
    }
  }

  try {
    return await fetch(`${API_BASE_URL}/receipts/extract`, {
      method: "POST",
      signal: combined.signal,
      headers: {
        Accept: "application/json",
        Authorization: `Bearer ${token}`,
        // NOTE: Do not set Content-Type for multipart; fetch will set boundary.
      },
      body: form,
    });
  } finally {
    timeoutCtrl.signal.removeEventListener("abort", forward);
    removeUserListener?.();
    cleanupTimeout();
  }
}

/** True when scan was canceled by user (AbortSignal) or local abort. */
export function isReceiptScanCanceled(err: unknown): boolean {
  if (!err) return false;
  if (err instanceof Error && err.name === "AbortError") return true;
  return isLikelyAbortError(err);
}

export async function extractReceiptFromImage(
  uri: string,
  options?: ExtractReceiptOptions,
): Promise<ReceiptExtraction> {
  const signal = options?.signal;

  throwIfAborted(signal);

  const token = await AsyncStorage.getItem("token");
  if (!token) {
    throw { message: "Not logged in" };
  }

  throwIfAborted(signal);

  // On Android, ImagePicker can return a content:// URI. Fetch multipart upload
  // is more reliable with a file:// URI, so copy into cache when needed.
  let fileUri = uri;
  if (Platform.OS === "android" && uri.startsWith("content://")) {
    const dest = `${FileSystem.cacheDirectory}receipt-${Date.now()}.jpg`;
    await FileSystem.copyAsync({ from: uri, to: dest });
    fileUri = dest;
  }

  throwIfAborted(signal);

  // iOS often returns HEIC/HEIF from the library; Laravel only accepts jpg/png/webp.
  // Normalize to JPEG (same pattern as wall photo uploads).
  let uploadUri = fileUri;
  try {
    const manipulated = await ImageManipulator.manipulateAsync(
      fileUri,
      [{ resize: { width: RECEIPT_IMAGE_MAX_DIMENSION } }],
      { compress: 0.85, format: ImageManipulator.SaveFormat.JPEG },
    );
    uploadUri = manipulated.uri;
  } catch (e) {
    throw {
      message:
        "Could not read this image. Try another photo or re-save it as JPEG in Photos.",
    };
  }

  throwIfAborted(signal);

  const form = new FormData();
  form.append("image", {
    uri: uploadUri,
    name: "receipt.jpg",
    type: "image/jpeg",
  } as any);

  let res: Response;
  try {
    try {
      // Gemini can take longer; give it breathing room.
      res = await fetchReceiptExtract(form, token, signal);
    } catch (e) {
      throwIfAborted(signal);
      if (isLikelyAbortError(e)) throw makeReceiptScanAbortError();

      // One retry helps devices that momentarily lose radio after the camera/gallery flow.
      await new Promise((r) => setTimeout(r, 900));
      throwIfAborted(signal);
      res = await fetchReceiptExtract(form, token, signal);
    }
  } catch (e: unknown) {
    throwIfAborted(signal);
    if (isLikelyAbortError(e)) {
      throw makeReceiptScanAbortError();
    }
    const m = String((e as { message?: string })?.message ?? e ?? "").toLowerCase();
    throw {
      message:
        m.includes("network") || m.includes("failed to fetch") || m.includes("aborted")
          ? "Network error. Check your connection and try again."
          : m.includes("timeout")
            ? "Receipt scan timed out. Try again on a stronger connection."
            : "Receipt scan failed",
    };
  }

  throwIfAborted(signal);

  let data: any = {};
  try {
    data = await res.json();
  } catch {
    data = {};
  }

  if (!res.ok) {
    if (__DEV__) {
      console.warn("[receipt scan] API error", res.status, data);
    }
    const firstField = data?.errors && typeof data.errors === "object"
      ? Object.values(data.errors as Record<string, string[]>)[0]?.[0]
      : null;
    const msg =
      data?.message ||
      data?.error ||
      firstField ||
      "Receipt scan failed";
    throw { message: msg, status: res.status, data };
  }

  if (data?.success !== true) {
    throw { message: data?.message || "Receipt scan failed", data };
  }

  const raw = (data.extraction ?? null) as Partial<ReceiptExtraction> | null;
  if (!raw) {
    return {
      total_amount: null,
      currency: null,
      merchant_name: null,
      date: null,
      category_hint: null,
    };
  }
  return {
    total_amount: raw.total_amount ?? null,
    currency: raw.currency ?? null,
    merchant_name: raw.merchant_name ?? null,
    date: raw.date ?? null,
    category_hint:
      typeof raw.category_hint === "string" && raw.category_hint.trim() !== ""
        ? raw.category_hint.trim()
        : null,
  };
}

